// src/components/LoadingScreen.jsx
import React from "react";
import "../styles/loading.css";

const LoadingScreen = () => {
  return (
    <div className="modern-loading-container">
      <div className="spinner-icon">
        <svg
          className="loading-svg"
          width="50"
          height="50"
          viewBox="0 0 50 50"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M25 5C14.075 5 5 14.075 5 25C5 35.925 14.075 45 25 45C35.925 45 45 35.925 45 25"
            stroke="#ffffff"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="loading-message-modern">Loading...</p>
    </div>
  );
};

export default LoadingScreen;