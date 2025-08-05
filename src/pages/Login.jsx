import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import './styles/login.css';

function Login() {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState(""); // New field for name
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleToggle = () => {
    setIsRegistering(!isRegistering);
    setMessage("");
    setEmployeeId("");
    setPassword("");
    setName(""); // Reset name field too
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
        navigate("/intro");
      } else {
        setMessage("Invalid credentials.");
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="logo">Generalist</h1>
        <p className="subtitle">Annotation Across the Globe</p>

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
    </div>
    
  );
}

export default Login;
