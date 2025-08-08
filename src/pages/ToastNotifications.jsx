// components/ToastNotifications.jsx
import React, { useState, useEffect } from "react";
import "../styles/toast.css";

const ToastNotifications = ({ toasts }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast, index) => (
        <div key={index} className="toast slide-in">
          {toast}
        </div>
      ))}
    </div>
  );
};

export default ToastNotifications;
