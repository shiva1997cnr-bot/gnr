import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const handleRegister = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem("users")) || {};
    users[employeeId] = { birthYear, name };
    localStorage.setItem("users", JSON.stringify(users));
    navigate("/region", { state: { userName: name } });
  };

  return (
    <div className="h-screen bg-green-100 flex items-center justify-center">
      <form
        onSubmit={handleRegister}
        className="bg-white p-8 rounded shadow-md w-96"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>
        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full mb-4 p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Employee ID"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          required
          className="w-full mb-4 p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Birth Year"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          required
          className="w-full mb-6 p-2 border rounded"
        />
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Register
        </button>
      </form>
    </div>
  );
};

export default Register;
