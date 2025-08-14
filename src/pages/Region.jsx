import React, { useRef, useEffect, useState } from "react";
import "../styles/region.css";
import { useNavigate } from "react-router-dom";
import hoverSound from "../assets/hover.mp3";
import * as XLSX from "xlsx";
import { getAllUserScores, isAdminUserDoc } from "../utils/firestoreUtils";
import { auth, db } from "../firebase";
import {
  doc,
  onSnapshot,
  collection,
  getDocs,
  getDoc,
} from "firebase/firestore";
import dayjs from "dayjs";
import Leaderboard from "./Leaderboard";

// Client-side fallback role check for localStorage user
const isAdminLikeLocal = (u) => {
  if (!u) return false;
  const r = String(u.role || "").toLowerCase();
  if (r === "admin" || r.startsWith("admin.")) return true;
  const roles = Array.isArray(u.roles) ? u.roles : [];
  return roles.some((x) => {
    const v = String(x || "").toLowerCase();
    return v === "admin" || v.startsWith("admin.");
  });
};

const Region = () => {
  const navigate = useNavigate();
  const audioRef = useRef(new Audio(hoverSound));

  const [userName, setUserName] = useState("User");
  const [bgLoaded, setBgLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(null);

  const [adminAllowed, setAdminAllowed] = useState(false);
  const [adminReady, setAdminReady] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem("currentUser") || "null"); }
    catch { return null; }
  })();

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

  // Page font: slim & modern (Inter)
  useEffect(() => {
    if (!document.getElementById("font-inter")) {
      const link = document.createElement("link");
      link.id = "font-inter";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // Display name
  useEffect(() => {
    if (currentUser) {
      setUserName(currentUser.firstName || currentUser.username || "User");
    }
  }, [currentUser]);

  // Robust admin access
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        const local = (() => {
          try { return JSON.parse(localStorage.getItem("currentUser") || "null"); } catch { return null; }
        })();

        const emailLc = (u?.email || "").toLowerCase();
        const localEmailLc = (local?.email || "").toLowerCase();
        const localUserLc = (local?.username || "").toLowerCase();

        const guesses = [
          u?.uid || null,
          emailLc || null,
          localEmailLc || null,
          localUserLc || null,
        ].filter(Boolean);

        let merged = { ...(local || {}) };
        const visited = new Set();
        for (const id of guesses) {
          if (visited.has(id)) continue;
          visited.add(id);
          try {
            const snap = await getDoc(doc(db, "users", id));
            if (snap.exists()) merged = { ...merged, ...snap.data() };
          } catch {}
        }
        if (u?.email && !merged.email) merged.email = u.email;

        const identifier = emailLc || localEmailLc || u?.uid || localUserLc || "";

        let okServer = false;
        try {
          okServer = await isAdminUserDoc(identifier, merged);
        } catch {
          okServer = false;
        }

        const okLocal = isAdminLikeLocal(local);
        setAdminAllowed(Boolean(okServer || okLocal));
      } catch (e) {
        console.error("Admin check error:", e);
        setAdminAllowed(isAdminLikeLocal(currentUser));
      } finally {
        setAdminReady(true);
      }
    });
    return () => unsub();
  }, []); // once

  // Close profile menu on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Countdown per selected region
  useEffect(() => {
    if (!selectedRegion) return;

    let timerId;
    const unsub = onSnapshot(doc(db, "quizSchedule", selectedRegion), (snapshot) => {
      if (!snapshot.exists()) return;

      const nextQuizTime = snapshot.data().nextQuizTime;
      if (!nextQuizTime) return;

      const target = new Date(nextQuizTime).getTime();

      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        const now = Date.now();
        const diff = target - now;

        if (diff <= 0) {
          setTimeLeft("🚀 Quiz is live!");
          setIsLive(true);
          clearInterval(timerId);
          return;
        } else {
          setIsLive(false);
        }

        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        const format = days > 0
          ? `${days}d ${hours}h ${minutes}m ${seconds}s`
          : `${hours}h ${minutes}m ${seconds}s`;

        setTimeLeft(format);
      }, 1000);
    });

    return () => {
      unsub();
      if (timerId) clearInterval(timerId);
    };
  }, [selectedRegion]);

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
      audioRef.current.play().catch(() => {});
    }
  };

  const handleProfileClick = () => navigate("/profile");
  const handleLiveClick = () => navigate("/live");

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

  // Topbar actions
  const gotoAbout = () => navigate("/about");
  const gotoFAQ = () => navigate("/faq");

  // Dynamic scores (admin vs user)
  const scoresLabel = adminAllowed ? "All Scores" : "My Scores";
  const gotoScores = () => navigate(adminAllowed ? "/allscores" : "/profile");

  return (
    <div
      className="region-page"
      style={{
        fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial",
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
      {/* Size tweaks without touching region.css */}
      <style>{`
        .region-topbar .topbar-left .toplink {
          font-size: 1.05rem;
          padding: 9px 14px;
        }
        .profile-circle::after {
          font-size: 16px !important;
        }
        .profile-menu .pm-item {
          font-size: 1.02rem;
        }
        .leaderboard-wrapper {
          transform: scale(1.08);
          transform-origin: top center;
        }
        @media (max-width: 920px) {
          .leaderboard-wrapper { transform: none; }
        }
      `}</style>

      {/* TOP BANNER */}
      <header className="region-topbar grid">
        <div className="topbar-left">
          <button className="toplink fullhover anim-btn" onClick={gotoAbout}>About</button>
          <button className="toplink fullhover anim-btn" onClick={gotoFAQ}>FAQ</button>
          <button className="toplink fullhover anim-btn" onClick={gotoScores}>{scoresLabel}</button>
        </div>

        <div className="topbar-center brand-wrap">
          <span className="brand-chip brand-fade">Generalist</span>
        </div>

        <div className="topbar-right">
          <div className="profile-wrap" ref={profileRef}>
            <div
              className="profile-circle anim-btn"
              onClick={() => setShowProfileMenu((v) => !v)}
              title="Profile"
              aria-label="Profile menu"
            />
            {showProfileMenu && (
              <div className="profile-menu">
                <div className="pmeta">Signed in as <strong>{userName}</strong></div>
                <button className="pm-item" onClick={handleProfileClick}>Profile</button>
                <button className="pm-item" onClick={() => navigate("/settings")}>Settings</button>
                <button className="pm-item" onClick={gotoScores}>{scoresLabel}</button>
                <button className="pm-item danger" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Fixed header controls */}
      <div className="region-header">
        <button
          className={`live-quiz-button ${isLive ? "is-live" : ""}`}
          onClick={handleLiveClick}
          onMouseEnter={playHoverSound}
          title={
            isLive
              ? "Join the live quiz now!"
              : (adminAllowed ? "Start/Manage a live quiz" : "See live quiz details")
          }
        >
          {isLive ? "Join Live Quiz" : (adminAllowed ? "Go Live" : "Go Live")}
        </button>

        {timeLeft && (
          <div className="quiz-timer">
            ⏳ Next quiz in: <span>{timeLeft}</span>
          </div>
        )}
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
          {/* Pass admin flag so the inline ♻️ shows to admins only */}
          <Leaderboard isAdmin={adminAllowed} />
        </div>
      </div>

      {/* Admin docks (export + add quiz only — reset moved into Leaderboard) */}
      {adminReady && adminAllowed && (
        <>
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
        </>
      )}
    </div>
  );
};

export default Region;
