// src/utils/activityLogger.js

// Optional: keep this only if used elsewhere, and rename it
export function basicLogActivity(type, details) {
  const logs = JSON.parse(localStorage.getItem("activityLogs") || "[]");

  logs.push({
    type,
    details,
    timestamp: new Date().toISOString(),
  });

  localStorage.setItem("activityLogs", JSON.stringify(logs));
}

// Main logActivity function for employee-specific logging
export const logActivity = (employeeId, action, details = "") => {
  const timestamp = new Date().toLocaleString();
  const log = { timestamp, action, details };

  let logs = JSON.parse(localStorage.getItem("activityLogs")) || {};
  if (!logs[employeeId]) logs[employeeId] = [];
  logs[employeeId].push(log);

  localStorage.setItem("activityLogs", JSON.stringify(logs));
};
