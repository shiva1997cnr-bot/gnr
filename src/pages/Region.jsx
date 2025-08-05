import React, { useRef, useEffect, useState } from "react";
import '../styles/region.css';
import { useNavigate } from "react-router-dom";
import hoverSound from "../assets/hover.mp3";



const Region = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("User");
  const audioRef = useRef(new Audio(hoverSound));

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (currentUser?.name) {
      setUserName(currentUser.name);
    }
  }, []);

  const regions = [
    { code: "uscan", label: "US / CAN" },
    { code: "sa", label: "South Asia" },
    { code: "we", label: "Western Europe" },
    { code: "latam", label: "Latin America" },
    { code: "afr", label: "Africa" },
    { code: "esea", label: "East & Southeast Asia" },
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

  return (
    <div className="region-page">
      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>

      <div className="region-container">
        <h1 className="region-title">Welcome, <span className="region-username">{userName}</span>!</h1>
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
    </div>
  );
};

export default Region;
