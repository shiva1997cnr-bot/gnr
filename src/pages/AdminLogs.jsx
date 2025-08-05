// AdminLogs.jsx
import React from "react";
import * as XLSX from "xlsx";

const allowedIds = ["admin123", "manager456"]; // replace with real admin IDs

const AdminLogs = () => {
  const employeeId = localStorage.getItem("employeeId");

  if (!allowedIds.includes(employeeId)) {
    return <p style={{ color: "red", fontWeight: "bold", padding: "2rem" }}>⛔ You don’t have access to view logs.</p>;
  }

  const logs = JSON.parse(localStorage.getItem("activityLogs")) || {};

  const exportLogs = () => {
    const data = [];

    Object.entries(logs).forEach(([userId, entries]) => {
      entries.forEach(entry => {
        data.push({ userId, ...entry });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Logs");

    XLSX.writeFile(workbook, "ActivityLogs.xlsx");
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h1 style={{ color: "#0ea5e9" }}>Admin Activity Logs</h1>
      <button
        onClick={exportLogs}
        style={{
          marginBottom: "1.5rem",
          padding: "0.6rem 1rem",
          borderRadius: "6px",
          background: "#2563eb",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
      >
        📤 Export to Excel
      </button>

      {Object.keys(logs).length === 0 ? (
        <p>No logs available.</p>
      ) : (
        Object.entries(logs).map(([userId, entries]) => (
          <div key={userId} style={{ marginBottom: "1rem", padding: "1rem", background: "#1e293b", borderRadius: "10px", color: "white" }}>
            <h3>User: {userId}</h3>
            <ul>
              {entries.map((entry, index) => (
                <li key={index}>
                  <strong>{entry.timestamp}</strong>: {entry.description}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
};

export default AdminLogs;
