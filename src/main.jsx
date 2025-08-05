import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './app.css'; // ✅ Import here if styles are used across the app

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
