import React, { useRef, useEffect, useState } from "react";
import '../styles/region.css';
import { useNavigate } from "react-router-dom";
import hoverSound from "../assets/hover.mp3";
import * as XLSX from "xlsx";
import { getAllUserScores } from "../utils/firestoreUtils";

const Region = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("User");
  const audioRef = useRef(new Audio(hoverSound));

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (currentUser) {
      // Prefer firstName, fallback to username
      if (currentUser.firstName) {
        setUserName(currentUser.firstName);
      } else if (currentUser.username) {
        setUserName(currentUser.username);
      }
    }
  }, []);

  const regions = [
    { code: "uscan", label: "US / CAN" },
    { code: "sa", label: "South Asia" },
    { code: "we", label: "Western Europe" },
    { code: "latam", label: "Latin America" },
    { code: "afr", label: "Africa" },
    { code: "esea", label: "ESEA" },
  ];

  const handleRegionClick = (regionCode) => {
    navigate(`/${regionCode}`, { state: { userName } });
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const playHoverSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const isAdmin = currentUser?.role === 'admin';

  const handleExportScores = async () => {
    try {
      const data = await getAllUserScores();

      if (data.length === 0) {
        alert("No scores available to export.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "AllUserScores");
      XLSX.writeFile(workbook, "UserScores.xlsx");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Something went wrong while exporting.");
    }
  };

  return (
    <div className="region-page">
      <div className="region-header">
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>

        <div
          className="profile-circle"
          onClick={handleProfileClick}
          title="Go to your profile"
        >
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="region-container">
        <h1 className="region-title">
          Welcome, <span className="region-username">{userName}</span>!
        </h1>
        <h2 className="region-subtitle">Select Your Region</h2>

        <div className="region-grid">
          {regions.map((region) => (
            <div
              key={region.code}
              className="region-box"
              onClick={() => handleRegionClick(region.code)}
              onMouseEnter={playHoverSound}
            >
              {region.label}
            </div>
          ))}
        </div>
      </div>

      {/* Admin download button - moved outside region-container */}
      {isAdmin && (
        <div className="admin-export">
          <button className="export-button" onClick={handleExportScores}>
            ⬇️ Download All User Scores
          </button>
        </div>
      )}
    </div>
  );
};

export default Region;
