import React, { useState } from "react"; 
import { useNavigate } from "react-router-dom";

import loginVisual from '../assets/login-visual.png';

function Login() {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleToggle = () => {
    setIsRegistering(!isRegistering);
    setMessage("");
    setEmployeeId("");
    setPassword("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isRegistering) {
      if (!/^\d{4}$/.test(password)) {
        setMessage("Password must be your 4-digit birth year.");
        return;
      }
      localStorage.setItem("employeeId", employeeId);
      localStorage.setItem("password", password);
      setMessage("Registered successfully. You can now log in.");
      setIsRegistering(false);
    } else {
      const storedId = localStorage.getItem("employeeId");
      const storedPass = localStorage.getItem("password");

      if (employeeId === storedId && password === storedPass) {
        navigate("/intro");
      } else {
        setMessage("Invalid credentials.");
      }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col justify-center items-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] animate-gradient relative">
      
      {/* Title Top Left */}
      <div className="absolute top-4 left-6">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 hover:text-red-500 transition duration-300 ease-in-out cursor-pointer">
          Generalist
        </h1>
      </div>

      <p className="text-gray-300 text-md mb-6 italic tracking-wide flex items-center gap-2 mt-20">
        Annotation Across the Globe
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white/10 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl px-8 pt-6 pb-8 mb-4 w-full max-w-sm animate-fadeInUp"
      >
        <h2 className="text-xl text-white font-semibold text-center mb-6 tracking-wide">
          {isRegistering ? "Register" : "Login"}
        </h2>

        <div className="mb-4">
          <label className="block text-white text-sm font-semibold mb-2">
            Employee ID
          </label>
          <input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-white/10 text-white placeholder-gray-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Enter ID"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-white text-sm font-semibold mb-2">
            Password (Birth Year)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-white/10 text-white placeholder-gray-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-pink-400"
            placeholder="YYYY"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full text-sm py-2 px-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-md hover:bg-red-600 hover:from-red-600 hover:to-red-600 transition duration-300 shadow-md"
        >
          {isRegistering ? "Register" : "Login"}
        </button>

        {message && (
          <p className="mt-4 text-center text-red-400 text-sm font-medium animate-fadeIn">
            {message}
          </p>
        )}
      </form>

      <button
        onClick={handleToggle}
        className="text-sm text-purple-300 hover:text-pink-400 transition duration-300 mb-6"
      >
        {isRegistering ? "Already registered? Login" : "New user? Register"}
      </button>

      {/* Enlarged Visual */}
      <img
        src={loginVisual}
        alt="Login Visual"
        className="w-[97%] max-w-[1300px] h-auto object-contain mt-2 mb-4 animate-fadeIn"
      />
    </div>
  );
}

export default Login;
