import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllUserScores } from "../utils/firestoreUtils";
import * as XLSX from "xlsx";
import "../styles/adminlogs.css"; // Optional: create this for styling

function AdminLogs() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("currentUser"));
    if (user?.role === "admin") {
      setIsAdmin(true);
    } else {
      // Not admin, redirect after short delay
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  }, [navigate]);

  const exportToExcel = async () => {
    try {
      const data = await getAllUserScores();
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "UserScores");
      XLSX.writeFile(workbook, "UserScores.xlsx");
    } catch (error) {
      console.error("Failed to export data:", error);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="admin-page">
      <h2>📊 Admin Panel</h2>
      {isAdmin ? (
        <>
          <p>Welcome, Admin. Click below to download user scores:</p>
          <button className="export-button" onClick={exportToExcel}>
            ⬇️ Export All User Scores
          </button>
        </>
      ) : (
        <p>⛔ Access Denied: Redirecting to home...</p>
      )}
    </div>
  );
}

export default AdminLogs;
