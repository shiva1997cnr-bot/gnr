import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import '../styles/profile.css';

const Profile = () => {
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserScores = async () => {
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", currentUser.username);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        let extractedFirstName = "";

        if (userData.firstname) {
          extractedFirstName = userData.firstname;
        } else if (userData.fullName) {
          extractedFirstName = userData.fullName.split(" ")[0];
        } else {
          // fallback to username part before @ in email
          extractedFirstName = currentUser.username.split("@")[0];
        }

        setFirstName(extractedFirstName);
        setScores(userData.scores || {});
      }

      setLoading(false);
    };

    fetchUserScores();
  }, []);

  const getFeedback = (score) => {
    if (score > 90) return "Excellent 🌟";
    if (score >= 80) return "Impressive 👍";
    return "Needs more improvement 🚧";
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2 className="animated-name">{firstName}'s Profile</h2>
        <p className="subtitle">Here is your region-wise analysis:</p>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading scores...</p>
        </div>
      ) : Object.keys(scores).length === 0 ? (
        <p className="no-scores">No scores found. Complete a quiz to see your performance!</p>
      ) : (
        <table className="score-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Score</th>
              <th>Feedback</th>
              <th>Time Spent (seconds)</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(scores).map(([region, data], index) => (
              <tr key={region} style={{ animationDelay: `${index * 0.1}s` }}>
                <td>{region.toUpperCase()}</td>
                <td>{data.score}</td>
                <td className="feedback-cell">
                  {getFeedback(data.score)}
                  <span className="feedback-icon" style={{ animationDelay: `${index * 0.1 + 0.5}s` }}>
                    {getFeedback(data.score).slice(-1)}
                  </span>
                </td>
                <td>{data.timeSpent}</td>
                <td>{data.timestamp || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button onClick={() => navigate("/region")} className="profile-return">
        🔙 Return to Regions
      </button>
    </div>
  );
};

export default Profile;
