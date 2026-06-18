const GAS_API_URL = "/api/gas";

const API_ACTIONS = Object.freeze({
  CALL_FUNCTION: "callFunction",
  HEALTH: "health",
  LOGIN: "login",
  GET_CONFIG: "getConfig",
  GET_ROSTER: "getRoster",
  SAVE_ROSTER: "saveRoster",
  GET_HANDOVER: "getHandover",
  SAVE_HANDOVER: "saveHandover",
  GET_MAP_DATA: "getMapData",
  SAVE_DAILY_SIGN: "saveDailySign",
  EXPORT_DAILY_SIGN: "exportDailySign",
});

const APP_DEFAULTS = Object.freeze({
  beYear: 2569,
  months: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
});

window.GAS_API_URL = GAS_API_URL;
window.API_ACTIONS = API_ACTIONS;
window.BE_YEAR = window.BE_YEAR || APP_DEFAULTS.beYear;
window.TH_MONTHS = window.TH_MONTHS || APP_DEFAULTS.months;
