// src/components/AdminDeleteScoresButton.jsx
import React, { useState } from "react";
import { deleteAllUserScores, getAllUserScores } from "../utils/firestoreUtils";

export default function AdminDeleteScoresButton({ onScoresUpdated }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("⚠️ Are you sure? This will delete ALL user scores!")) return;

    setLoading(true);
    try {
      await deleteAllUserScores();
      alert("✅ All scores deleted successfully!");
      if (onScoresUpdated) {
        const freshScores = await getAllUserScores();
        onScoresUpdated(freshScores);
      }
    } catch (error) {
      console.error("❌ Failed to delete scores:", error);
      alert("❌ Failed to delete scores. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md disabled:opacity-50"
    >
      {loading ? "Deleting..." : "Delete All Scores"}
    </button>
  );
}
