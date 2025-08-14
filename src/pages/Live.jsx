// src/pages/Live.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  setDoc,
  serverTimestamp,
  where as fbWhere,
  orderBy as fbOrderBy,
  limit as fbLimit,
  deleteDoc,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { db, auth } from "../firebase";
import { isAdminUserDoc } from "../utils/firestoreUtils";
import "../styles/live.css";

export default function Live() {
  const navigate = useNavigate();

  /* ---------------- Clock ---------------- */
  const [now, setNow] = useState(new Date());
  const [is24h, setIs24h] = useState(true);
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const dotTimer = setInterval(
      () => setDots((p) => (p.length < 3 ? p + "." : ".")),
      500
    );
    return () => clearInterval(dotTimer);
  }, []);
  const timeParts = useMemo(() => {
    const hours = is24h ? now.getHours() : ((now.getHours() + 11) % 12) + 1;
    const mins = now.getMinutes();
    const secs = now.getSeconds();
    const ampm = now.getHours() >= 12 ? "PM" : "AM";
    const pad = (n) => String(n).padStart(2, "0");
    return {
      hh: pad(hours),
      mm: pad(mins),
      ss: pad(secs),
      ampm,
      dateStr: now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }, [now, is24h]);

  /* ---------------- Host/admin recognition (robust) ---------------- */
  const [hostAllowed, setHostAllowed] = useState(false);
  const [hostReady, setHostReady] = useState(false);

  const localUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        const local = (() => {
          try {
            return JSON.parse(localStorage.getItem("currentUser") || "null");
          } catch {
            return null;
          }
        })();

        const emailLc = (u?.email || local?.email || "").toLowerCase();
        const usernameLc = (local?.username || "").toLowerCase();

        // Merge /users doc(s)
        const guesses = [u?.uid, emailLc, usernameLc].filter(Boolean);
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

        const ok = await isAdminUserDoc(emailLc || u?.uid || usernameLc, merged);
        setHostAllowed(Boolean(ok));
      } catch (e) {
        console.error("Live: admin/host check failed:", e);
        setHostAllowed(false);
      } finally {
        setHostReady(true);
      }
    });
    return () => unsub();
  }, []);

  const displayName =
    localUser?.firstName ||
    localUser?.displayName ||
    (localUser?.email ? localUser.email.split("@")[0] : "User");

  const userId =
    localUser?.username ||
    localUser?.uid ||
    (localUser?.email ? localUser.email.toLowerCase() : "anon");

  /* ---------------- Presence (Participants) ---------------- */
  const PRES_COL = "presence_live";
  const tabIdRef = useRef(
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `tab_${Math.random().toString(36).slice(2)}`
  );
  const presId = `${userId || "anon"}_${tabIdRef.current}`;
  const presRef = doc(db, PRES_COL, presId);

  const [participants, setParticipants] = useState([]); // deduped by uid
  const [panelOpen, setPanelOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Create my presence + heartbeat
  useEffect(() => {
    let hb;
    let created = false;

    const upsertPresence = async () => {
      try {
        await setDoc(
          presRef,
          {
            uid: userId || "anon",
            firstName:
              localUser?.firstName ||
              localUser?.displayName ||
              (localUser?.email ? localUser.email.split("@")[0] : "User"),
            isAdmin: !!hostAllowed,
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );
        created = true;
      } catch (e) {
        console.error("presence upsert failed", e);
      }
    };

    upsertPresence();
    hb = setInterval(async () => {
      try {
        await updateDoc(presRef, { lastSeen: serverTimestamp(), isAdmin: !!hostAllowed });
      } catch {}
    }, 25000);

    // best-effort cleanup
    const cleanup = async () => {
      try {
        if (created) await deleteDoc(presRef);
      } catch {}
    };
    window.addEventListener("beforeunload", cleanup);
    return () => {
      clearInterval(hb);
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hostAllowed]);

  // Watch everyone here
  useEffect(() => {
    const colRef = collection(db, PRES_COL);
    const unsub = onSnapshot(colRef, (snap) => {
      const NOW = Date.now();
      const safeMs = (ts) =>
        ts?.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : 0);

      // Join/leave toasts
      snap.docChanges().forEach((c) => {
        const d = c.doc.data();
        const name = d.firstName || "Someone";
        if (c.type === "added") pushToast(`${name} joined`);
        if (c.type === "removed") pushToast(`${name} left`);
      });

      // Build online list (stale cutoff ~60s)
      const raw = [];
      snap.forEach((d) => raw.push({ id: d.id, ...d.data() }));
      const fresh = raw.filter((r) => NOW - safeMs(r.lastSeen) < 60000);

      // Dedupe by uid (prefer most recent lastSeen)
      const byUid = new Map();
      fresh.forEach((p) => {
        const existing = byUid.get(p.uid);
        if (!existing || safeMs(p.lastSeen) > safeMs(existing.lastSeen)) {
          byUid.set(p.uid, p);
        }
      });
      const unique = Array.from(byUid.values());

      // Admins first, then alpha by firstName
      unique.sort((a, b) =>
        a.isAdmin === b.isAdmin
          ? String(a.firstName || "").localeCompare(String(b.firstName || ""))
          : a.isAdmin
          ? -1
          : 1
      );
      setParticipants(unique);
    });
    return () => unsub();
  }, []);

  const pushToast = (msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => {
      const next = [...t, { id, msg }];
      return next.slice(-3);
    });
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2500);
  };

  // Derive host/participant lists for panel labels
  const hosts = useMemo(
    () => participants.filter((p) => p.isAdmin),
    [participants]
  );
  const nonHosts = useMemo(
    () => participants.filter((p) => !p.isAdmin),
    [participants]
  );

  /* ---------------- Live state ---------------- */
  const [session, setSession] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [mode, setMode] = useState("idle"); // idle | countdown | live | ended
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [selected, setSelected] = useState(null);
  const [myAnsweredMap, setMyAnsweredMap] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [fastestThisQ, setFastestThisQ] = useState([]);

  /* ---------------- Helpers ---------------- */
  const fetchQuizById = async (qid) => {
    if (!qid) return null;
    let snap = await getDoc(doc(db, "live", qid));
    if (snap.exists()) return { id: snap.id, ...snap.data(), __col: "live" };
    snap = await getDoc(doc(db, "quizzes", qid));
    if (snap.exists()) return { id: snap.id, ...snap.data(), __col: "quizzes" };
    return null;
  };

  /* ---------------- Main watchers ---------------- */
  useEffect(() => {
    let unsubLive = null;
    let unsubSched = null;

    const watchNextScheduled = () => {
      const qSched = query(
        collection(db, "live"),
        fbOrderBy("launchAt", "asc"),
        fbWhere("launchAt", ">=", new Date()),
        fbLimit(1)
      );
      unsubSched = onSnapshot(qSched, async (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          const qz = { id: d.id, ...d.data() };
          setQuiz(qz);

          // Ensure a session stub exists (id == quiz.id)
          const sRef = doc(db, "live_sessions", qz.id);
          const sSnap = await getDoc(sRef);
          if (!sSnap.exists()) {
            await setDoc(sRef, {
              quizId: qz.id,
              status: "scheduled",
              isLive: true,
              launchAt: qz.launchAt || null,
              currentQuestionIndex: 0,
              currentQuestionStartAt: null,
              createdAt: serverTimestamp(),
              hostUid: null,
              hostEmail: null,
            });
          }
          const ss = (await getDoc(sRef)).data();
          setSession({ id: qz.id, ...ss });
          setMode("countdown");
        } else {
          setSession(null);
          setQuiz(null);
          setMode("idle");
        }
      });
    };

    const watchActive = () => {
      const qLive = query(
        collection(db, "live_sessions"),
        fbWhere("status", "==", "live"),
        fbLimit(1)
      );
      unsubLive = onSnapshot(qLive, async (snap) => {
        if (!snap.empty) {
          if (typeof unsubSched === "function") {
            unsubSched();
            unsubSched = null;
          }
          const d = snap.docs[0];
          const s = { id: d.id, ...d.data() };
          setSession(s);
          setMode("live");

          const qid = s.quizId || s.id;
          const qDoc = await fetchQuizById(qid);
          if (qDoc) setQuiz(qDoc);
          return;
        }
        // Otherwise watch next scheduled quiz (from /live)
        watchNextScheduled();
      });
    };

    watchActive();
    return () => {
      if (typeof unsubLive === "function") unsubLive();
      if (typeof unsubSched === "function") unsubSched();
    };
  }, []);

  // Keep indices clean when session changes
  useEffect(() => {
    if (!session) return;
    setQIndex(Number(session.currentQuestionIndex || 0));
    setSelected(null);
    setMyAnsweredMap({});
  }, [session?.id]);

  // Subscribe to the single session doc (move/live/end changes)
  useEffect(() => {
    if (!session?.id) return;
    const unsub = onSnapshot(doc(db, "live_sessions", session.id), async (d) => {
      if (!d.exists()) return;
      const s = { id: d.id, ...d.data() };
      setSession(s);

      if (s.status === "live") setMode("live");
      else if (s.status === "scheduled") setMode("countdown");
      else if (s.status === "ended") setMode("ended");

      setQIndex(Number(s.currentQuestionIndex || 0));

      const qid = s.quizId || s.id;
      if (!quiz || quiz.id !== qid) {
        const qDoc = await fetchQuizById(qid);
        if (qDoc) setQuiz(qDoc);
      }
    });
    return () => unsub();
  }, [session?.id]); // intentionally minimal deps

  // 🔧 Reset per-question state for everyone whenever host advances
  useEffect(() => {
    if (mode === "live") {
      setSelected(null); // allows answering on each new question
    }
  }, [mode, session?.currentQuestionIndex]);

  // Per-question countdown when live
  useEffect(() => {
    if (!session || !quiz || mode !== "live") {
      setTimeLeft(null);
      return;
    }
    const start = session.currentQuestionStartAt?.toMillis
      ? session.currentQuestionStartAt.toMillis()
      : null;
    if (!start) {
      setTimeLeft(null);
      return;
    }
    const perQ = Number(quiz.timeLimitSeconds || 30);
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, perQ - elapsed);
      setTimeLeft(left);
    }, 250);
    return () => clearInterval(t);
  }, [session?.currentQuestionStartAt, mode, quiz?.timeLimitSeconds]);

  // Answers -> Leaderboards
  useEffect(() => {
    if (!session?.id) return;
    const answersCol = collection(db, "live_sessions", session.id, "answers");
    const unsub = onSnapshot(answersCol, (snap) => {
      const byUser = new Map();
      const currentQ = Number(session.currentQuestionIndex || 0);
      const fastest = [];

      snap.forEach((d) => {
        const a = d.data();
        const uid = a.uid || "anon";
        const name = a.displayName || uid;
        const correct = !!a.correct;
        const qI = Number(a.qIndex);
        const timeMs = Number(a.timeMsSinceStart || 0);

        if (qI === currentQ && correct) fastest.push(a);

        if (!byUser.has(uid))
          byUser.set(uid, { uid, name, correct: 0, totalTimeMs: 0, lastAt: 0 });
        const agg = byUser.get(uid);
        if (correct) {
          agg.correct += 1;
          agg.totalTimeMs += timeMs;
        }
        const at = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
        if (at > agg.lastAt) agg.lastAt = at;
      });

      const rows = Array.from(byUser.values()).sort((a, b) => {
        if (b.correct !== a.correct) return b.correct - a.correct;
        if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
        return a.lastAt - b.lastAt;
      });
      setLeaderboard(rows.slice(0, 20));

      fastest.sort(
        (a, b) => (a.timeMsSinceStart || 0) - (b.timeMsSinceStart || 0)
      );
      setFastestThisQ(fastest.slice(0, 5));
    });
    return () => unsub();
  }, [session?.id, session?.currentQuestionIndex]);

  /* ---------------- Answer flow ---------------- */
  const canAnswer =
    mode === "live" &&
    timeLeft !== null &&
    timeLeft > 0 &&
    selected === null &&
    !myAnsweredMap[qIndex];

  const handleAnswer = async (answerIndex) => {
    if (!session?.id || !quiz || !canAnswer) return;

    setSelected(answerIndex);

    const startTs = session.currentQuestionStartAt;
    const startMs = startTs?.toMillis ? startTs.toMillis() : Date.now();
    const timeMsSinceStart = Date.now() - startMs;

    const correctIndex = Number(quiz.questions[qIndex]?.correctIndex || 0);
    const correct = Number(answerIndex) === correctIndex;

    const docId = `${userId}_q${qIndex}`;
    const ansRef = doc(db, "live_sessions", session.id, "answers", docId);

    const existing = await getDoc(ansRef);
    if (!existing.exists()) {
      await setDoc(ansRef, {
        uid: userId,
        displayName,
        qIndex,
        answerIndex,
        correct,
        timeMsSinceStart,
        submittedAt: serverTimestamp(),
      });
    }
    setMyAnsweredMap((m) => ({ ...m, [qIndex]: answerIndex }));
  };

  /* ---------------- Host actions ---------------- */
  const hostStart = async () => {
    if (!hostAllowed || !quiz) return;

    const sRef = doc(db, "live_sessions", quiz.id);
    const sSnap = await getDoc(sRef);
    if (!sSnap.exists()) {
      await setDoc(sRef, {
        quizId: quiz.id,
        status: "scheduled",
        isLive: true,
        launchAt: quiz.launchAt || null,
        currentQuestionIndex: 0,
        currentQuestionStartAt: null,
        createdAt: serverTimestamp(),
        hostUid: userId || null,
        hostEmail: localUser?.email || null,
      });
    }

    await updateDoc(sRef, {
      status: "live",
      currentQuestionIndex: 0,
      currentQuestionStartAt: serverTimestamp(),
      hostUid: userId || null,
      hostEmail: localUser?.email || null,
      startedAt: serverTimestamp(),
    });
  };

  const hostNext = async () => {
    if (!hostAllowed || !quiz || !session) return;
    const next = Number(session.currentQuestionIndex || 0) + 1;
    if (next >= (quiz.questions?.length || 0)) return;
    await updateDoc(doc(db, "live_sessions", session.id), {
      currentQuestionIndex: next,
      currentQuestionStartAt: serverTimestamp(),
    });
    setSelected(null); // local UX snap
  };

  const hostEnd = async () => {
    if (!hostAllowed || !session) return;
    await updateDoc(doc(db, "live_sessions", session.id), {
      status: "ended",
      endedAt: serverTimestamp(),
    });
  };

  /* ---------------- Export ---------------- */
  const exportResults = async () => {
    if (!session?.id) return;
    const answersSnap = await getDocs(
      collection(db, "live_sessions", session.id, "answers")
    );
    const answers = answersSnap.docs.map((d) => d.data());

    const byUser = new Map();
    answers.forEach((a) => {
      const uid = a.uid || "anon";
      const name = a.displayName || uid;
      const correct = !!a.correct;
      const timeMs = Number(a.timeMsSinceStart || 0);
      if (!byUser.has(uid))
        byUser.set(uid, { uid, name, correct: 0, totalTimeMs: 0 });
      const agg = byUser.get(uid);
      if (correct) {
        agg.correct += 1;
        agg.totalTimeMs += timeMs;
      }
    });
    const rows = Array.from(byUser.values()).sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.totalTimeMs - b.totalTimeMs;
    });

    const sheetRows = rows.map((r, i) => ({
      Rank: i + 1,
      User: r.name,
      Correct: r.correct,
      "Total Time (ms)": r.totalTimeMs,
    }));

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");

    const title = (quiz?.title || "LiveQuiz").replace(/[\\/:*?"<>|]+/g, "_");
    XLSX.writeFile(wb, `${title}_${session.id}_Results.xlsx`);
  };

  const currentQ = quiz?.questions?.[qIndex] || null;

  /* ---------------- Render ---------------- */
  return (
    <div className={`live-root ${mode === "live" ? "live-mode" : ""}`}>
      {/* Local styles for the participants pill/panel + toasts */}
      <style>{`
        .presence-pod{position:fixed;top:14px;right:16px;z-index:50;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
        .presence-btn{display:inline-flex;align-items:center;gap:8px;background:rgba(17,24,39,.72);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:8px 12px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.3)}
        .presence-btn .count{opacity:.85;font-weight:700}
        .presence-panel{margin-top:6px;width:min(360px,86vw);max-height:50vh;overflow:auto;background:rgba(17,24,39,.92);border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.4);padding:10px 12px;color:#fff}
        /* Force white text inside the panel (and its children) regardless of global styles */
        .presence-panel, .presence-panel * { color:#fff !important; }
        .presence-section{margin-top:6px}
        .presence-title{font-size:12px;letter-spacing:.02em;opacity:.8;margin:8px 0 4px}
        .chip-grid{display:flex;flex-wrap:wrap;gap:6px}
        .chip{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);font-size:12px}
        .chip.admin{background:rgba(59,130,246,.22);border-color:rgba(59,130,246,.45)}
        .toast-stack{display:flex;flex-direction:column;gap:6px}
        .toast{background:rgba(17,24,39,.9);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:12px;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.35);animation:fadeIn .12s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Participants — top-right */}
      <div
        className="presence-pod"
        onMouseEnter={() => setPanelOpen(true)}
        onMouseLeave={() => setPanelOpen(false)}
      >
        <button
          className="presence-btn"
          title={`${participants.length} online`}
          onClick={() => setPanelOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
        >
          <span aria-hidden>👥</span>
          <span className="count">{participants.length}</span>
        </button>

        {panelOpen && (
          <div className="presence-panel" role="dialog" aria-label="Participants online">
            <div className="presence-section">
              <div className="presence-title">
                {hosts.length === 1 ? "Host" : "Hosts"}
              </div>
              <div className="chip-grid">
                {hosts.length === 0 ? (
                  <span style={{ opacity: .7, fontSize: 12 }}>—</span>
                ) : (
                  hosts.map((p) => (
                    <span key={`a-${p.uid}`} className="chip admin">
                      {p.firstName || "Host"}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="presence-section">
              <div className="presence-title">Participants</div>
              <div className="chip-grid">
                {nonHosts.length === 0 ? (
                  <span style={{ opacity: .7, fontSize: 12 }}>—</span>
                ) : (
                  nonHosts.map((p) => (
                    <span key={`u-${p.uid}`} className="chip">
                      {p.firstName || "User"}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Join/leave toasts under the pill */}
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {toasts.map((t) => (
            <div key={t.id} className="toast">{t.msg}</div>
          ))}
        </div>
      </div>

      <button
        className="live-back-btn"
        title="Back"
        aria-label="Go back"
        onClick={() => navigate("/region")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="bg-gradient"></div>
      <div className="bg-grid"></div>
      <div className="particles">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className={`p p-${((i % 6) + 1)}`} />
        ))}
      </div>

      <main className="clock-stage">
        <div className="pulse-ring" aria-hidden />

        <div className="clock-card" data-mode={mode} style={{ minWidth: 320, maxWidth: 980 }}>
          <div className="clock-top" style={{ gap: 8 }}>
            <span className="live-dot" />
            <span className="live-label">LIVE</span>
            <div className="spacer" />
            <button
              className="fmt-toggle"
              onClick={() => setIs24h((v) => !v)}
              title={`Switch to ${is24h ? "12-hour" : "24-hour"} format`}
            >
              {is24h ? "24H" : "12H"}
            </button>
          </div>

        {mode === "idle" && (
          <>
            <ClockBlock timeParts={timeParts} />
            <div className="waiting-host">
              Waiting for host to schedule{dots}
            </div>
          </>
        )}

        {mode === "countdown" && quiz && (
          <>
            <ClockBlock timeParts={timeParts} />
            <CountdownBlock launchAt={quiz.launchAt} />
            {hostReady && hostAllowed && (
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button className="host-primary" onClick={hostStart}>
                  Start now
                </button>
              </div>
            )}
          </>
        )}

        {mode === "live" && quiz && session && (
          <>
            <div style={{ marginTop: 6, marginBottom: 10 }}>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "#e5e7eb",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((Number(session.currentQuestionIndex || 0) + 1) /
                          (quiz.questions.length || 1)) *
                          100
                      )
                    )}%`,
                    background: "linear-gradient(90deg,#22c55e,#16a34a)",
                    height: "100%",
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 6,
                  textAlign: "center",
                  fontSize: 12,
                  opacity: 0.8,
                }}
              >
                Question {Number(session.currentQuestionIndex || 0) + 1} /{" "}
                {quiz.questions.length}
              </div>
            </div>

            {currentQ ? (
              <div className="live-qblock">
                <h3 className="live-question">
                  Q{Number(session.currentQuestionIndex || 0) + 1}.{" "}
                  {currentQ.question}
                </h3>
                <div className="live-options">
                  {(currentQ.options || []).map((opt, oi) => {
                    const locked = !canAnswer;
                    const picked =
                      selected === oi ||
                      myAnsweredMap[
                        Number(session.currentQuestionIndex || 0)
                      ] === oi;
                    return (
                      <button
                        key={oi}
                        className={`live-option ${picked ? "picked" : ""} ${
                          locked ? "locked" : ""
                        }`}
                        onClick={() => handleAnswer(oi)}
                        disabled={!canAnswer}
                        title={locked ? "Locked" : "Choose"}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <div className="live-footer">
                  <span className="time-pill">
                    ⏱ {timeLeft !== null ? `${timeLeft}s` : "--"}
                  </span>
                  {selected !== null ||
                  myAnsweredMap[
                    Number(session.currentQuestionIndex || 0)
                  ] !== undefined ? (
                    <span className="answered-pill">Answer locked</span>
                  ) : (
                    <span className="hint-pill">Pick once — no changes</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="waiting-host">Loading question…</div>
            )}

            {hostReady && hostAllowed && (
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="host-secondary"
                  onClick={hostNext}
                  disabled={
                    Number(session.currentQuestionIndex || 0) + 1 >=
                    (quiz.questions?.length || 0)
                  }
                >
                  Next question
                </button>
                <button className="host-danger" onClick={hostEnd}>
                  End session
                </button>
              </div>
            )}

            <div className="live-boards">
              <div className="lb-card">
                <h4>Top Players</h4>
                {leaderboard.length === 0 ? (
                  <div className="lb-empty">No answers yet…</div>
                ) : (
                  <ol className="lb-list">
                    {leaderboard.slice(0, 10).map((r, i) => (
                      <li key={r.uid}>
                        <span className="rank">{i + 1}</span>
                        <span className="name">{r.name}</span>
                        <span className="score">{r.correct} ✓</span>
                        <span className="time">{r.totalTimeMs} ms</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="lb-card">
                <h4>
                  Fastest on Q{Number(session.currentQuestionIndex || 0) + 1}
                </h4>
                {fastestThisQ.length === 0 ? (
                  <div className="lb-empty">No correct answers yet…</div>
                ) : (
                  <ol className="lb-list">
                    {fastestThisQ.map((a, i) => (
                      <li key={`${a.uid}_${i}`}>
                        <span className="rank">{i + 1}</span>
                        <span className="name">{a.displayName || a.uid}</span>
                        <span className="time">{a.timeMsSinceStart} ms</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}

        {mode === "ended" && (
          <>
            <h3 style={{ textAlign: "center", marginTop: 10 }}>
              Session Ended 🎉
            </h3>
            <div className="live-boards">
              <div className="lb-card" style={{ flex: 1 }}>
                <h4>Final Top 20</h4>
                {leaderboard.length === 0 ? (
                  <div className="lb-empty">No data</div>
                ) : (
                  <ol className="lb-list">
                    {leaderboard.map((r, i) => (
                      <li key={r.uid}>
                        <span className="rank">{i + 1}</span>
                        <span className="name">{r.name}</span>
                        <span className="score">{r.correct} ✓</span>
                        <span className="time">{r.totalTimeMs} ms</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
            {hostReady && hostAllowed && (
              <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
                <button className="host-primary" onClick={exportResults}>
                  ⬇️ Export Results
                </button>
              </div>
            )}
          </>
        )}

        <div className="scanline" />
        </div>
      </main>
    </div>
  );
}

/* ------ small presentational blocks ------ */
function ClockBlock({ timeParts }) {
  return (
    <>
      <div className="clock-digits" aria-live="polite">
        <span className="digit">{timeParts.hh}</span>
        <span className="colon">:</span>
        <span className="digit">{timeParts.mm}</span>
        <span className="colon">:</span>
        <span className="digit seconds">{timeParts.ss}</span>
        <span className="ampm">{timeParts.ampm}</span>
      </div>
      <div className="clock-sub">
        <span className="date">{timeParts.dateStr}</span>
        <span className="dot">•</span>
        <span className="tz">{timeParts.tz}</span>
      </div>
    </>
  );
}

function CountdownBlock({ launchAt }) {
  const [left, setLeft] = useState("--:--:--");
  useEffect(() => {
    if (!launchAt) return;
    const target = launchAt?.toDate
      ? launchAt.toDate().getTime()
      : new Date(launchAt).getTime();
    const t = setInterval(() => {
      const diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const parts =
        d > 0 ? [`${d}d`, `${h}h`, `${m}m`, `${s}s`] : [`${h}h`, `${m}m`, `${s}s`];
      setLeft(parts.join(" "));
    }, 250);
    return () => clearInterval(t);
  }, [launchAt]);
  return <div className="waiting-host">Next live quiz in {left}</div>;
}
