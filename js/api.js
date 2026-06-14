(function(){
  function getApiUrl_(){
    const url = String(window.GAS_API_URL || "").trim();
    if(!url){
      throw new Error("ยังไม่ได้ตั้งค่า GAS_API_URL ใน js/config.js");
    }
    return url;
  }

  async function callApi(action, payload = {}){
    let response;
    try{
      response = await fetch(getApiUrl_(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...payload }),
      });
    }catch(err){
      throw new Error("Failed to fetch GAS API: " + (err && err.message ? err.message : err));
    }

    const text = await response.text();
    let json;
    try{
      json = text ? JSON.parse(text) : {};
    }catch(err){
      throw new Error("GAS API response is not JSON");
    }

    if(!response.ok){
      throw new Error((json && (json.message || json.error)) || ("HTTP " + response.status));
    }
    if(!json.ok){
      throw new Error((json && (json.message || json.error)) || "API error");
    }
    return Object.prototype.hasOwnProperty.call(json, "data") ? json.data : json;
  }

  function authToken_(){
    try{
      return window.__token || sessionStorage.getItem("pea_token") || "";
    }catch(_err){
      return window.__token || "";
    }
  }

  function asOk_(data){
    if(data && data.ok !== undefined) return data;
    return { ok: true, ...(data || {}) };
  }

  async function callApiFunction_(functionName, args){
    return callApi(API_ACTIONS.CALL_FUNCTION, {
      functionName,
      args: Array.isArray(args) ? args : [],
    });
  }

  async function callKnownFunction_(functionName, args){
    const a = Array.isArray(args) ? args : [];
    const token = authToken_();

    switch(functionName){
      case "ping":
        return asOk_(await callApi(API_ACTIONS.HEALTH));

      case "login": {
        const data = await callApi(API_ACTIONS.LOGIN, {
          username: a[0],
          password: a[1],
        });
        return asOk_(data);
      }

      case "validateToken": {
        const data = await callApi("getCurrentUser", { token: a[0] });
        return asOk_(data);
      }

      case "getMonthData": {
        const data = await callApi(API_ACTIONS.GET_ROSTER, {
          token,
          beYear: a[0],
          month: a[1],
        });
        return data && data.roster ? data.roster : data;
      }

      case "getMonthHoursSummary": {
        const data = await callApi(API_ACTIONS.GET_ROSTER, {
          token,
          beYear: a[0],
          month: a[1],
        });
        return data && data.summary ? data.summary : data;
      }

      case "listRequests": {
        const data = await callApi(API_ACTIONS.GET_ROSTER, {
          token: a[0],
          beYear: a[1],
          month: a[2],
        });
        return data && data.requests ? data.requests : [];
      }

      case "listIncomingSwapRequests": {
        const data = await callApi(API_ACTIONS.GET_ROSTER, {
          token: a[0],
          beYear: a[1],
          month: a[2],
        });
        const requests = data && Array.isArray(data.requests) ? data.requests : [];
        return requests.filter(r => String(r.status || "").trim() === "await_inspector");
      }

      case "listInboxForCoverer":
        return [];

      case "getRosterPeople": {
        const data = await callApi(API_ACTIONS.GET_CONFIG, { token });
        return data && Array.isArray(data.rosterPeople) ? data.rosterPeople : [];
      }

      case "getRosterPeopleFull": {
        const data = await callApi(API_ACTIONS.GET_CONFIG, { token: a[0] });
        const people = data && Array.isArray(data.rosterPeople) ? data.rosterPeople : [];
        return people.map(name => ({
          name,
          roleText: "",
          role: "both",
        }));
      }

      case "getUsersForAdmin":
        return [];

      case "getDeviceLocationOptions":
        return [];

      case "isLeaderOnShift":
        return { ok: true, isLeader: false };

      case "getRosterRules": {
        const data = await callApi(API_ACTIONS.GET_CONFIG, { token: a[0] });
        return data && data.rules ? data.rules : {};
      }

      case "generateRosterMonth":
        return callApi(API_ACTIONS.SAVE_ROSTER, {
          token: a[0],
          beYear: a[1],
          month: a[2],
          operation: "generate",
        });

      case "createMonthlySheetsForBE":
        return callApi(API_ACTIONS.SAVE_ROSTER, {
          token: a[0],
          operation: "createMonthSheets",
        });

      case "setHoliday":
        return callApi(API_ACTIONS.SAVE_ROSTER, {
          token: a[0],
          beYear: a[1],
          month: a[2],
          day: a[3],
          isHoliday: !!a[4],
          operation: "setHoliday",
        });

      case "manualEditShiftNames":
        return callApi(API_ACTIONS.SAVE_ROSTER, {
          token: a[0],
          beYear: a[1],
          month: a[2],
          day: a[3],
          shift: a[4],
          names: a[5] || [],
          operation: "manualEditShift",
        });

      case "addItem":
        return callApi(API_ACTIONS.SAVE_ROSTER, {
          token: a[0],
          beYear: a[1],
          month: a[2],
          day: a[3],
          text: a[4],
          operation: "addItem",
        });

      case "hoGetVehicleSheets": {
        const data = await callApi(API_ACTIONS.GET_HANDOVER, {
          token: a[0],
          operation: "config",
        });
        return data && data.vehicles ? data.vehicles : [];
      }

      case "hoGetEmployeeNames": {
        const data = await callApi(API_ACTIONS.GET_HANDOVER, {
          token: a[0],
          operation: "config",
        });
        return data && data.employees ? data.employees : [];
      }

      case "hoGetEquipmentList":
        return callApi(API_ACTIONS.GET_HANDOVER, {
          token: a[0],
          vehicleSheet: a[1],
          operation: "equipment",
        });

      case "hoListPendingReceiver":
      case "hoListPendingForReceiver":
        return callApi(API_ACTIONS.GET_HANDOVER, {
          token: a[0],
          operation: "pending",
        });

      case "hoListHandoversByDay":
        return callApi(API_ACTIONS.GET_HANDOVER, {
          token: a[0],
          beYear: a[1],
          month: a[2],
          day: a[3],
          vehicleSheet: a[4],
          operation: "day",
        });

      case "hoGetHandoverForView":
        return callApi(API_ACTIONS.GET_HANDOVER, {
          token: a[0],
          handoverId: a[1],
          operation: "detail",
        });

      case "hoGetDashboardSummary":
        return callApi(API_ACTIONS.GET_HANDOVER, {
          token: a[0],
          operation: "dashboard",
        });

      case "hoSaveActualQtys":
        return callApi(API_ACTIONS.SAVE_HANDOVER, {
          token: a[0],
          vehicleSheet: a[1],
          updates: a[2] || [],
          operation: "saveActualQtys",
        });

      case "hoSubmitHandover":
        return callApi(API_ACTIONS.SAVE_HANDOVER, {
          token: a[0],
          payload: a[1],
          operation: "submit",
        });

      case "hoAcceptHandover":
        return callApi(API_ACTIONS.SAVE_HANDOVER, {
          token: a[0],
          handoverId: a[1],
          note: a[2] || "",
          operation: "accept",
        });

      case "hoRejectHandover":
        return callApi(API_ACTIONS.SAVE_HANDOVER, {
          token: a[0],
          handoverId: a[1],
          note: a[2] || "",
          operation: "reject",
        });

      case "getOutageMapData":
        return callApi(API_ACTIONS.GET_MAP_DATA, {
          token: a[0],
          beYear: a[1] && a[1].beYear,
          month: a[1] && a[1].month,
        });

      case "recordAttendance":
        return callApi(API_ACTIONS.SAVE_DAILY_SIGN, {
          token: a[0],
          beYear: a[1],
          month: a[2],
          day: a[3],
          shift: a[4],
          attendanceAction: a[5],
          clientIso: a[6],
          lat: a[7],
          lng: a[8],
          imageDataUrl: a[9],
          extraPayload: a[10] || null,
        });

      case "exportDailySignPdf":
        return callApi(API_ACTIONS.EXPORT_DAILY_SIGN, {
          token: a[0],
          beYear: a[1],
          month: a[2],
          day: a[3],
        });

      default:
        return undefined;
    }
  }

  async function callFunction(functionName, args){
    try{
      return await callApiFunction_(functionName, args);
    }catch(err){
      const msg = err && err.message ? err.message : String(err);
      if(msg.indexOf("Unknown action: callFunction") !== -1){
        const direct = await callKnownFunction_(functionName, args);
        if(direct !== undefined) return direct;
        throw new Error("Backend ยังไม่รองรับ callFunction สำหรับ " + functionName);
      }
      throw err;
    }
  }

  function createGoogleScriptRunShim(){
    const state = {
      success: null,
      failure: null,
    };

    const runner = new Proxy({}, {
      get(_target, prop){
        if(prop === "withSuccessHandler"){
          return function(handler){
            state.success = typeof handler === "function" ? handler : null;
            return runner;
          };
        }
        if(prop === "withFailureHandler"){
          return function(handler){
            state.failure = typeof handler === "function" ? handler : null;
            return runner;
          };
        }
        if(typeof prop === "symbol") return undefined;

        return function(...args){
          const success = state.success;
          const failure = state.failure;
          state.success = null;
          state.failure = null;

          callFunction(String(prop), args)
            .then(result => {
              if(success) success(result);
            })
            .catch(err => {
              if(failure) failure(err);
              else console.error(err);
            });

          return runner;
        };
      },
    });

    return runner;
  }

  window.callApi = callApi;
  window.callFunction = callFunction;
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = window.google.script.run || createGoogleScriptRunShim();
})();
