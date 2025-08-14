import React, { useEffect, useMemo, useState } from "react";
import "../styles/adminquizview.css";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { isAdminUserDoc } from "../utils/firestoreUtils";

/* Local fallback: accept role "admin" or "admin.*" in localStorage */
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

export default function AdminQuizView() {
  const { region, quizId } = useParams();
  const navigate = useNavigate();

  const regionKey = useMemo(() => String(region || "").toLowerCase(), [region]);

  // Access control
  const [adminReady, setAdminReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Data
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [central, setCentral] = useState(null); // central mirror for drift check

  // Robust admin guard (matches Region/AdminAddQuiz)
  useEffect(() => {
    let mounted = true;
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        const local = (() => {
          try {
            return JSON.parse(localStorage.getItem("currentUser") || "null");
          } catch {
            return null;
          }
        })();

        const emailLc = (u?.email || "").toLowerCase();
        const localEmailLc = (local?.email || "").toLowerCase();
        const localUserLc = (local?.username || "").toLowerCase();

        const guesses = [u?.uid, emailLc, localEmailLc, localUserLc].filter(Boolean);
        let merged = { ...(local || {}) };
        const seen = new Set();
        for (const id of guesses) {
          if (seen.has(id)) continue;
          seen.add(id);
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

        if (mounted) setIsAdmin(Boolean(okServer || okLocal));
      } finally {
        if (mounted) setAdminReady(true);
      }
    });
    return () => {
      unsub();
      mounted = false;
    };
  }, []);

  // Load both regional (or live) and central
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const regionalRef = doc(db, regionKey, quizId);
        const centralRef = doc(db, "quizzes", quizId);
        const [rs, cs] = await Promise.all([getDoc(regionalRef), getDoc(centralRef)]);

        if (!rs.exists()) {
          alert("Quiz not found in region.");
          navigate("/admin-add-quiz");
          return;
        }

        const rdata = { id: rs.id, ...rs.data() };
        setQuiz(rdata);
        setCentral(cs.exists() ? { id: cs.id, ...cs.data() } : null);
      } catch (e) {
        console.error(e);
        alert("Failed to load quiz.");
        navigate("/admin-add-quiz");
      } finally {
        setLoading(false);
      }
    };
    if (adminReady && isAdmin && quizId && regionKey) load();
  }, [adminReady, isAdmin, quizId, regionKey, navigate]);

  const status = useMemo(() => {
    if (!quiz) return "Unknown";
    const now = Timestamp.now().seconds;
    const la = quiz?.launchAt?.seconds ?? null;
    if (!la) return "Unknown";
    return la > now ? "Pending" : "Published";
  }, [quiz]);

  const drift = useMemo(() => {
    if (!quiz || !central) return false;
    const titleMismatch = (quiz.title || "") !== (central.title || "");
    const shuffleMismatch = !!quiz.shufflePerUser !== !!central.shufflePerUser;
    const launchMismatch =
      (quiz.launchAt?.seconds ?? null) !== (central.launchAt?.seconds ?? null);
    return titleMismatch || shuffleMismatch || launchMismatch;
  }, [quiz, central]);

  // Gated rendering
  if (!adminReady) {
    return (
      <div className="aaq-admin-container">
        <div className="aaq-admin-form-section">Checking access…</div>
      </div>
    );
  }
  if (adminReady && !isAdmin) {
    return (
      <div className="aaq-admin-container">
        <div className="aaq-admin-form-section">
          <h2>Admin — View Quiz</h2>
          <p>Access denied.</p>
          <button className="aaq-back-button" onClick={() => navigate("/region")}>
            ⬅ Return
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="aaq-admin-container">
        <div className="aaq-admin-form-section">Loading…</div>
      </div>
    );
  }
  if (!quiz) {
    return (
      <div className="aaq-admin-container">
        <div className="aaq-admin-form-section">Quiz not found.</div>
      </div>
    );
  }

  return (
    <div className="aaq-admin-container">
      <div className="aaq-admin-form-section">
        <button className="aaq-back-button" onClick={() => navigate(-1)}>
          ⬅ Back
        </button>

        <h2>{quiz.title}</h2>

        <p style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span><strong>Region:</strong> {regionKey.toUpperCase()}</span>
          <span>
            <strong>Launch:</strong>{" "}
            {quiz.launchAt?.toDate ? quiz.launchAt.toDate().toLocaleString() : String(quiz.launchAt)}
          </span>
          <span><strong>Status:</strong> {status}</span>
          {typeof quiz.shufflePerUser !== "undefined" && (
            <span>
              <strong>Shuffle per user:</strong> {quiz.shufflePerUser ? "ON" : "OFF"}
            </span>
          )}
          {quiz.createdBy && (
            <span><strong>By:</strong> {quiz.createdBy}</span>
          )}
        </p>

        {drift && (
          <div
            style={{
              marginTop: 8,
              background: "#FEF3C7",
              border: "1px solid #FDE68A",
              color: "#92400E",
              padding: "8px 12px",
              borderRadius: 8,
            }}
          >
            <strong>Note:</strong> Central and {regionKey.toUpperCase()} quiz docs appear out of sync
            (title/launch/shuffle differ). Editing will update both.
          </div>
        )}

        <h3 style={{ marginTop: 20 }}>
          Questions <small>({(quiz.questions || []).length})</small>
        </h3>

        {(quiz.questions || []).map((q, i) => (
          <div key={i} className="aaq-question-card">
            <div className="aaq-question-card-header">
              <strong>Question {i + 1}</strong>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 8 }}>{q.question}</div>

            <div className="aaq-options-grid">
              {(q.options || []).map((opt, oi) => {
                const isCorrect = oi === Number(q.correctIndex);
                return (
                  <div key={oi} className="aaq-option-label" style={{ padding: "4px 0" }}>
                    <span className="aaq-option-text">Option {oi + 1}</span>
                    <input
                      type="text"
                      className="aaq-option-input"
                      value={opt}
                      readOnly
                      style={{
                        border: isCorrect ? "2px solid #10b981" : undefined,
                        background: isCorrect ? "#dcfce7" : undefined,
                        fontWeight: isCorrect ? 700 : 400,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={() => navigate(`/admin/quizzes/${regionKey}/${quiz.id}/edit`)}>
            Edit
          </button>
        </div>
      </div>

      {/* Right side kept empty to preserve layout spacing like AdminAddQuiz */}
      <div className="aaq-admin-list-section" />
    </div>
  );
}
