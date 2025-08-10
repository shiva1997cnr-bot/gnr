import React, { useRef, useEffect, useState } from "react";
import "../styles/region.css";
import { useNavigate } from "react-router-dom";
import hoverSound from "../assets/hover.mp3";
import * as XLSX from "xlsx";
import { getAllUserScores } from "../utils/firestoreUtils";
import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  collection,
  getDocs,
  writeBatch,
  setDoc,
  getDoc,
  Timestamp
} from "firebase/firestore";
import dayjs from "dayjs";
import Leaderboard from "./Leaderboard";

const Region = () => {
  const navigate = useNavigate();
  const audioRef = useRef(new Audio(hoverSound));

  const [userName, setUserName] = useState("User");
  const [bgLoaded, setBgLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [sinceLabel, setSinceLabel] = useState("Aug 1");
  const [lbLoading, setLbLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const isAdmin = currentUser?.role === "admin";

  const regions = [
    { code: "uscan", label: "US / CAN" },
    { code: "sa", label: "South Asia" },
    { code: "we", label: "Western Europe" },
    { code: "latam", label: "Latin America" },
    { code: "afr", label: "Africa" },
    { code: "esea", label: "ESEA" },
  ];

  // preload bg
  useEffect(() => {
    const img = new Image();
    img.src = "/region/world-map.webp";
    img.onload = () => setBgLoaded(true);
  }, []);

  // get username
  useEffect(() => {
    if (currentUser) {
      setUserName(currentUser.firstName || currentUser.username || "User");
    }
  }, [currentUser]);

  // countdown
  useEffect(() => {
    if (!selectedRegion) return;

    const unsub = onSnapshot(doc(db, "quizSchedule", selectedRegion), (snapshot) => {
      if (snapshot.exists()) {
        const nextQuizTime = snapshot.data().nextQuizTime;
        if (nextQuizTime) {
          const target = new Date(nextQuizTime).getTime();
          const timer = setInterval(() => {
            const now = Date.now();
            const diff = target - now;

            if (diff <= 0) {
              setTimeLeft("🚀 Quiz is live!");
              setIsLive(true);
              clearInterval(timer);
              return;
            } else {
              setIsLive(false);
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const format =
              days > 0
                ? `${days}d ${hours}h ${minutes}m ${seconds}s`
                : `${hours}h ${minutes}m ${seconds}s`;

            setTimeLeft(format);
          }, 1000);

          return () => clearInterval(timer);
        }
      }
    });

    return () => unsub();
  }, [selectedRegion]);

  // last reset date
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "leaderboard"));
        if (snap.exists() && snap.data().lastResetAt?.toDate) {
          setSinceLabel(dayjs(snap.data().lastResetAt.toDate()).format("MMM D"));
        }
      } catch {}
    })();
  }, []);

  const handleRegionClick = (regionCode) => {
    setSelectedRegion(regionCode);
    navigate(`/${regionCode}`, { state: { userName } });
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const playHoverSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleLiveClick = () => {
    navigate("/live");
  };

  const handleExportScores = async () => {
    try {
      const data = await getAllUserScores();
      if (data.length === 0) {
        alert("No scores available to export.");
        return;
      }
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "AllUserScores");
      XLSX.writeFile(workbook, "UserScores.xlsx");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Something went wrong while exporting.");
    }
  };

  const handleResetLeaderboard = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Reset leaderboard points and reactions for ALL users?")) return;

    try {
      setLbLoading(true);

      const usersSnap = await getDocs(collection(db, "users"));
      const userDocs = usersSnap.docs;

      for (let i = 0; i < userDocs.length; i += 450) {
        const batch = writeBatch(db);
        userDocs.slice(i, i + 450).forEach((d) => {
          batch.update(doc(db, "users", d.id), { scores: {} });
        });
        await batch.commit();
      }

      const reactionsSnap = await getDocs(collection(db, "reactions"));
      const reactionDocs = reactionsSnap.docs;
      for (let i = 0; i < reactionDocs.length; i += 450) {
        const batch = writeBatch(db);
        reactionDocs.slice(i, i + 450).forEach((d) => {
          batch.delete(doc(db, "reactions", d.id));
        });
        await batch.commit();
      }

      await setDoc(
        doc(db, "settings", "leaderboard"),
        { lastResetAt: Timestamp.now() },
        { merge: true }
      );

      setSinceLabel(dayjs().format("MMM D"));
      alert("Leaderboard and reactions reset complete.");
    } catch (e) {
      console.error(e);
      alert("Failed to reset leaderboard.");
    } finally {
      setLbLoading(false);
    }
  };

  return (
    <div
      className="region-page"
      style={{
        backgroundImage: bgLoaded
          ? "url('/region/world-map.webp')"
          : "linear-gradient(135deg, #1f1f1f, #3d3a3a)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundBlendMode: "multiply",
        transition: "background-image 0.6s ease-in-out",
      }}
    >
      {/* Header */}
      <div className="region-header">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
          {/* Go Live button below logout */}
          <button
            className={`live-quiz-button ${isLive ? "is-live" : ""}`}
            onClick={handleLiveClick}
            onMouseEnter={playHoverSound}
            title={isLive ? "Join the live quiz now!" : (isAdmin ? "Start/Manage a live quiz" : "See live quiz details")}
          >
            {isLive ? "Join Live Quiz" : (isAdmin ? "Go Live" : "Go Live")}
          </button>
        </div>
        {timeLeft && (
          <div className="quiz-timer">
            ⏳ Next quiz in: <span>{timeLeft}</span>
          </div>
        )}
        <div className="profile-circle" onClick={handleProfileClick} title="Go to your profile">
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Content */}
      <div className="region-container">
        <h1 className="region-title">
          Welcome, <span className="region-username animated-welcome">{userName}</span>!
        </h1>
        <h2 className="region-subtitle">Select Your Region</h2>

        <div className="region-grid">
          {regions.map((region) => (
            <div
              key={region.code}
              className="region-box"
              onClick={() => handleRegionClick(region.code)}
              onMouseEnter={playHoverSound}
            >
              {region.label}
            </div>
          ))}
        </div>

        <div className="leaderboard-wrapper">
          <Leaderboard />
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="admin-actions">
          <button
            className="admin-add-quiz-button"
            onClick={() => navigate("/admin-add-quiz")}
          >
            ➕ Add New Quiz
          </button>

          <button className="export-button" onClick={handleExportScores}>
            ⬇️ Download All User Scores
          </button>

          <button
            className="lb-startover-btn"
            onClick={handleResetLeaderboard}
            disabled={lbLoading}
          >
            {lbLoading ? "Resetting…" : "Reset Leaderboard"}
          </button>
          <span className="lb-info-text">
            Points from <strong>{sinceLabel}</strong>
          </span>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .live-quiz-button {
          position: absolute;
          top: 60px;   /* adjust vertical position */
          right: 20px;
          background: #22c55e;
          color: #0b1b0f;
          border: none;
          padding: 8px 14px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: 0.3px;
          margin-top: 6px;
          box-shadow: 0 4px 14px rgba(34, 197, 94, 0.25);
          cursor: pointer;
          transition: transform .12s ease, box-shadow .15s ease, background-color .15s ease, filter .15s ease;
        }
        .live-quiz-button:hover {
          background: #16a34a;
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(22, 163, 74, 0.35);
          filter: saturate(1.1);
        }
        .live-quiz-button.is-live {
          background: #16a34a;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(22, 163, 74, 0.45);
          animation: pulseGlow 1.6s ease-in-out infinite;
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 8px 20px rgba(22,163,74,.45); }
          50% { box-shadow: 0 10px 24px rgba(22,163,74,.6); }
        }
        .lb-startover-btn {
          background-color: #ff5252;
          color: #fff;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease, transform 0.15s ease;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          margin-left: 10px;
        }
        .lb-startover-btn:hover {
          background-color: #e53935;
          transform: translateY(-1px);
        }
        .lb-startover-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }
        .lb-info-text {
          font-size: 0.85rem;
          color: #ddd;
          font-style: italic;
          margin-left: 8px;
        }
        .lb-info-text strong {
          color: #fff;
        }
      `}</style>
    </div>
  );
};

export default Region;
