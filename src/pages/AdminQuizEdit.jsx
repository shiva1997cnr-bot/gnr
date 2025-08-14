// src/pages/AdminQuizEdit.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../styles/adminquizedit.css";

import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  writeBatch,
  Timestamp,
  deleteField,
} from "firebase/firestore";
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

const emptyQuestion = () => ({
  question: "",
  options: ["", ""],
  correctIndex: 0,
  // feedback fields
  correctTitle: "",
  correctBody: "",
  wrongTitle: "",
  wrongBody: "",
});

export default function AdminQuizEdit() {
  const { region, quizId } = useParams();
  const navigate = useNavigate();

  const regionKey = useMemo(() => String(region || "").toLowerCase(), [region]);
  const regionLabel = useMemo(() => regionKey.toUpperCase(), [regionKey]);

  // Access control
  const [adminReady, setAdminReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // metadata
  const [title, setTitle] = useState("");
  const [launchDateTime, setLaunchDateTime] = useState(""); // HTML datetime-local
  const [shufflePerUser, setShufflePerUser] = useState(false);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);

  // questions
  const [questions, setQuestions] = useState([]);

  // ---------- Robust admin guard ----------
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

  // ---------- Load quiz (merge central + regional; regional overrides) ----------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const centralRef = doc(db, "quizzes", quizId);
        const regionalRef = doc(db, regionKey, quizId);

        const [centralSnap, regionalSnap] = await Promise.all([
          getDoc(centralRef),
          getDoc(regionalRef),
        ]);

        if (!centralSnap.exists() && !regionalSnap.exists()) {
          alert("Quiz not found.");
          navigate("/admin-add-quiz");
          return;
        }

        const base = centralSnap.exists() ? centralSnap.data() : {};
        const overlay = regionalSnap.exists() ? regionalSnap.data() : {};
        const data = { ...base, ...overlay };

        setTitle(data.title || "");
        setShufflePerUser(!!data.shufflePerUser);
        setTimeLimitSeconds(Number(data.timeLimitSeconds || 30));

        // datetime-local value
        const dt = data.launchAt?.toDate ? data.launchAt.toDate() : null;
        if (dt) {
          const pad = (n) => String(n).padStart(2, "0");
          setLaunchDateTime(
            `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
              dt.getHours()
            )}:${pad(dt.getMinutes())}`
          );
        } else {
          setLaunchDateTime("");
        }

        // questions array (support legacy field names) + feedback fields
        const qArr = Array.isArray(data.questions)
          ? data.questions
          : Array.isArray(data.items)
          ? data.items
          : [];
        const normalized = qArr.map((q) => ({
          question: (q.question ?? q.text ?? "").toString(),
          options: Array.isArray(q.options) ? q.options.map((o) => o.toString()) : [],
          correctIndex: Number(q.correctIndex ?? q.correctAnswerIndex ?? 0),
          correctTitle: (q.correctTitle ?? "").toString(),
          correctBody: (q.correctBody ?? "").toString(),
          wrongTitle: (q.wrongTitle ?? "").toString(),
          wrongBody: (q.wrongBody ?? "").toString(),
        }));
        setQuestions(normalized.length ? normalized : [emptyQuestion()]);
      } catch (e) {
        console.error("Load failed:", e);
        alert("Failed to load quiz.");
        navigate("/admin-add-quiz");
      } finally {
        setLoading(false);
      }
    };
    if (adminReady && isAdmin && quizId && regionKey) load();
  }, [adminReady, isAdmin, quizId, regionKey, navigate]);

  // ---------- Question helpers ----------
  const setQ = (i, patch) => {
    setQuestions((qs) => {
      const next = [...qs];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const addQuestion = () => setQuestions((qs) => [...qs, emptyQuestion()]);
  const deleteQuestion = (i) =>
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs));
  const moveQuestion = (i, dir) =>
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      const [row] = next.splice(i, 1);
      next.splice(j, 0, row);
      return next;
    });

  const addOption = (qi) =>
    setQuestions((qs) => {
      const next = [...qs];
      const q = { ...next[qi] };
      q.options = [...(q.options || []), ""];
      next[qi] = q;
      return next;
    });

  const deleteOption = (qi, oi) =>
    setQuestions((qs) => {
      const next = [...qs];
      const q = { ...next[qi] };
      const newOpts = (q.options || []).filter((_, idx) => idx !== oi);
      const newCorrect =
        q.correctIndex >= newOpts.length ? Math.max(0, newOpts.length - 1) : q.correctIndex;
      next[qi] = { ...q, options: newOpts.length ? newOpts : [""], correctIndex: newCorrect };
      return next;
    });

  const setOption = (qi, oi, value) =>
    setQuestions((qs) => {
      const next = [...qs];
      const q = { ...next[qi] };
      const arr = [...(q.options || [])];
      arr[oi] = value;
      next[qi] = { ...q, options: arr };
      return next;
    });

  // ---------- Save (UPSERT to central + regional/live) ----------
  const handleSave = async () => {
    if (!title.trim()) {
      alert("Please provide a title.");
      return;
    }

    // Validate & normalize questions (keep feedback fields)
    const cleaned = questions.map((q) => {
      const opts = (q.options || []).map((o) => (o ?? "").toString().trim()).filter(Boolean);
      const normalizedOpts = opts.length >= 2 ? opts : ["Option A", "Option B"];
      const ci =
        typeof q.correctIndex === "number" &&
        q.correctIndex >= 0 &&
        q.correctIndex < normalizedOpts.length
          ? q.correctIndex
          : 0;

      return {
        question: (q.question ?? "").toString().trim(),
        options: normalizedOpts,
        correctIndex: ci,
        // feedback
        correctTitle: (q.correctTitle ?? "").toString().trim(),
        correctBody: (q.correctBody ?? "").toString().trim(),
        wrongTitle: (q.wrongTitle ?? "").toString().trim(),
        wrongBody: (q.wrongBody ?? "").toString().trim(),
      };
    });

    if (cleaned.some((q) => !q.question)) {
      alert("Each question must have text.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        shufflePerUser: !!shufflePerUser,
        timeLimitSeconds: Math.max(5, Number(timeLimitSeconds || 30)),
        questions: cleaned,
        updatedAt: Timestamp.now(),
      };

      // Launch time (allow clearing)
      if (launchDateTime) {
        const jsDate = new Date(launchDateTime);
        if (isNaN(jsDate.getTime())) {
          alert("Invalid launch date/time.");
          setSaving(false);
          return;
        }
        payload.launchAt = Timestamp.fromDate(jsDate);
      } else {
        payload.launchAt = deleteField();
      }

      const batch = writeBatch(db);

      // central copy
      const centralRef = doc(db, "quizzes", quizId);
      batch.set(centralRef, payload, { merge: true });

      // regional copy (skip if editing LIVE or central collection)
      if (regionKey && regionKey !== "quizzes" && regionKey !== "live") {
        const regionalRef = doc(db, regionKey, quizId);
        batch.set(regionalRef, payload, { merge: true });
      }

      // live copy: only when region is actually 'live'
      if (regionKey === "live") {
        const liveRef = doc(db, "live", quizId);
        batch.set(liveRef, payload, { merge: true });
      }

      await batch.commit();
      alert("Quiz updated.");
      navigate(`/admin/quizzes/${regionKey}/${quizId}`);
    } catch (e) {
      console.error("Save failed:", e);
      alert("Failed to update quiz.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Gated render ----------
  if (!adminReady) {
    return (
      <div className="aaq-edit-root">
        <div className="aaq-admin-container">
          <div className="aaq-admin-form-section">Checking access…</div>
          <div className="aaq-admin-list-section" />
        </div>
      </div>
    );
  }
  if (adminReady && !isAdmin) {
    return (
      <div className="aaq-edit-root">
        <div className="aaq-admin-container">
          <div className="aaq-admin-form-section">
            <h2>Admin — Edit Quiz</h2>
            <p>Access denied.</p>
            <button className="aaq-back-button" onClick={() => navigate("/region")}>⬅ Return</button>
          </div>
          <div className="aaq-admin-list-section" />
        </div>
      </div>
    );
  }

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="aaq-edit-root">
        <div className="aaq-admin-container">
          <div className="aaq-admin-form-section">Loading…</div>
          <div className="aaq-admin-list-section" />
        </div>
      </div>
    );
  }

  return (
    <div className="aaq-edit-root">
      <div className="aaq-admin-container">
        <div className="aaq-admin-form-section">
          <button className="aaq-back-button" onClick={() => navigate(-1)}>⬅ Back</button>
          <h2>Edit Quiz</h2>

          {/* Meta */}
          <div className="aaq-form-field">
            <label style={{ fontWeight: 700 }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quiz title"
            />
          </div>

          <div className="aaq-form-group">
            <div className="aaq-form-field aaq-form-field-flex">
              <label style={{ fontWeight: 700 }}>Launch Date & Time</label>
              <input
                type="datetime-local"
                value={launchDateTime}
                onChange={(e) => setLaunchDateTime(e.target.value)}
              />
              <small className="aaq-hint">Leave blank to clear schedule</small>
            </div>

            <div className="aaq-form-field aaq-form-field-region">
              <label style={{ fontWeight: 700 }}>Region</label>
              <input type="text" value={regionLabel} readOnly />
            </div>
          </div>

          <div className="aaq-form-2col">
            <div className="aaq-form-field">
              <label style={{ fontWeight: 700 }}>Shuffle questions per user</label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={shufflePerUser}
                  onChange={(e) => setShufflePerUser(e.target.checked)}
                />
                <span className="aaq-hint">Randomize order per attempt</span>
              </label>
            </div>

            <div className="aaq-form-field">
              <label style={{ fontWeight: 700 }}>Time limit (seconds per question)</label>
              <input
                type="number"
                min={5}
                step={1}
                value={timeLimitSeconds}
                onChange={(e) => setTimeLimitSeconds(e.target.value)}
              />
            </div>
          </div>

          {/* Questions editor */}
          <div className="aaq-questions">
            <div className="aaq-qhdr">
              <h3>Questions</h3>
              <button className="aaq-add" onClick={addQuestion}>+ Add question</button>
            </div>

            {questions.map((q, qi) => (
              <div className="aaq-qcard" key={qi}>
                <div className="aaq-qtop">
                  <strong>Q{qi + 1}</strong>
                  <div className="aaq-qactions">
                    <button onClick={() => moveQuestion(qi, -1)} disabled={qi === 0}>↑</button>
                    <button onClick={() => moveQuestion(qi, +1)} disabled={qi === questions.length - 1}>↓</button>
                    <button
                      className="danger"
                      onClick={() => deleteQuestion(qi)}
                      disabled={questions.length === 1}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="aaq-form-field">
                  <label>Question text</label>
                  <textarea
                    rows={2}
                    value={q.question}
                    onChange={(e) => setQ(qi, { question: e.target.value })}
                    placeholder="Type the question…"
                  />
                </div>

                <div className="aaq-options">
                  <label style={{ fontWeight: 700, marginBottom: 6 }}>Options</label>
                  {(q.options || []).map((opt, oi) => (
                    <div className="aaq-option-row" key={oi}>
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correctIndex === oi}
                        onChange={() => setQ(qi, { correctIndex: oi })}
                        title="Mark as correct"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => setOption(qi, oi, e.target.value)}
                        placeholder={`Option ${oi + 1}`}
                        className="aaq-option-input"
                      />
                      <button
                        className="aaq-option-del"
                        onClick={() => deleteOption(qi, oi)}
                        title="Remove option"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button className="aaq-add tiny" onClick={() => addOption(qi)}>+ Add option</button>
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
                        value={q.correctTitle || ""}
                        onChange={(e) => setQ(qi, { correctTitle: e.target.value })}
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <textarea
                        rows={3}
                        placeholder="Body/explanation shown after a correct answer"
                        value={q.correctBody || ""}
                        onChange={(e) => setQ(qi, { correctBody: e.target.value })}
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
                        value={q.wrongTitle || ""}
                        onChange={(e) => setQ(qi, { wrongTitle: e.target.value })}
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <textarea
                        rows={3}
                        placeholder="Reason/teaching note shown after a wrong answer"
                        value={q.wrongBody || ""}
                        onChange={(e) => setQ(qi, { wrongBody: e.target.value })}
                        style={{ width: "100%" }}
                      />
                      <small className="aaq-hint" style={{ display: "block", marginTop: 6 }}>
                        The player UI will also show “Correct: &lt;right option&gt;”.
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="aaq-save-btn-container" style={{ marginTop: 14 }}>
            <button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Right side kept for layout parity */}
        <div className="aaq-admin-list-section" />
      </div>
    </div>
  );
}
