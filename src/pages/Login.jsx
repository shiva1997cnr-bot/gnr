import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import '../styles/login.css';

function Login() {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const [showOrgName, setShowOrgName] = useState(false);
  const [showWelcomeNote, setShowWelcomeNote] = useState(false);
  const [showSubNote, setShowSubNote] = useState(false);

  useEffect(() => {
    const orgNameTimeout = setTimeout(() => {
      setShowOrgName(true);
    }, 500);

    const welcomeNoteTimeout = setTimeout(() => {
      setShowWelcomeNote(true);
    }, 2000);

    const subNoteTimeout = setTimeout(() => {
      setShowSubNote(true);
    }, 3500);

    return () => {
      clearTimeout(orgNameTimeout);
      clearTimeout(welcomeNoteTimeout);
      clearTimeout(subNoteTimeout);
    };
  }, []);

  const handleToggle = () => {
    setIsRegistering(!isRegistering);
    setMessage("");
    setEmployeeId("");
    setPassword("");
    setName("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem("users")) || {};
    if (isRegistering) {
      if (!/^\d{4}$/.test(password)) {
        setMessage("Password must be your 4-digit birth year.");
        return;
      }
      if (!name.trim()) {
        setMessage("Name is required.");
        return;
      }
      if (users[employeeId]) {
        setMessage("User already registered. Please login.");
        return;
      }
      users[employeeId] = { name, password };
      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", JSON.stringify({ employeeId, name }));
      setMessage("Registered successfully. You can now log in.");
      setIsRegistering(false);
    } else {
      const user = users[employeeId];
      if (user && user.password === password) {
        localStorage.setItem("currentUser", JSON.stringify({ employeeId, name: user.name }));
        navigate("/region");
      } else {
        setMessage("Invalid credentials.");
      }
    }
  };

  return (
    // The main container now holds both the text and the login box
    <div className="login-container">
      {/* This div is for the animated welcome text */}
      <div className="text-content">
        {showOrgName && <h1 className="org-name">Generalist</h1>}
        {showWelcomeNote && <h2 className="welcome-note">Glad you're here.</h2>}
        {showSubNote && <p className="sub-note">We're excited to see your achievements!</p>}
      </div>
      
      {/* This is the login box with the form and buttons */}
      <div className="login-box">
        <h1 className="logo">GNR</h1>
        <p className="subtitle">Annotation Across the Globe 🌍︎</p>
        <form onSubmit={handleSubmit} className="login-form">
          <h2>{isRegistering ? "Register" : "Login"}</h2>
          {isRegistering && (
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="text"
            placeholder="Employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (Birth Year)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">
            {isRegistering ? "Register" : "Login"}
          </button>
          {message && <p className="message">{message}</p>}
        </form>
        <button className="toggle-button" onClick={handleToggle}>
          {isRegistering ? "Already registered? Login" : "New user? Register"}
        </button>
      </div>

      {/* The new tests container to be displayed on the right */}
      
        

    </div>
  );
}

export default Login;