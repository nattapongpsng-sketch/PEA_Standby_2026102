function formatDate(value){
  if(!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH");
}

function formatTime(value){
  if(!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function parseDate(value){
  if(!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function validateRequired(value){
  return String(value ?? "").trim() !== "";
}

function normalizeName(value){
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sortByDate(rows, key){
  return [...(rows || [])].sort((a, b) => {
    const da = parseDate(typeof key === "function" ? key(a) : a && a[key]);
    const db = parseDate(typeof key === "function" ? key(b) : b && b[key]);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
}

function convertThaiDate(value){
  const d = parseDate(value);
  return d ? d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) : "";
}

window.StandbyUtils = {
  formatDate,
  formatTime,
  parseDate,
  validateRequired,
  normalizeName,
  sortByDate,
  convertThaiDate,
};
