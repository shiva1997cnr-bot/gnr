// src/utils/activityLogger.js

// Legacy function: only keep this if needed elsewhere
export function basicLogActivity(type, details) {
  const logs = JSON.parse(localStorage.getItem("flatActivityLogs") || "[]");

  logs.push({
    type,
    details,
    timestamp: new Date().toISOString(),
  });

  localStorage.setItem("flatActivityLogs", JSON.stringify(logs));
}

// Main logActivity function: logs per employee ID
export const logActivity = (employeeId, action, details = "") => {
  const timestamp = new Date().toLocaleString(); // Human-readable format
  const log = { timestamp, action, details };

  const existingLogs = JSON.parse(localStorage.getItem("activityLogs")) || {};

  if (!existingLogs[employeeId]) {
    existingLogs[employeeId] = [];
  }

  existingLogs[employeeId].push(log);

  localStorage.setItem("activityLogs", JSON.stringify(existingLogs));
};
