import React, { useEffect, useState } from "react";
import "../styles/leaderboard.css";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";
import {
  listenToReactions,
  addReaction,
  EMOJIS,
  resetLeaderboardNow,
} from "../utils/firestoreUtils";
import dayjs from "dayjs";

/**
 * Leaderboard
 * - Shows users only if they have at least one score entry
 * - Respects settings/leaderboard.lastResetAt (non-destructive reset window)
 *
 * Props:
 *  - forceExpand?: boolean — auto expand briefly
 *  - isAdmin?: boolean — show reset ♻️ icon
 */
const Leaderboard = ({ forceExpand = false, isAdmin = false }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserEntry, setCurrentUserEntry] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [autoExpandActive, setAutoExpandActive] = useState(forceExpand);

  const [reactions, setReactions] = useState({});
  const [hoveredUser, setHoveredUser] = useState(null);

  const [lastResetAt, setLastResetAt] = useState(null);
  const [sinceLabel, setSinceLabel] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  const subtleSinceStyle = {
    fontSize: "12px",
    opacity: 0.6,
    marginTop: "4px",
    lineHeight: 1.2,
  };
  const resetIconStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    fontSize: 16,
    lineHeight: 1,
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: resetLoading ? "default" : "pointer",
    opacity: resetLoading ? 0.5 : 0.9,
    transition: "transform .12s ease, opacity .12s ease",
  };

  // watch settings/leaderboard.lastResetAt
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "leaderboard"), (snap) => {
      const ts = snap?.data()?.lastResetAt;
      const dt = ts?.toDate ? ts.toDate() : null;
      setLastResetAt(dt);
      setSinceLabel(dt ? dayjs(dt).format("MMM D") : null);
    });
    return () => unsub();
  }, []);

  // parse attempt to Date
  const parseAttemptDate = (entry) => {
    if (!entry) return null;
    if (entry.date) {
      const d = dayjs(entry.date);
      if (d.isValid()) return d.toDate();
    }
    if (entry.dateOfAttempt) {
      const str = entry.timeOfAttempt
        ? `${entry.dateOfAttempt} ${entry.timeOfAttempt}`
        : entry.dateOfAttempt;
      const d = dayjs(str);
      if (d.isValid()) return d.toDate();
    }
    return null;
  };

  // live users + scores filtered by lastResetAt
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const users = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const scores = data.scores || {};

        let totalScore = 0;
        let totalTime = 0;
        let scoresCount = 0;

        Object.values(scores).forEach((entry) => {
          const when = parseAttemptDate(entry);
          if (lastResetAt && when && when < lastResetAt) return;

          if (!lastResetAt || (when && when >= lastResetAt)) {
            totalScore += Number(entry.score) || 0;
            totalTime += Number(entry.timeSpent) || 0;
            scoresCount += 1;
          }
        });

        users.push({
          username: docSnap.id,
          fullName:
            data.firstName ||
            data.firstname ||
            data.fullName ||
            docSnap.id,
          totalScore,
          totalTime,
          scoresCount,
        });
      });

      users.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.totalTime - b.totalTime;
      });

      const filtered = users.filter((u) => u.scoresCount > 0);
      setLeaderboard(filtered);

      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
      if (currentUser) {
        const idx = filtered.findIndex((u) => u.username === currentUser.username);
        if (idx !== -1) {
          setCurrentUserEntry({ ...filtered[idx], rank: idx + 1 });
        } else {
          setCurrentUserEntry(null);
        }
      }
    });

    const unsubReactions = listenToReactions(setReactions);
    return () => {
      unsubUsers();
      unsubReactions();
    };
  }, [lastResetAt]);

  useEffect(() => {
    if (forceExpand) {
      setExpanded(true);
      const t = setTimeout(() => {
        setExpanded(false);
        setAutoExpandActive(false);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [forceExpand]);

  const handleReact = async (targetUsername, emoji) => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
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

  // Admin reset (non-destructive): set lastResetAt = now
  const handleResetWindow = async () => {
    if (!isAdmin || resetLoading) return;

    const msg = [
      "♻️ Reset leaderboard window?",
      "",
      `This will restart the leaderboard from NOW (no quiz attempts are deleted).`,
      sinceLabel ? `Currently showing points since ${sinceLabel}.` : "",
      "",
      "Proceed?",
    ].join("\n");

    if (!window.confirm(msg)) return;
    try {
      setResetLoading(true);
      const who = JSON.parse(localStorage.getItem("currentUser") || "null")?.email;
      await resetLeaderboardNow({ by: who });
      // lastResetAt auto-updates via onSnapshot
    } catch (e) {
      console.error("❌ Failed to reset leaderboard:", e);
      alert("Failed to reset leaderboard.");
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
        {/* Single button: "Global Leaderboard" with inline reset icon (inside) */}
        <button
          className="leaderboard-toggle-button"
          onClick={() => setExpanded((v) => !v)}
          title="Toggle leaderboard"
        >
          🌍 Global Leaderboard
          {isAdmin && (
            <span
              role="button"
              aria-label="Reset leaderboard window"
              title={
                sinceLabel
                  ? `Reset leaderboard window. Currently showing from ${sinceLabel}. Starts counting from now (no data deleted).`
                  : `Reset leaderboard window. Starts counting from now (no data deleted).`
              }
              style={resetIconStyle}
              onClick={(e) => {
                e.stopPropagation(); // don't toggle the leaderboard
                handleResetWindow();
              }}
              onMouseEnter={(e) => {
                if (!resetLoading) e.currentTarget.style.transform = "rotate(18deg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "rotate(0deg)";
              }}
            >
              {resetLoading ? "…" : "♻️"}
            </span>
          )}
        </button>

        {/* subtle 'since' line under the headline */}
        {sinceLabel && (
          <div className="since-subtle" style={subtleSinceStyle}>
            since {sinceLabel} <span style={{ opacity: 0.5 }}></span>
          </div>
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
