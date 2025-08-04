import React, { useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import hoverSound from "../assets/hover.mp3";

const Region = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = location.state?.userName || "User";

  const audioRef = useRef(new Audio(hoverSound));

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

  const playHoverSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: "url('/world-map.png')",
        backgroundColor: "#0f0f0f",
        backgroundBlendMode: "multiply",
      }}
    >
      <div className="bg-black bg-opacity-60 p-8 rounded-xl shadow-lg text-center text-white max-w-2xl w-full">
        <h1 className="text-4xl font-bold mb-6">
          Welcome, <span className="text-red-600">{userName}</span>!
        </h1>
        <h2 className="text-2xl font-semibold mb-4">Select Your Region</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-6">
          {regions.map((region) => (
            <button
              key={region.code}
              className="bg-white/10 text-white border border-red-600 rounded-2xl p-6 text-xl shadow hover:bg-red-600 hover:text-black transition duration-300"
              onClick={() => handleRegionClick(region.code)}
              onMouseEnter={playHoverSound}
            >
              {region.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Region;
