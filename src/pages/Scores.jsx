// src/pages/Scores.jsx
import React from "react";

const Scores = () => {
  const scores = JSON.parse(localStorage.getItem("scores")) || {};

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">All User Scores</h2>
      {Object.entries(scores).length === 0 ? (
        <p>No scores available yet.</p>
      ) : (
        <table className="w-full table-auto border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1">Employee ID</th>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Region</th>
              <th className="border px-2 py-1">Score</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(scores).flatMap(([empId, data]) =>
              Object.entries(data.scores).map(([region, score]) => (
                <tr key={`${empId}-${region}`}>
                  <td className="border px-2 py-1">{empId}</td>
                  <td className="border px-2 py-1">{data.name}</td>
                  <td className="border px-2 py-1">{region}</td>
                  <td className="border px-2 py-1">{score}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Scores;
