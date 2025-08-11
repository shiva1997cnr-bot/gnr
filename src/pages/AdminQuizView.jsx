import React, { useEffect, useState } from "react";
import "../styles/adminquizview.css";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AdminQuizView() {
  const { region, quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, region, quizId));
        if (snap.exists()) setQuiz({ id: snap.id, ...snap.data() });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [region, quizId]);

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
        <p style={{ marginTop: 8 }}>
          <strong>Region:</strong> {region.toUpperCase()} &nbsp;|&nbsp;{" "}
          <strong>Launch:</strong>{" "}
          {quiz.launchAt?.toDate ? quiz.launchAt.toDate().toLocaleString() : String(quiz.launchAt)}{" "}
          &nbsp;|&nbsp; <strong>By:</strong> {quiz.createdBy || "Unknown"}
        </p>

        <h3 style={{ marginTop: 20 }}>Questions</h3>
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

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => navigate(`/admin/quizzes/${region}/${quiz.id}/edit`)}>
            Edit
          </button>
        </div>
      </div>

      {/* Right side kept empty to preserve layout spacing like AdminAddQuiz */}
      <div className="aaq-admin-list-section" />
    </div>
  );
}
