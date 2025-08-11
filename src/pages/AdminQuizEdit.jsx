import React, { useEffect, useState } from "react";
import "../styles/Adminquizedit.css";


import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";

export default function AdminQuizEdit() {
  const { region, quizId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [launchDateTime, setLaunchDateTime] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, region, quizId));
        if (!snap.exists()) return;
        const data = snap.data();
        setTitle(data.title || "");

        const dt = data.launchAt?.toDate ? data.launchAt.toDate() : null;
        if (dt) {
          const pad = (n) => String(n).padStart(2, "0");
          setLaunchDateTime(
            `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
              dt.getHours()
            )}:${pad(dt.getMinutes())}`
          );
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [region, quizId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { title: title.trim() };
      if (launchDateTime) {
        const jsDate = new Date(launchDateTime);
        payload.launchAt = Timestamp.fromDate(jsDate);
      }
      await updateDoc(doc(db, region, quizId), payload);
      alert("Quiz updated.");
      navigate(`/admin/quizzes/${region}/${quizId}`);
    } catch (e) {
      console.error(e);
      alert("Failed to update quiz.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="aaq-admin-container">
        <div className="aaq-admin-form-section">Loading…</div>
      </div>
    );
  }

  return (
    <div className="aaq-admin-container">
      <div className="aaq-admin-form-section">
        <button className="aaq-back-button" onClick={() => navigate(-1)}>
          ⬅ Back
        </button>

        <h2>Edit Quiz</h2>

        <div className="aaq-form-field">
          <label style={{ fontWeight: 700 }}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          </div>

          <div className="aaq-form-field aaq-form-field-region">
            <label style={{ fontWeight: 700 }}>Region</label>
            <input type="text" value={region.toUpperCase()} readOnly />
          </div>
        </div>

        <div className="aaq-save-btn-container" style={{ marginTop: 12 }}>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Right side kept empty to preserve layout spacing like AdminAddQuiz */}
      <div className="aaq-admin-list-section" />
    </div>
  );
}
