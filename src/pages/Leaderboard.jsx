import React, { useEffect, useState } from "react";
import "../styles/leaderboard.css";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  listenToReactions,
  addReaction,
  EMOJIS,
} from "../utils/firestoreUtils";

const Leaderboard = ({ forceExpand = false }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserEntry, setCurrentUserEntry] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [reactions, setReactions] = useState({});
  const [hoveredUser, setHoveredUser] = useState(null);
  const [autoExpandActive, setAutoExpandActive] = useState(forceExpand);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const scores = data.scores || {};
        let totalScore = 0;
        let totalTime = 0;

        Object.values(scores).forEach((entry) => {
          totalScore += Number(entry.score) || 0;
          totalTime += Number(entry.timeSpent) || 0;
        });

        users.push({
          username: doc.id,
          fullName: data.firstName || doc.id,
          totalScore,
          totalTime,
        });
      });

      users.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.totalTime - b.totalTime;
      });

      setLeaderboard(users);

      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      if (currentUser) {
        const index = users.findIndex(
          (u) => u.username === currentUser.username
        );
        if (index !== -1) {
          setCurrentUserEntry({
            ...users[index],
            rank: index + 1,
          });
        }
      }
    });

    const unsubscribeReactions = listenToReactions(setReactions);

    return () => {
      unsubscribe();
      unsubscribeReactions();
    };
  }, []);

  useEffect(() => {
    if (forceExpand) {
      setExpanded(true);
      const timer = setTimeout(() => {
        setExpanded(false);
        setAutoExpandActive(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [forceExpand]);

  const handleReact = async (targetUsername, emoji) => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const currentUsername = currentUser?.username;

    if (!currentUsername || !targetUsername || currentUsername === targetUsername) return;

    try {
      await addReaction(targetUsername, emoji, currentUsername);
    } catch (error) {
      console.error("❌ Failed to add reaction:", error);
    }
  };

  const renderEmojis = (username) => {
    const userReactions = reactions[username] || {};

    // Sort emojis by reaction count
    const sorted = Object.entries(userReactions)
      .filter(([, users]) => users.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    if (sorted.length === 0) return null;

    // Special case: only one emoji and exactly 1 reaction → just show emoji
    if (sorted.length === 1 && sorted[0][1].length === 1) {
      const [emoji] = sorted[0];
      return (
        <span className="emoji-reaction-group">
          <span
            className="emoji-reaction"
            title={`Reacted by: ${sorted[0][1][0].split("@")[0]}`}
          >
            {emoji}
          </span>
        </span>
      );
    }

    // Pick top 2 emojis
    const topTwo = sorted.slice(0, 2);
    const topTwoTotal = topTwo.reduce((sum, [, users]) => sum + users.length, 0);

    return (
      <span className="emoji-reaction-group">
        {topTwo.map(([emoji]) => (
          <span
            key={emoji}
            className="emoji-reaction"
            title={`Reacted by: ${userReactions[emoji]
              .map((email) => email.split("@")[0])
              .join(", ")}`}
          >
            {emoji}
          </span>
        ))}
        {topTwoTotal > 0 && (
          <span
            className="emoji-total"
            title={sorted
              .map(
                ([emoji, users]) =>
                  `${emoji}: ${users.map((e) => e.split("@")[0]).join(", ")}`
              )
              .join("\n")}
          >
            +{topTwoTotal}
          </span>
        )}
      </span>
    );
  };

  const renderEmojiOptions = (username, fullName) => {
    if (hoveredUser !== username) return null;
    return (
      <div className="emoji-options">
        <div className="react-to-name">React to {fullName}</div>
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className="emoji-button"
            title={`React with ${emoji}`}
            onClick={() => handleReact(username, emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  };

  const renderEntry = (user, index, isCurrent = false) => (
    <div
      key={user.username}
      className={`leaderboard-entry slide-up ${
        index < 3 ? "top-rank" : ""
      } ${isCurrent ? "highlight" : ""}`}
      style={{ animationDelay: `${index * 0.1}s` }}
      onMouseEnter={() => setHoveredUser(user.username)}
      onMouseLeave={() => setHoveredUser(null)}
    >
      <span className="rank">#{isCurrent ? user.rank : index + 1}</span>
      <span className="name">{user.fullName}</span>
      <span className="reactions">{renderEmojis(user.username)}</span>
      {renderEmojiOptions(user.username, user.fullName)}
      <span className="score">{user.totalScore} pts</span>
    </div>
  );

  return (
    <div
      className={`leaderboard-wrapper ${expanded ? "expanded" : ""}`}
      onMouseEnter={() => {
        if (!autoExpandActive) setExpanded(true);
      }}
      onMouseLeave={() => {
        if (!autoExpandActive) setExpanded(false);
      }}
    >
      <button className="leaderboard-toggle-button">🌍 Global Leaderboard</button>

      {expanded && (
        <div className="leaderboard-container fade-in">
          <div className="leaderboard-list">
            {leaderboard.slice(0, 10).map((user, index) =>
              renderEntry(user, index)
            )}
          </div>

          {currentUserEntry && currentUserEntry.rank > 10 && (
            <div className="leaderboard-current fade-in-late">
              <hr />
              <h3>Your Rank</h3>
              {renderEntry(currentUserEntry, currentUserEntry.rank, true)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
