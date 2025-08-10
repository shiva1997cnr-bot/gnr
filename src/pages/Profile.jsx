import { useNavigate } from "react-router-dom";
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";
import "../styles/profile.css";

const REGIONS = ["uscan", "we", "afr", "sa", "esea", "latam"];

const Profile = () => {
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [userRole, setUserRole] = useState("user");

  const [allQuizzes, setAllQuizzes] = useState([]);
  const [qLoading, setQLoading] = useState(true);

  const [regionFilter, setRegionFilter] = useState("all");
  const [attemptedByMe, setAttemptedByMe] = useState(new Set());

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserScores = async () => {
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUserRole(currentUser.role || "user");

      const userRef = doc(db, "users", currentUser.username);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        let extractedFirstName = "";
        if (userData.firstname) extractedFirstName = userData.firstname;
        else if (userData.fullName) extractedFirstName = userData.fullName.split(" ")[0];
        else extractedFirstName = currentUser.username.split("@")[0];

        setFirstName(extractedFirstName);
        setScores(userData.scores || {});
      }
      setLoading(false);
    };
    fetchUserScores();
  }, []);

  useEffect(() => {
    const loadAllRegionQuizzes = async () => {
      setQLoading(true);
      try {
        const fetches = REGIONS.map(async (rk) => {
          const snap = await getDocs(query(collection(db, rk), orderBy("launchAt", "desc")));
          return snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              region: rk,
              title: data.title || "Untitled",
              launchAt: data.launchAt,
              createdBy: data.createdBy || "Unknown", // kept in state, but hidden from UI
              status: data.status,
            };
          });
        });
        const flat = (await Promise.all(fetches)).flat();
        setAllQuizzes(
          flat.sort((a, b) => (b.launchAt?.seconds || 0) - (a.launchAt?.seconds || 0))
        );
      } catch (e) {
        console.error("Failed to load quizzes across regions:", e);
      } finally {
        setQLoading(false);
      }
    };
    loadAllRegionQuizzes();
  }, []);

  const quizIdToRegion = useMemo(() => {
    const map = {};
    for (const q of allQuizzes) map[q.id] = q.region;
    return map;
  }, [allQuizzes]);

  useEffect(() => {
    const checkAttempts = async () => {
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      if (!currentUser || allQuizzes.length === 0) {
        setAttemptedByMe(new Set());
        return;
      }

      const results = await Promise.all(
        allQuizzes.map(async (q) => {
          try {
            const direct = await getDoc(doc(db, `quizScores_${q.id}`, currentUser.username));
            if (direct.exists()) return q.id;

            const fallback = await getDocs(
              query(
                collection(db, `quizScores_${q.id}`),
                where("userId", "==", currentUser.username),
                limit(1)
              )
            );
            return fallback.size > 0 ? q.id : null;
          } catch {
            return null;
          }
        })
      );

      setAttemptedByMe(new Set(results.filter(Boolean)));
    };

    checkAttempts();
  }, [allQuizzes]);

  const { pendingQuizzes, completedQuizzes } = useMemo(() => {
    const nowSec = Timestamp.now().seconds;
    const filtered =
      regionFilter === "all"
        ? allQuizzes
        : allQuizzes.filter((q) => q.region === regionFilter);

    const published = filtered.filter((q) => {
      const liveByTime = q.launchAt && q.launchAt.seconds <= nowSec;
      const statusOk = q.status ? q.status === "published" : true;
      return liveByTime && statusOk;
    });

    return {
      pendingQuizzes: published.filter((q) => !attemptedByMe.has(q.id)),
      completedQuizzes: published.filter((q) => attemptedByMe.has(q.id)),
    };
  }, [allQuizzes, regionFilter, attemptedByMe]);

  const formatRegionName = (name) =>
    name
      ? name.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "";

  const getFeedback = (score) =>
    score > 9 ? "Excellent" : score >= 8 ? "Impressive" : "Needs Improvement";

  const getFeedbackIcon = (score) =>
    score > 9 ? "🌟" : score >= 8 ? "👍" : "📈";

  const openQuizRegion = (q) => navigate(`/region/${q.region}`);

  return (
    <>
      <div className="profile-banner">
        <div className="banner-overlay">
          <h1 className="banner-title">Generalist</h1>
          <p className="banner-subtitle">Performance Overview</p>
        </div>
        <div className="return-btn-container">
          <button className="profile-return-circle" onClick={() => navigate("/region")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div className="profile-two-col">
        {/* LEFT: Pending + Completed */}
        <aside className="profile-left">
          <div className="left-header">
            <h2 className="left-title">Quizzes</h2>
            <div className="left-filters">
              <label>Region:</label>
              <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                <option value="all">All</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <section className="quiz-section">
            <h3 className="quiz-section-title">Pending Quizzes</h3>
            {qLoading ? (
              <p className="tiny-loading">Loading…</p>
            ) : pendingQuizzes.length === 0 ? (
              <p className="empty-state">
                No pending quizzes{regionFilter !== "all" ? ` for ${regionFilter.toUpperCase()}` : ""}.
              </p>
            ) : (
              <ul className="quiz-list">
                {pendingQuizzes.map((q) => (
                  <li key={`p_${q.region}_${q.id}`} className="quiz-item">
                    <div className="quiz-meta">
                      <strong>{q.title}</strong>
                      <div className="quiz-sub">
                        <span className="chip">{q.region.toUpperCase()}</span>
                        <span className="dot">•</span>
                        <span>{q.launchAt?.toDate ? q.launchAt.toDate().toLocaleString() : "—"}</span>
                        {/* creator hidden */}
                      </div>
                    </div>
                    <button className="quiz-open-btn" onClick={() => openQuizRegion(q)}>Open</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="quiz-section">
            <h3 className="quiz-section-title">Completed Quizzes</h3>
            {qLoading ? (
              <p className="tiny-loading">Loading…</p>
            ) : completedQuizzes.length === 0 ? (
              <p className="empty-state">
                No completed quizzes{regionFilter !== "all" ? ` for ${regionFilter.toUpperCase()}` : ""}.
              </p>
            ) : (
              <ul className="quiz-list">
                {completedQuizzes.slice(0, 6).map((q) => (
                  <li key={`c_${q.region}_${q.id}`} className="quiz-item">
                    <div className="quiz-meta">
                      <strong>{q.title}</strong>
                      <div className="quiz-sub">
                        <span className="chip">{q.region.toUpperCase()}</span>
                        <span className="dot">•</span>
                        <span>{q.launchAt?.toDate ? q.launchAt.toDate().toLocaleString() : "—"}</span>
                        {/* creator hidden */}
                      </div>
                    </div>
                    {/* Replace Open button with green tick icon (non-clickable) */}
                    <span className="quiz-completed-icon" title="Completed" aria-label="Completed">
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
                        <path d="M8 12l3 3 5-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* RIGHT: User performance table */}
        <main className="profile-right">
          <div className="profile-header">
            <h2 className="animated-name">{firstName}'s Performance</h2>
            <p className="subtitle">Here is your region-wise analysis:</p>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p className="loading-text">Loading scores...</p>
            </div>
          ) : userRole === "admin" ? (
            <div className="admin-hint">
              Admins do not have personal scores. Manage quizzes from the{" "}
              <a onClick={() => navigate("/admin-add-quiz")} style={{ cursor: "pointer" }}>Admin page</a>.
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
                {Object.entries(scores).map(([quizId, data], index) => {
                  const regionCode = data.region || quizIdToRegion[quizId] || "";
                  return (
                    <tr key={quizId} style={{ animationDelay: `${index * 0.1}s` }}>
                      <td>{formatRegionName(regionCode) || "—"}</td>
                      <td>{data.score}</td>
                      <td className="feedback-cell">
                        {getFeedback(data.score)}
                        <span
                          className="feedback-icon"
                          style={{ animationDelay: `${index * 0.1 + 0.5}s` }}
                        >
                          {getFeedbackIcon(data.score)}
                        </span>
                      </td>
                      <td>{data.timeSpent}</td>
                      <td>{data.timestamp || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </>
  );
};

export default Profile;
