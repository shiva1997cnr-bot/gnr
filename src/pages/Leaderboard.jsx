import React, { useEffect, useState } from "react";
import "../styles/leaderboard.css";
import {
  collection,
  onSnapshot,
  writeBatch,
  getDocs,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import { listenToReactions, addReaction, EMOJIS } from "../utils/firestoreUtils";

/**
 * Leaderboard
 * - Shows users only if they have at least one score entry
 * - Clears scores + reactions on admin reset, so names disappear from the board
 *
 * Props:
 *  - forceExpand?: boolean — auto expand briefly
 *  - isAdmin?: boolean — show reset button
 */
const Leaderboard = ({ forceExpand = false, isAdmin = false }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserEntry, setCurrentUserEntry] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [reactions, setReactions] = useState({});
  const [hoveredUser, setHoveredUser] = useState(null);
  const [autoExpandActive, setAutoExpandActive] = useState(forceExpand);
  const [resetLoading, setResetLoading] = useState(false);

  // Live users + scores
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const users = [];

      snapshot.forEach((doc) => {
        const data = doc.data() || {};
        const scores = data.scores || {};

        let totalScore = 0;
        let totalTime = 0;
        let scoresCount = 0;

        Object.values(scores).forEach((entry) => {
          totalScore += Number(entry.score) || 0;
          totalTime += Number(entry.timeSpent) || 0;
          scoresCount += 1;
        });

        users.push({
          username: doc.id,
          fullName: data.firstName || doc.id,
          totalScore,
          totalTime,
          scoresCount,
        });
      });

      // Sort by score desc, then time asc
      users.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.totalTime - b.totalTime;
      });

      // ✅ Only show users who actually have entries
      const filtered = users.filter((u) => u.scoresCount > 0);
      setLeaderboard(filtered);

      // Keep current user block in sync
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      if (currentUser) {
        const index = filtered.findIndex(
          (u) => u.username === currentUser.username
        );
        if (index !== -1) {
          setCurrentUserEntry({ ...filtered[index], rank: index + 1 });
        } else {
          setCurrentUserEntry(null);
        }
      }
    });

    // Live reactions
    const unsubReactions = listenToReactions(setReactions);

    return () => {
      unsubUsers();
      unsubReactions();
    };
  }, []);

  // Auto expand once when forceExpand flips true
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
    } catch (err) {
      console.error("❌ Failed to add reaction:", err);
    }
  };

  const renderEmojis = (username) => {
    const userReactions = reactions[username] || {};

    const sorted = Object.entries(userReactions)
      .filter(([, users]) => users.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    if (sorted.length === 0) return null;

    // If a single emoji has exactly one reaction, show just the emoji
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

  // --- Admin reset: remove scores field from all users + clear reactions ---
  const resetScoresOnly = async () => {
    setResetLoading(true);
    try {
      const batch = writeBatch(db);

      // 1) Remove scores from all users (so they no longer appear in filtered list)
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach((d) => {
        batch.update(d.ref, { scores: deleteField() });
      });

      // 2) Delete all reaction docs (so emoji UI clears too)
      //    Assumes a top-level "reactions" collection with one doc per target username.
      const reactionsSnap = await getDocs(collection(db, "reactions"));
      reactionsSnap.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();
      console.log("✅ Leaderboard reset: scores removed and reactions cleared.");
    } catch (err) {
      console.error("❌ Failed to reset leaderboard:", err);
    } finally {
      setResetLoading(false);
    }
  };

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
      <div className="leaderboard-header-row">
        <button className="leaderboard-toggle-button">🌍 Global Leaderboard</button>

        {isAdmin && (
          <button
            className="leaderboard-reset-button"
            onClick={resetScoresOnly}
            disabled={resetLoading}
            title="Remove all scores and reactions (names will vanish from board)"
          >
            {resetLoading ? "Resetting..." : "Reset Leaderboard"}
          </button>
        )}
      </div>

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
