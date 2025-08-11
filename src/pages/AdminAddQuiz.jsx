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
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaTrash } from "react-icons/fa";
import * as XLSX from "xlsx";
import { getQuizScores } from "../utils/firestoreUtils";

const REGIONS = ["uscan", "we", "afr", "sa", "esea", "latam"];

// helpers
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const safeFile = (s) => (s || "Quiz").replace(/[\\/:*?"<>|]+/g, "_");
const getAdminConfirmSecret = () =>
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_ADMIN_CONFIRM) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_ADMIN_CONFIRM) ||
  "";

// data utils
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

export default function AdminAddQuiz() {
  const navigate = useNavigate();

  // Create form state
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("afr");
  const [launchDateTime, setLaunchDateTime] = useState("");
  const [questions, setQuestions] = useState([
    { question: "", options: ["", "", "", ""], correctIndex: 0 },
  ]);
  const [shufflePerUser, setShufflePerUser] = useState(false);

  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");

  // Lists
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [previousQuizzes, setPreviousQuizzes] = useState([]);

  // Draft preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // Delete-all-scores modal
  const [deleteScoresOpen, setDeleteScoresOpen] = useState(false);
  const [deleteTargetQuizId, setDeleteTargetQuizId] = useState("");
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState("");

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      if (user && user.role === "admin") {
        setIsAdmin(true);
        const first = (user.name || user.displayName || "").split(" ")[0];
        const fallback = user.email ? user.email.split("@")[0] : "Admin";
        setAdminName(first || user.firstName || fallback || "Admin");
      }
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchQuizzes(region);
  }, [region, isAdmin]);

  const allRegionQuizzes = useMemo(
    () => [...pendingQuizzes, ...previousQuizzes],
    [pendingQuizzes, previousQuizzes]
  );

  useEffect(() => {
    // keep the modal's default selection in sync when region changes
    if (allRegionQuizzes.length > 0) {
      setDeleteTargetQuizId((prev) => prev || allRegionQuizzes[0].id);
    } else {
      setDeleteTargetQuizId("");
    }
  }, [allRegionQuizzes]);

  const fetchQuizzes = async (selectedRegion) => {
    try {
      const qSnap = await getDocs(
        query(collection(db, selectedRegion), orderBy("launchAt", "desc"))
      );
      const now = Timestamp.now();
      const pending = [];
      const previous = [];

      qSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const quiz = { id: docSnap.id, ...data };
        if (quiz.launchAt && quiz.launchAt.seconds > now.seconds) {
          pending.push(quiz);
        } else {
          previous.push(quiz);
        }
      });

      setPendingQuizzes(pending);
      setPreviousQuizzes(previous);
    } catch (err) {
      console.error("Error fetching quizzes:", err);
      alert("Failed to load quizzes.");
    }
  };

  const deleteQuiz = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await deleteDoc(doc(db, region, quizId));
      setPendingQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      setPreviousQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      alert("Quiz deleted successfully.");
    } catch (err) {
      console.error("Error deleting quiz:", err);
      alert("Failed to delete quiz.");
    }
  };

  // Delete ALL user scores for a quiz (in batches + password confirm)
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
        const snap = await getDocs(
          query(collection(db, `quizScores_${quizId}`), qLimit(500))
        );
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

  const handleView = (quiz) => {
    navigate(`/admin/quizzes/${region}/${quiz.id}`);
  };

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
      { question: "", options: ["", "", "", ""], correctIndex: 0 },
    ]);
  };

  const removeQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

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
    if (!REGIONS.includes(region)) {
      alert("Please select a valid region.");
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
        return {
          question: (q.question ?? "").toString().trim(),
          options: opts,
          correctIndex,
          answer,
        };
      });

      const payload = {
        title: title.trim(),
        launchAt: Timestamp.fromDate(launchDate),
        questions: normalizedQuestions,
        createdAt: Timestamp.now(),
        createdBy: adminName || "Admin",
        shufflePerUser: !!shufflePerUser,
      };

      // Create a shared ID so central + regional docs match
      const centralRef = doc(collection(db, "quizzes"));
      const sharedId = centralRef.id;

      const payloadCentral = { ...payload, region };
      await setDoc(centralRef, payloadCentral);
      await setDoc(doc(db, region, sharedId), payload);

      alert(`Quiz saved successfully to ${region.toUpperCase()}.`);

      setTitle("");
      setLaunchDateTime("");
      setRegion("afr");
      setQuestions([{ question: "", options: ["", "", "", ""], correctIndex: 0 }]);
      setShufflePerUser(false);

      fetchQuizzes(region);
    } catch (err) {
      console.error("Error saving quiz:", err);
      alert("Error saving quiz.");
    } finally {
      setSaving(false);
    }
  };

  const downloadScores = async (quiz, regionKey) => {
    try {
      const quizId = quiz?.id;
      if (!quizId) {
        alert("Missing quiz id.");
        return;
      }

      // Try both common utils signatures:
      let scores = [];
      try {
        scores = await getQuizScores(regionKey, quizId);
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

      // Backfill user names/emails from /users
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
          );
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

      // Normalize for Excel
      const rows = scores.map((s) => {
        const idKey =
          s.uid || s.userId || s.authUid || s.userUID || s.user_id || "";
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
            (s.firstName || s.lastName
              ? `${s.firstName || ""} ${s.lastName || ""}`.trim()
              : "") ||
            profile.displayName ||
            "",
          userEmail: s.userEmail || s.email || profile.email || "",
          score: typeof s.score === "number" ? s.score : Number(s.score ?? 0),
          total: typeof s.total === "number" ? s.total : Number(s.total ?? 0),
          percentage:
            typeof s.score === "number" &&
            typeof s.total === "number" &&
            s.total > 0
              ? Math.round((s.score / s.total) * 100)
              : "",
          dateOfAttempt: s.dateOfAttempt || "",
          timeOfAttempt: s.timeOfAttempt || "",
          attemptedAt,
          region: s.region || regionKey || "",
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
      };
    }),
    createdBy: adminName || "Admin",
    shufflePerUser,
  };

  if (!isAdmin) {
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

  return (
    <div className="aaq-admin-container">
      <div className="aaq-admin-form-section">
        <button onClick={() => navigate(`/region`)} className="aaq-back-button">
          <FaArrowLeft /> Back to {region.toUpperCase()}
        </button>

        <h2>Create New Quiz</h2>

        <FormField label="Quiz Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
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
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* NEW: Shuffle per user toggle */}
        <FormField label="Shuffle questions for each user">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={shufflePerUser}
              onChange={(e) => setShufflePerUser(e.target.checked)}
            />
            <span className="aaq-hint">
              Randomize question order per user attempt
            </span>
          </label>
        </FormField>

        <h3>Questions</h3>

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
          <button
            onClick={() => setPreviewOpen(true)}
            disabled={!title && questions.length === 0}
          >
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
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
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

        <QuizList
          title="⏳ Pending Quizzes"
          quizzes={pendingQuizzes}
          region={region}
          isPending
          onView={handleView}
          onEdit={null} // no edit
          onDelete={deleteQuiz}
        />

        <QuizList
          title="📜 Published Quizzes"
          quizzes={previousQuizzes.slice(0, 8)}
          region={region}
          onView={handleView}
          onEdit={downloadScores} // Download scores
          onDelete={deleteQuiz}
        />
        {previousQuizzes.length > 5 && (
          <small>Scroll down to view more...</small>
        )}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3>Preview Draft — {draftQuizForPreview.title || "Untitled"}</h3>
              <div>
                <small style={{ marginRight: 12 }}>
                  Created by <strong>{draftQuizForPreview.createdBy}</strong>
                  {draftQuizForPreview.shufflePerUser ? (
                    <em style={{ marginLeft: 8, color: "#059669" }}>
                      (Shuffle per user ON)
                    </em>
                  ) : null}
                </small>
                <button onClick={() => setPreviewOpen(false)}>Close</button>
              </div>
            </div>

            {draftQuizForPreview.questions.length === 0 ? (
              <p>No questions to preview.</p>
            ) : (
              draftQuizForPreview.questions.map((q, qi) => (
                <div
                  key={qi}
                  style={{
                    marginTop: 12,
                    padding: 12,
                    border: "1px solid #eee",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    Q{qi + 1}: {q.question}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctIndex;
                      return (
                        <div
                          key={oi}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: isCorrect
                              ? "2px solid #10b981"
                              : "1px solid #e5e7eb",
                            background: isCorrect ? "#dcfce7" : "#fafafa",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>{opt}</div>
                          {isCorrect && (
                            <div style={{ color: "#059669", fontWeight: 700 }}>
                              ✔ correct
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button onClick={() => setPreviewOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete All Scores Modal (Top-right button) ===== */}
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
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              Delete All User Scores
            </h3>
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
              ⚠️ <strong>Danger:</strong> This permanently deletes{" "}
              <u>all user score documents</u> for the selected quiz. This action
              cannot be undone.
            </p>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                Select Quiz
              </label>
              <select
                value={deleteTargetQuizId}
                onChange={(e) => setDeleteTargetQuizId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                }}
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
              <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                Admin Password
              </label>
              <input
                type="password"
                value={deleteConfirmPassword}
                onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                placeholder="Enter admin confirmation password"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                }}
              />
              <small style={{ color: "#6B7280" }}>
                The password is read from <code>VITE_ADMIN_CONFIRM</code> (Vite)
                or <code>REACT_APP_ADMIN_CONFIRM</code> (CRA).
              </small>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button onClick={() => setDeleteScoresOpen(false)}>Cancel</button>
              <button
                onClick={async () => {
                  if (!deleteTargetQuizId) {
                    alert("Please select a quiz.");
                    return;
                  }
                  await deleteAllScoresForQuiz(
                    deleteTargetQuizId,
                    deleteConfirmPassword
                  );
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
  region,
  isPending,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className={`aaq-quiz-list-container ${isPending ? "pending" : "published"}`}>
      <h3>{title}</h3>
      {quizzes.length === 0 ? (
        <p>No {isPending ? "pending" : "published"} quizzes for {region.toUpperCase()}.</p>
      ) : (
        <ul className="aaq-quiz-list">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="aaq-quiz-list-item">
              <div>
                <strong>{quiz.title}</strong> — {isPending ? "Launches" : "Launched"} at{" "}
                {quiz.launchAt?.toDate
                  ? quiz.launchAt.toDate().toLocaleString()
                  : String(quiz.launchAt)}{" "}
                <em>(by {quiz.createdBy || "Unknown"})</em>
              </div>
              <div
                className="aaq-list-actions"
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                {onView && <button onClick={() => onView(quiz)}>View</button>}
                {onEdit && (
                  <button
                    onClick={() => onEdit(quiz, region)}
                    className="aaq-download-button"
                  >
                    Download
                  </button>
                )}
                {onDelete && (
                  <button
                    className="aaq-delete-button"
                    onClick={() => onDelete(quiz.id)}
                    title="Delete quiz"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionCard({
  index,
  question,
  onQuestionChange,
  onOptionChange,
  onRemove,
  canRemove,
}) {
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
    </div>
  );
}
