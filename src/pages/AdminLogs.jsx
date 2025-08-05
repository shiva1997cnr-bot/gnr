import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();
  const currentUser = localStorage.getItem("employeeId");

  // Only allow access to admins
  const allowedAdmins = ["admin123", "shiv"]; // Update this list
  const isAdmin = allowedAdmins.includes(currentUser);

  useEffect(() => {
    const raw = localStorage.getItem("activityLogs");
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const flatLogs = [];

    Object.entries(parsed).forEach(([employeeId, entries]) => {
      entries.forEach((entry) => {
        flatLogs.push({
          employeeId,
          timestamp: entry.timestamp,
          action: entry.action,
          details: entry.details,
        });
      });
    });

    setLogs(flatLogs);
  }, []);

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");

    XLSX.writeFile(wb, "ActivityLogs.xlsx");
  };

  if (!isAdmin) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p>You are not authorized to view this page.</p>
        <button onClick={() => navigate("/region")} className="mt-2 underline text-blue-600">
          Back to Region
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Activity Logs</h1>
      <button
        onClick={downloadExcel}
        className="bg-green-500 text-white px-4 py-2 rounded mb-4 hover:bg-green-600"
      >
        📥 Export to Excel
      </button>

      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Employee ID</th>
              <th className="p-2 border">Timestamp</th>
              <th className="p-2 border">Action</th>
              <th className="p-2 border">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2 border">{log.employeeId}</td>
                <td className="p-2 border">{log.timestamp}</td>
                <td className="p-2 border">{log.action}</td>
                <td className="p-2 border">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminLogs;
