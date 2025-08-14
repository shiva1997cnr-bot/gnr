// src/pages/AdminAddQuiz.jsx
import "../styles/adminaddquiz.css";
import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  Timestamp,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  writeBatch,
  limit as qLimit,
} from "firebase/firestore";
import dayjs from "dayjs";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import * as XLSX from "xlsx";
import { getQuizScores, isAdminUserDoc } from "../utils/firestoreUtils";

const REGIONS = ["uscan", "we", "afr", "sa", "esea", "latam"];

/* ---------------- helpers ---------------- */
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const safeFile = (s) => (s || "Quiz").replace(/[\\/:*?\"<>|]+/g, "_");
const getAdminConfirmSecret = () =>
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_ADMIN_CONFIRM) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_ADMIN_CONFIRM) ||
  "";

// client-side fallback role check for localStorage user
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

/* ---------------- data utils (lists / CRUD) ---------------- */
export const getQuizzesByRegion = async (regionKey) => {
  try {
    const qSnap = await getDocs(collection(db, regionKey));
    return qSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error("❌ Error fetching quizzes for region:", regionKey, error);
    return [];
  }
};

export const getQuizById = async (regionKey, quizId) => {
  try {
    const quizRef = doc(db, regionKey, quizId);
    const quizSnap = await getDoc(quizRef);
    if (!quizSnap.exists()) return null;
    return { id: quizSnap.id, ...quizSnap.data() };
  } catch (error) {
    console.error("❌ Error fetching quiz:", error);
    return null;
  }
};

export const deleteQuizById = async (regionKey, quizId) => {
  try {
    await deleteDoc(doc(db, regionKey, quizId));
    console.log(`✅ Deleted quiz ${quizId} from ${regionKey}`);
  } catch (error) {
    console.error("❌ Error deleting quiz:", error);
  }
};

export const updateQuizById = async (regionKey, quizId, updatedData) => {
  try {
    await updateDoc(doc(db, regionKey, quizId), {
      ...updatedData,
      updatedAt: dayjs().toISOString(),
    });
    console.log(`✅ Updated quiz ${quizId} in ${regionKey}`);
  } catch (error) {
    console.error("❌ Error updating quiz:", error);
  }
};

/* ---------------- component ---------------- */
export default function AdminAddQuiz() {
  const navigate = useNavigate();

  // Access control
  const [adminReady, setAdminReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");

  // Create form state
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("afr");
  const [launchDateTime, setLaunchDateTime] = useState("");
  const [questions, setQuestions] = useState([
    {
      question: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      // NEW feedback fields
      correctTitle: "",
      correctBody: "",
      wrongTitle: "",
      wrongBody: "",
    },
  ]);
  const [shufflePerUser, setShufflePerUser] = useState(false);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);
  const [isLive, setIsLive] = useState(false);

  const [saving, setSaving] = useState(false);

  // Lists (region)
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [previousQuizzes, setPreviousQuizzes] = useState([]);
  // Lists (LIVE)
  const [livePending, setLivePending] = useState([]);
  const [livePrevious, setLivePrevious] = useState([]);

  // Draft preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // Delete-all-scores modal
  const [deleteScoresOpen, setDeleteScoresOpen] = useState(false);
  const [deleteTargetQuizId, setDeleteTargetQuizId] = useState("");
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState("");

  /* ---------- Auth + robust admin check (matches Region.jsx) ---------- */
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

        // Merge any users/{id} docs we find (uid, email, username)
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

        if (mounted) {
          setIsAdmin(Boolean(okServer || okLocal));
          // Best-effort display name
          const n =
            merged.firstName ||
            merged.displayName ||
            merged.name ||
            (merged.email ? merged.email.split("@")[0] : "") ||
            "Admin";
          setAdminName(n);
        }
      } finally {
        if (mounted) setAdminReady(true);
      }
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  /* ---------- Load region & live lists after admin verified ---------- */
  useEffect(() => {
    if (!adminReady || !isAdmin) return;
    fetchRegionQuizzes(region);
    fetchLiveQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, adminReady, isAdmin]);

  const allRegionQuizzes = useMemo(
    () => [...pendingQuizzes, ...previousQuizzes],
    [pendingQuizzes, previousQuizzes]
  );

  useEffect(() => {
    if (allRegionQuizzes.length > 0) {
      setDeleteTargetQuizId((prev) => prev || allRegionQuizzes[0].id);
    } else {
      setDeleteTargetQuizId("");
    }
  }, [allRegionQuizzes]);

  const splitByTime = (docs) => {
    const now = Timestamp.now();
    const pending = [];
    const previous = [];
    docs.forEach((docSnap) => {
      const data = docSnap.data();
      const quiz = { id: docSnap.id, ...data };
      if (quiz.launchAt && quiz.launchAt.seconds > now.seconds) pending.push(quiz);
      else previous.push(quiz);
    });
    return { pending, previous };
  };

  const fetchRegionQuizzes = async (selectedRegion) => {
    try {
      const qSnap = await getDocs(
        query(collection(db, selectedRegion), orderBy("launchAt", "desc"))
      );
      const { pending, previous } = splitByTime(qSnap.docs);
      setPendingQuizzes(pending);
      setPreviousQuizzes(previous);
    } catch (err) {
      console.error("Error fetching quizzes:", err);
      alert("Failed to load quizzes.");
    }
  };

  const fetchLiveQuizzes = async () => {
    try {
      const qSnap = await getDocs(query(collection(db, "live"), orderBy("launchAt", "desc")));
      const { pending, previous } = splitByTime(qSnap.docs);
      setLivePending(pending);
      setLivePrevious(previous);
    } catch (err) {
      console.error("Error fetching live quizzes:", err);
    }
  };

  /* ---------- Deletes ---------- */
  const deleteQuiz = async (quizId, col) => {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await deleteQuizById(col || region, quizId);
      await Promise.all([fetchRegionQuizzes(region), fetchLiveQuizzes()]);
      alert("Quiz deleted successfully.");
    } catch (err) {
      console.error("Error deleting quiz:", err);
      alert("Failed to delete quiz.");
    }
  };

  const deleteAllScoresForQuiz = async (quizId, password) => {
    const secret = getAdminConfirmSecret();
    if (!secret) {
      alert(
        "Admin confirmation password is not configured. Set VITE_ADMIN_CONFIRM (Vite) or REACT_APP_ADMIN_CONFIRM (CRA)."
      );
      return;
    }
    if (!password || password !== secret) {
      alert("Incorrect password. Aborting.");
      return;
    }

    const confirm1 = window.confirm(
      "⚠️ FINAL WARNING:\nThis will permanently delete ALL user scores for the selected quiz.\nThis cannot be undone.\n\nDo you want to continue?"
    );
    if (!confirm1) return;

    try {
      let totalDeleted = 0;
      while (true) {
        const snap = await getDocs(query(collection(db, `quizScores_${quizId}`), qLimit(500)));
        if (snap.empty) break;
        const batch = writeBatch(db);
        snap.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        totalDeleted += snap.size;
        if (snap.size < 500) break;
      }
      alert(
        totalDeleted > 0
          ? `✅ Deleted ${totalDeleted} score${totalDeleted === 1 ? "" : "s"} for this quiz.`
          : "No scores found for this quiz."
      );
    } catch (error) {
      console.error("Error deleting all scores:", error);
      alert("❌ Failed to delete scores. Check console for details.");
    }
  };

  /* ---------- Nav helpers ---------- */
  const viewRegion = (quiz) => navigate(`/admin/quizzes/${region}/${quiz.id}`);
  const editRegion = (quiz) => navigate(`/admin/quizzes/${region}/${quiz.id}/edit`);
  const viewLive = (quiz) => navigate(`/admin/quizzes/live/${quiz.id}`);
  const editLive = (quiz) => navigate(`/admin/quizzes/live/${quiz.id}/edit`);

  /* ---------- Form helpers ---------- */
  const updateQuestion = (qIndex, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, ...patch } : q)));
  };
  const updateOption = (qIndex, optIndex, value) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((opt, oi) => (oi === optIndex ? value : opt)) }
          : q
      )
    );
  };
  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        correctTitle: "",
        correctBody: "",
        wrongTitle: "",
        wrongBody: "",
      },
    ]);
  };
  const removeQuestion = (index) => setQuestions((prev) => prev.filter((_, i) => i !== index));

  const validate = () => {
    if (!isAdmin) {
      alert("Access denied — admin only.");
      return false;
    }
    if (!title.trim()) {
      alert("Please provide a quiz title.");
      return false;
    }
    if (!launchDateTime) {
      alert("Please select a launch date & time.");
      return false;
    }
    if (!isLive && !REGIONS.includes(region)) {
      alert("Please select a valid region.");
      return false;
    }

    const t = Number(timeLimitSeconds);
    if (!Number.isFinite(t) || t < 5 || t > 300) {
      alert("Please set a time limit between 5 and 300 seconds.");
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.question.toString().trim()) {
        alert(`Question ${i + 1} is empty.`);
        return false;
      }
      const opts = (q.options || []).map((o) => (o ?? "").toString().trim());
      for (let j = 0; j < opts.length; j++) {
        if (!opts[j]) {
          alert(`Option ${j + 1} for question ${i + 1} is empty.`);
          return false;
        }
      }
      const idx = Number(q.correctIndex);
      if (isNaN(idx) || idx < 0 || idx >= opts.length) {
        alert(`Please set a valid correct option for question ${i + 1}.`);
        return false;
      }
    }
    return true;
  };

  /* ---------- Save ---------- */
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const launchDate = new Date(launchDateTime);
      if (isNaN(launchDate.getTime())) throw new Error("Invalid launch date/time");

      const normalizedQuestions = questions.map((q) => {
        const opts = (q.options || []).map((o) => (o ?? "").toString().trim());
        while (opts.length < 4) opts.push("");
        const idx = Number(q.correctIndex || 0);
        const correctIndex = isNaN(idx) || idx < 0 || idx >= opts.length ? 0 : idx;
        const answer = opts[correctIndex] ?? "";
        // NEW: carry feedback fields through
        const correctTitle = (q.correctTitle ?? "").toString().trim();
        const correctBody = (q.correctBody ?? "").toString().trim();
        const wrongTitle = (q.wrongTitle ?? "").toString().trim();
        const wrongBody = (q.wrongBody ?? "").toString().trim();

        return {
          question: (q.question ?? "").toString().trim(),
          options: opts,
          correctIndex,
          answer,
          correctTitle,
          correctBody,
          wrongTitle,
          wrongBody,
        };
      });

      const payload = {
        title: title.trim(),
        launchAt: Timestamp.fromDate(launchDate),
        questions: normalizedQuestions,
        createdAt: Timestamp.now(),
        createdBy: adminName || "Admin",
        shufflePerUser: !!shufflePerUser,
        timeLimitSeconds: Number(timeLimitSeconds),
        maxAttemptsPerUser: 1,
        isLive: !!isLive,
      };

      // Shared central doc (for analytics/downloads)
      const centralRef = doc(collection(db, "quizzes"));
      const sharedId = centralRef.id;
      await setDoc(centralRef, { ...payload, region: isLive ? "live" : region });

      if (isLive) {
        // LIVE: Save only under 'live'
        await setDoc(doc(db, "live", sharedId), payload);
        // Prepare live session state
        await setDoc(
          doc(db, "live_sessions", sharedId),
          {
            quizId: sharedId,
            status: "scheduled", // scheduled | live | ended
            isLive: true,
            currentQuestionIndex: 0,
            currentQuestionStartAt: null,
            startedAt: null,
            endedAt: null,
            hostUid: null,
            hostEmail: null,
            createdAt: Timestamp.now(),
          },
          { merge: true }
        );
      } else {
        // REGION
        await setDoc(doc(db, region, sharedId), payload);
      }

      alert(`Quiz saved successfully${isLive ? " as LIVE" : ` to ${region.toUpperCase()}`}.`);

      // reset form
      setTitle("");
      setLaunchDateTime("");
      setRegion("afr");
      setQuestions([
        {
          question: "",
          options: ["", "", "", ""],
          correctIndex: 0,
          correctTitle: "",
          correctBody: "",
          wrongTitle: "",
          wrongBody: "",
        },
      ]);
      setShufflePerUser(false);
      setTimeLimitSeconds(30);
      setIsLive(false);

      // refresh lists
      await Promise.all([fetchRegionQuizzes(region), fetchLiveQuizzes()]);
    } catch (err) {
      console.error("Error saving quiz:", err);
      alert("Error saving quiz.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Download ---------- */
  const downloadScores = async (quiz, regionKeyOrLive) => {
    try {
      const quizId = quiz?.id;
      if (!quizId) {
        alert("Missing quiz id.");
        return;
      }

      let scores = [];
      try {
        scores = await getQuizScores(regionKeyOrLive, quizId);
      } catch (_) {}
      if (!Array.isArray(scores) || scores.length === 0) {
        try {
          scores = await getQuizScores(quizId);
        } catch (_) {}
      }
      if (!Array.isArray(scores) || scores.length === 0) {
        alert("No scores found for this quiz.");
        return;
      }

      const userIds = Array.from(
        new Set(
          scores
            .map((s) => s.uid || s.userId || s.authUid || s.userUID || s.user_id)
            .filter(Boolean)
        )
      );
      const userMap = {};
      if (userIds.length > 0) {
        const batches = chunk(userIds, 10);
        for (const ids of batches) {
          const snaps = await Promise.all(
            ids.map((id) => getDoc(doc(db, "users", id)))
          ); // eslint-disable-line no-await-in-loop
          snaps.forEach((snap) => {
            if (snap.exists()) {
              const data = snap.data() || {};
              userMap[snap.id] = {
                displayName:
                  data.displayName ||
                  data.name ||
                  [data.firstName, data.lastName].filter(Boolean).join(" ") ||
                  "",
                email: data.email || "",
              };
            }
          });
        }
      }

      const rows = scores.map((s) => {
        const idKey = s.uid || s.userId || s.authUid || s.userUID || s.user_id || "";
        const profile = (idKey && userMap[idKey]) || {};
        const attemptedAt =
          s.dateOfAttempt && s.timeOfAttempt
            ? `${s.dateOfAttempt} ${s.timeOfAttempt}`
            : s.attemptedAt?.toDate
            ? s.attemptedAt.toDate().toLocaleString()
            : s.attemptedAt || "";

        return {
          userName:
            s.userName ||
            s.name ||
            (s.firstName || s.lastName ? `${s.firstName || ""} ${s.lastName || ""}`.trim() : "") ||
            profile.displayName ||
            "",
          userEmail: s.userEmail || s.email || profile.email || "",
          score: typeof s.score === "number" ? s.score : Number(s.score ?? 0),
          total: typeof s.total === "number" ? s.total : Number(s.total ?? 0),
          percentage:
            typeof s.score === "number" && typeof s.total === "number" && s.total > 0
              ? Math.round((s.score / s.total) * 100)
              : "",
          dateOfAttempt: s.dateOfAttempt || "",
          timeOfAttempt: s.timeOfAttempt || "",
          attemptedAt,
          region: s.region || regionKeyOrLive || "",
          quizId,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Scores");
      XLSX.writeFile(wb, `${safeFile(quiz.title)}_${quizId}_Scores.xlsx`);
    } catch (error) {
      console.error("Error downloading scores:", error);
      alert("Failed to download scores.");
    }
  };

  const draftQuizForPreview = {
    id: "DRAFT",
    title,
    launchAt: launchDateTime ? { toDate: () => new Date(launchDateTime) } : null,
    questions: questions.map((q) => {
      const opts = (q.options || []).map((o) => (o ?? "").toString().trim());
      const idx = Number(q.correctIndex || 0);
      const correctIndex = isNaN(idx) || idx < 0 || idx >= opts.length ? 0 : idx;
      return {
        question: q.question,
        options: opts,
        correctIndex,
        answer: opts[correctIndex] || "",
        // include feedback for preview
        correctTitle: q.correctTitle || "",
        correctBody: q.correctBody || "",
        wrongTitle: q.wrongTitle || "",
        wrongBody: q.wrongBody || "",
      };
    }),
    createdBy: adminName || "Admin",
    shufflePerUser,
    timeLimitSeconds: Number(timeLimitSeconds) || 30,
    isLive: !!isLive,
  };

  /* ---------- gated rendering ---------- */
  if (!adminReady) {
    return (
      <div className="aaq-admin-container">
        <div className="aaq-admin-form-section">Checking access…</div>
      </div>
    );
  }

  if (adminReady && !isAdmin) {
    return (
      <div className="aaq-admin-denied">
        <h2>Admin — Add Quiz</h2>
        <p>Access denied.</p>
        <button className="aaq-back-button" onClick={() => navigate("/")}>
          <FaArrowLeft /> Return Home
        </button>
      </div>
    );
  }

  /* ---------- main UI ---------- */
  return (
    <div className="aaq-admin-container">
      {/* Inline styles for toggle + colored buttons + animations */}
      <style>{`
        .aaq-hero-glow{position:relative; isolation:isolate;}
        .aaq-hero-glow::before{content:""; position:absolute; inset:-2px; background:
          radial-gradient(60% 60% at 10% 10%, rgba(80,200,255,.25), transparent 60%),
          radial-gradient(60% 60% at 90% 20%, rgba(0,255,150,.18), transparent 60%),
          radial-gradient(70% 80% at 50% 100%, rgba(255,160,50,.12), transparent 70%);
          filter:blur(18px); z-index:-1; animation:aaqGlow 6s ease-in-out infinite alternate;}
        @keyframes aaqGlow{0%{transform:translateY(0);opacity:.8}100%{transform:translateY(4px);opacity:1}}

        .live-toggle{
          --on:#16a34a; --off:#cbd5e1;
          display:inline-flex; align-items:center; gap:10px; padding:6px 10px;
          border-radius:999px; border:2px solid #e5e7eb; background:var(--bg,#f1f5f9);
          cursor:pointer; user-select:none; transition:transform .15s ease, box-shadow .2s ease;
          box-shadow:0 6px 18px rgba(0,0,0,.08), inset 0 0 0 1px rgba(255,255,255,.6);
        }
        .live-toggle:hover{transform:translateY(-1px); box-shadow:0 10px 22px rgba(0,0,0,.12)}
        .live-toggle.on{--bg:linear-gradient(90deg,#22c55e,#16a34a); color:#fff; border-color:#10b981}
        .live-toggle.off{--bg:#e5e7eb; color:#334155}
        .live-toggle .track{width:62px; height:30px; border-radius:999px; background:rgba(255,255,255,.55); position:relative; overflow:hidden; box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
        .live-toggle .knob{position:absolute; top:3px; left:3px; width:24px; height:24px; border-radius:50%; background:linear-gradient(#fff,#eaeaea); box-shadow:0 3px 10px rgba(0,0,0,.18); transition:left .18s ease}
        .live-toggle.on .knob{left:35px}

        .live-badge{display:inline-flex; align-items:center; gap:6px; background:rgba(239,68,68,.10); color:#ef4444; border:1px solid rgba(239,68,68,.35); font-weight:700; padding:2px 8px; border-radius:999px; font-size:12px; text-transform:uppercase; letter-spacing:.4px;}
        .pulse-dot{width:8px;height:8px;background:#ef4444;border-radius:50%;box-shadow:0 0 0 0 rgba(239,68,68,.6);animation:pulse 1.7s infinite}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.6)}70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}

        .list-item-appear{animation:itemIn .35s ease both}
        @keyframes itemIn{from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)}}

        .action-btn-emoji{display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:12px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; transition:transform .12s ease, box-shadow .15s ease}
        .action-btn-emoji:hover{transform:translateY(-1px); box-shadow:0 8px 18px rgba(0,0,0,.08)}
        .btn-view{background:#FEF9C3; border-color:#FDE68A; color:#854D0E}
        .btn-edit{background:#DBEAFE; border-color:#BFDBFE; color:#1E3A8A}
        .btn-download{background:#DCFCE7; border-color:#BBF7D0; color:#065F46}
        .btn-danger{background:#FEE2E2; border-color:#FECACA; color:#991B1B}
        .is-pending{background:linear-gradient(180deg, rgba(59,130,246,.05), transparent)}
      `}</style>

      <div className="aaq-admin-form-section aaq-hero-glow">
        <button onClick={() => navigate(`/region`)} className="aaq-back-button">
          <FaArrowLeft /> Back to Home
        </button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2>Create New Quiz</h2>
          {/* curved pill toggle */}
          <button
            type="button"
            className={`live-toggle ${isLive ? "on" : "off"}`}
            aria-pressed={isLive}
            title={isLive ? "Live mode ON" : "Live mode OFF"}
            onClick={() => setIsLive((v) => !v)}
          >
            <div className="track">
              <div className="knob" />
            </div>
            <strong>{isLive ? "LIVE: ON" : "LIVE: OFF"}</strong>
          </button>
        </div>

        <FormField label="Quiz Title">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>

        <div className="aaq-form-group">
          <FormField label="Launch Date & Time" className="aaq-form-field-flex">
            <input
              type="datetime-local"
              value={launchDateTime}
              onChange={(e) => setLaunchDateTime(e.target.value)}
            />
          </FormField>

          <FormField label="Region" className="aaq-form-field-region">
            <select value={region} onChange={(e) => setRegion(e.target.value)} disabled={isLive}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
            {isLive && <small className="aaq-hint">Disabled in Live mode</small>}
          </FormField>
        </div>

        <FormField label="Time limit per question (seconds)">
          <input
            type="number"
            min={5}
            max={300}
            step={1}
            value={timeLimitSeconds}
            onChange={(e) => setTimeLimitSeconds(e.target.value)}
            placeholder="e.g., 30"
          />
          <small className="aaq-hint">Allowed range: 5–300 seconds. Default 30s.</small>
        </FormField>

        <FormField label="Shuffle questions for each user">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={shufflePerUser}
              onChange={(e) => setShufflePerUser(e.target.checked)}
            />
            <span className="aaq-hint">Randomize question order per user attempt</span>
          </label>
        </FormField>

        {isLive && (
          <div style={{ marginTop: 6 }}>
            <span className="live-badge">
              <span className="pulse-dot" /> Live quiz will appear on the Live page only
            </span>
          </div>
        )}

        <h3 style={{ marginTop: 18 }}>Questions</h3>

        {questions.map((q, qi) => (
          <QuestionCard
            key={qi}
            index={qi}
            question={q}
            onQuestionChange={(patch) => updateQuestion(qi, patch)}
            onOptionChange={(oi, val) => updateOption(qi, oi, val)}
            onRemove={() => removeQuestion(qi)}
            canRemove={questions.length > 1}
          />
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={addQuestion} className="aaq-add-question-btn">
            + Add Question
          </button>
          <button onClick={() => setPreviewOpen(true)} disabled={!title && questions.length === 0}>
            Preview Draft
          </button>
        </div>

        <div className="aaq-save-btn-container" style={{ marginTop: 12 }}>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Quiz"}
          </button>
        </div>
      </div>

      <div className="aaq-admin-list-section">
        {/* Top toolbar — right corner delete-all-scores */}
        <div
          className="aaq-toolbar"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}
        >
          <div />
          <button
            className="aaq-delete-scores-toolbar-btn"
            style={{
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
            onClick={() => setDeleteScoresOpen(true)}
            title="Delete ALL user scores for a selected quiz"
          >
            Delete All Scores
          </button>
        </div>

        {/* ==== LIVE HOST SECTION (above pending) ==== */}
        <QuizList
          title="🎤 Live Host — Upcoming"
          quizzes={livePending}
          regionLabel="LIVE"
          isPending
          onView={(q) => viewLive(q)}
          onEdit={(q) => editLive(q)}
          onDownload={null}
          onDelete={(id) => deleteQuiz(id, "live")}
          treatLiveAsPending
        />

        <QuizList
          title="📡 Live — Recently Hosted"
          quizzes={livePrevious.slice(0, 8)}
          regionLabel="LIVE"
          onView={(q) => viewLive(q)}
          onEdit={(q) => editLive(q)}
          onDownload={(q) => downloadScores(q, "live")}
          onDelete={(id) => deleteQuiz(id, "live")}
        />

        {/* ==== Region lists ==== */}
        <QuizList
          title="⏳ Pending Quizzes"
          quizzes={pendingQuizzes}
          regionLabel={region.toUpperCase()}
          isPending
          onView={viewRegion}
          onEdit={editRegion}
          onDownload={null}
          onDelete={(id) => deleteQuiz(id, region)}
        />

        <QuizList
          title="📜 Published Quizzes"
          quizzes={previousQuizzes.slice(0, 8)}
          regionLabel={region.toUpperCase()}
          onView={viewRegion}
          onEdit={editRegion}
          onDownload={(q) => downloadScores(q, region)}
          onDelete={(id) => deleteQuiz(id, region)}
        />
        {previousQuizzes.length > 5 && <small>Scroll down to view more...</small>}
      </div>

      {/* ===== Draft Preview Modal ===== */}
      {previewOpen && (
        <div
          className="preview-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="preview-modal"
            style={{
              width: "min(920px, 95%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              padding: 20,
              borderRadius: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Preview Draft — {draftQuizForPreview.title || "Untitled"}</h3>
              <div>
                <small style={{ marginRight: 12 }}>
                  Created by <strong>{draftQuizForPreview.createdBy}</strong>
                  {draftQuizForPreview.shufflePerUser ? (
                    <em style={{ marginLeft: 8, color: "#059669" }}>(Shuffle per user ON)</em>
                  ) : null}
                  <em style={{ marginLeft: 8, color: "#2563eb" }}>
                    • Time limit: {draftQuizForPreview.timeLimitSeconds || 30}s
                  </em>
                  {draftQuizForPreview.isLive && <em style={{ marginLeft: 8, color: "#ef4444" }}>• LIVE</em>}
                </small>
                <button onClick={() => setPreviewOpen(false)}>Close</button>
              </div>
            </div>

            {draftQuizForPreview.questions.length === 0 ? (
              <p>No questions to preview.</p>
            ) : (
              draftQuizForPreview.questions.map((q, qi) => (
                <div key={qi} style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Q{qi + 1}: {q.question}</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctIndex;
                      return (
                        <div
                          key={oi}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: isCorrect ? "2px solid #10b981" : "1px solid #e5e7eb",
                            background: isCorrect ? "#dcfce7" : "#fafafa",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>{opt}</div>
                          {isCorrect && <div style={{ color: "#059669", fontWeight: 700 }}>✔ correct</div>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Feedback preview */}
                  {(q.correctTitle || q.correctBody || q.wrongTitle || q.wrongBody) && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {(q.correctTitle || q.correctBody) && (
                        <div
                          style={{
                            background: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            borderRadius: 8,
                            padding: 10,
                          }}
                        >
                          <strong>Correct dialog</strong>
                          {q.correctTitle && <div style={{ fontWeight: 700 }}>{q.correctTitle}</div>}
                          {q.correctBody && <div>{q.correctBody}</div>}
                        </div>
                      )}
                      {(q.wrongTitle || q.wrongBody) && (
                        <div
                          style={{
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 8,
                            padding: 10,
                          }}
                        >
                          <strong>Wrong dialog</strong>
                          {q.wrongTitle && <div style={{ fontWeight: 700 }}>{q.wrongTitle}</div>}
                          {q.wrongBody && <div>{q.wrongBody}</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setPreviewOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete All Scores Modal ===== */}
      {deleteScoresOpen && (
        <div
          className="delete-scores-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setDeleteScoresOpen(false)}
        >
          <div
            className="delete-scores-modal"
            style={{
              width: "min(560px, 95%)",
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Delete All User Scores</h3>
            <p
              style={{
                background: "#FEF2F2",
                color: "#991B1B",
                border: "1px solid #FECACA",
                padding: "10px 12px",
                borderRadius: 8,
                lineHeight: 1.4,
              }}
            >
              ⚠️ <strong>Danger:</strong> This permanently deletes <u>all user score documents</u> for the
              selected quiz. This action cannot be undone.
            </p>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>Select Quiz</label>
              <select
                value={deleteTargetQuizId}
                onChange={(e) => setDeleteTargetQuizId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 8 }}
              >
                {allRegionQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} — {q.id}
                  </option>
                ))}
                {allRegionQuizzes.length === 0 && (
                  <option value="" disabled>
                    No quizzes found in this region
                  </option>
                )}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>Admin Password</label>
              <input
                type="password"
                value={deleteConfirmPassword}
                onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                placeholder="Enter admin confirmation password"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 8 }}
              />
              <small style={{ color: "#6B7280" }}>
                The password is read from <code>VITE_ADMIN_CONFIRM</code> (Vite) or{" "}
                <code>REACT_APP_ADMIN_CONFIRM</code> (CRA).
              </small>
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setDeleteScoresOpen(false)}>Cancel</button>
              <button
                onClick={async () => {
                  if (!deleteTargetQuizId) {
                    alert("Please select a quiz.");
                    return;
                  }
                  await deleteAllScoresForQuiz(deleteTargetQuizId, deleteConfirmPassword);
                  setDeleteConfirmPassword("");
                  setDeleteScoresOpen(false);
                }}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Delete All Scores
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Helper subcomponents ---------------- */

function FormField({ label, children, className }) {
  return (
    <div className={`aaq-form-field ${className || ""}`}>
      <label style={{ fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  );
}

function QuizList({
  title,
  quizzes,
  regionLabel,
  isPending,
  onView,
  onEdit,
  onDownload,
  onDelete,
  treatLiveAsPending,
}) {
  return (
    <div className={`aaq-quiz-list-container ${isPending ? "pending" : "published"}`}>
      <h3>{title}</h3>
      {quizzes.length === 0 ? (
        <p>
          No {isPending ? "pending" : "published"} {regionLabel} quizzes.
        </p>
      ) : (
        <ul className="aaq-quiz-list">
          {quizzes.map((quiz, idx) => {
            const pendingTint = isPending || !!treatLiveAsPending || !!quiz.isLive;
            return (
              <li
                key={quiz.id}
                className={`aaq-quiz-list-item list-item-appear ${pendingTint ? "is-pending" : ""}`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong>{quiz.title}</strong>
                  {quiz.isLive && (
                    <span className="live-badge">
                      <span className="pulse-dot" /> LIVE
                    </span>
                  )}
                  <span style={{ opacity: 0.75 }}>
                    — {pendingTint ? "Launches" : "Launched"}{" "}
                    {quiz.launchAt?.toDate ? quiz.launchAt.toDate().toLocaleString() : String(quiz.launchAt)}{" "}
                    <em>(by {quiz.createdBy || "Unknown"})</em>
                    {typeof quiz.timeLimitSeconds === "number" && (
                      <em style={{ marginLeft: 8, color: "#2563eb" }}>
                        • {quiz.timeLimitSeconds}s/question
                      </em>
                    )}
                  </span>
                </div>

                <div
                  className="aaq-list-actions"
                  style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                >
                  {onView && (
                    <button className="action-btn-emoji btn-view" onClick={() => onView(quiz)}>
                      <span>👁️</span>
                      <span>View</span>
                    </button>
                  )}
                  {onEdit && (
                    <button className="action-btn-emoji btn-edit" onClick={() => onEdit(quiz)}>
                      <span>✏️</span>
                      <span>Edit</span>
                    </button>
                  )}
                  {onDownload && (
                    <button className="action-btn-emoji btn-download" onClick={() => onDownload(quiz)}>
                      <span>⬇️</span>
                      <span>Download</span>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="action-btn-emoji btn-danger"
                      onClick={() => onDelete(quiz.id)}
                      title="Delete quiz"
                    >
                      <span>🗑️</span>
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuestionCard({ index, question, onQuestionChange, onOptionChange, onRemove, canRemove }) {
  return (
    <div className="aaq-question-card">
      <div className="aaq-question-card-header">
        <strong>Question {index + 1}</strong>
        {canRemove && (
          <button onClick={onRemove} className="aaq-remove-question-btn">
            Remove
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="Question text"
        value={question.question}
        onChange={(e) => onQuestionChange({ question: e.target.value })}
        className="aaq-question-input"
      />

      <div className="aaq-options-grid">
        {question.options.map((opt, oi) => (
          <label key={oi} className="aaq-option-label">
            <input
              type="radio"
              name={`correct-${index}`}
              checked={Number(question.correctIndex) === oi}
              onChange={() => onQuestionChange({ correctIndex: oi })}
            />
            <span className="aaq-option-text">Option {oi + 1}</span>
            <input
              type="text"
              value={opt}
              onChange={(e) => onOptionChange(oi, e.target.value)}
              className="aaq-option-input"
            />
          </label>
        ))}
      </div>

      {/* NEW: Answer feedback authoring */}
      <div className="aaq-feedback-block" style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <div
          className="aaq-feedback-row"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div
            className="aaq-feedback-card"
            style={{ border: "1px solid #a7f3d0", background: "#ecfdf5", borderRadius: 8, padding: 10 }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Correct dialog (optional)</div>
            <input
              type="text"
              placeholder={`Title (e.g., "Hey, that's right!!")`}
              value={question.correctTitle || ""}
              onChange={(e) => onQuestionChange({ correctTitle: e.target.value })}
              style={{ width: "100%", marginBottom: 6 }}
            />
            <textarea
              rows={3}
              placeholder="Body/explanation shown after a correct answer"
              value={question.correctBody || ""}
              onChange={(e) => onQuestionChange({ correctBody: e.target.value })}
              style={{ width: "100%" }}
            />
          </div>

          <div
            className="aaq-feedback-card"
            style={{ border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 8, padding: 10 }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Wrong dialog (optional)</div>
            <input
              type="text"
              placeholder={`Title (e.g., "Not quite…")`}
              value={question.wrongTitle || ""}
              onChange={(e) => onQuestionChange({ wrongTitle: e.target.value })}
              style={{ width: "100%", marginBottom: 6 }}
            />
            <textarea
              rows={3}
              placeholder="Reason/teaching note shown after a wrong answer"
              value={question.wrongBody || ""}
              onChange={(e) => onQuestionChange({ wrongBody: e.target.value })}
              style={{ width: "100%" }}
            />
            <small className="aaq-hint" style={{ display: "block", marginTop: 6 }}>
              The player UI will also show “Correct: &lt;right option&gt;”.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
