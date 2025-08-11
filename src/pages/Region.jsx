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

  // Preload background
  useEffect(() => {
    const img = new Image();
    img.src = "/region/world-map.webp";
    img.onload = () => setBgLoaded(true);
  }, []);

  // Get username
  useEffect(() => {
    if (currentUser) {
      setUserName(currentUser.firstName || currentUser.username || "User");
    }
  }, [currentUser]);

  // Countdown per selected region
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

  // Last reset date
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
      {/* Fixed header controls */}
      <div className="region-header">
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>

        <button
          className={`live-quiz-button ${isLive ? "is-live" : ""}`}
          onClick={handleLiveClick}
          onMouseEnter={playHoverSound}
          title={
            isLive
              ? "Join the live quiz now!"
              : (isAdmin ? "Start/Manage a live quiz" : "See live quiz details")
          }
        >
          {isLive ? "Join Live Quiz" : (isAdmin ? "Go Live" : "Go Live")}
        </button>

        {timeLeft && (
          <div className="quiz-timer">
            ⏳ Next quiz in: <span>{timeLeft}</span>
          </div>
        )}

        <div
          className="profile-circle"
          onClick={handleProfileClick}
          title="Go to your profile"
        >
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Centered content */}
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

      {/* Admin docks outside the card */}
      {isAdmin && (
        <>
          {/* Bottom-right: Add Quiz + Export, stacked with gap */}
          <div className="admin-dock">
            <button
              className="admin-add-quiz-button action-btn"
              onClick={() => navigate("/admin-add-quiz")}
            >
              ➕ Add New Quiz
            </button>

            <button
              className="export-button action-btn"
              onClick={handleExportScores}
            >
              ⬇️ Download All User Scores
            </button>
          </div>

          {/* Bottom-left: Reset + info label */}
          <div className="reset-dock">
            <button
              className="lb-startover-btn"
              onClick={handleResetLeaderboard}
              disabled={lbLoading}
              title="Reset leaderboard points & reactions for all users"
            >
              {lbLoading ? "Resetting…" : "Reset Leaderboard"}
            </button>
            <span className="lb-info-text">
              Points from <strong>{sinceLabel}</strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default Region;
