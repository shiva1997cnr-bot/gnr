import React, { useRef, useEffect, useState } from "react";
import '../styles/region.css';
import { useNavigate } from "react-router-dom";
import hoverSound from "../assets/hover.mp3";
import * as XLSX from "xlsx";
import { getAllUserScores } from "../utils/firestoreUtils";
import Leaderboard from './Leaderboard';

const Region = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("User");
  const [bgLoaded, setBgLoaded] = useState(false);
  const audioRef = useRef(new Audio(hoverSound));

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.src = '/region/world-map.webp';
    img.onload = () => setBgLoaded(true);
  }, []);

  // Load user from localStorage
  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (currentUser) {
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
    <div
      className="region-page"
      style={{
        backgroundImage: bgLoaded ? "url('/region/world-map.webp')" : "none",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#3d3a3a',
        backgroundBlendMode: 'multiply',
        transition: 'background-image 0.6s ease-in-out',
      }}
    >
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
          Welcome, <span className="region-username animated-welcome">{userName}</span>!
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

        <div className="leaderboard-wrapper">
          <Leaderboard />
        </div>
      </div>

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