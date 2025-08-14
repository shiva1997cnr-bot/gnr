// src/pages/ESEA.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";
import "../styles/esea.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { saveQuizResult } from "../utils/firestoreUtils";
import LoadingScreen from "../components/LoadingScreen";

const PER_QUESTION_SECONDS = 30;

/* ---------- bg helpers: load /public/esea/bg{1..5}.(jpeg|jpg|webp|png) ---------- */
const tryLoad = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ok: true, url });
    img.onerror = () => resolve({ ok: false, url });
    img.src = url;
  });

const useResolvedBackgrounds = () => {
  const [bgImages, setBgImages] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bases = ["bg1", "bg2", "bg3", "bg4", "bg5"];
      const exts = ["jpeg", "jpg", "webp", "png"];
      const candidates = [];
      bases.forEach((b) => exts.forEach((e) => candidates.push(`/esea/${b}.${e}`)));
      const checks = await Promise.all(candidates.map(tryLoad));
      const good = checks.filter((c) => c.ok).map((c) => c.url);
      if (!cancelled) setBgImages(good);
    })();
    return () => { cancelled = true; };
  }, []);
  return bgImages;
};
/* --------------------------------------------------------------------------- */

function ESEA() {
  const navigate = useNavigate();

  // quiz + per-question state
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);        // string | null per index
  const [pickedIdx, setPickedIdx] = useState([]);    // number | null per index
  const [timeLeftArr, setTimeLeftArr] = useState([]);// seconds per index
  const [locked, setLocked] = useState([]);          // boolean per index

  // flow state
  const [showResult, setShowResult] = useState(false);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // feedback dialog (floating bubble near chosen option)
  const [feedback, setFeedback] = useState({
    visible: false,
    type: null,  // 'correct' | 'wrong' | 'timeup'
    title: "",
    body: "",
    correctAnswer: "",
  });

  // where to draw the bubble (anchored to selected button)
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0, side: "right" }); // side: left|right

  // timers & refs
  const startTime = useRef(Date.now());
  const tickRef = useRef(null);
  const optionRefs = useRef({}); // { [qIndex]: [ref0, ref1, ...] }

  // backgrounds
  const resolvedBgs = useResolvedBackgrounds();
  const [bgIndex, setBgIndex] = useState(0);
  useEffect(() => {
    if (!resolvedBgs.length) return;
    const t = setInterval(
      () => setBgIndex((p) => (p + 1) % resolvedBgs.length),
      9500
    );
    return () => clearInterval(t);
  }, [resolvedBgs.length]);

  const user = JSON.parse(localStorage.getItem("currentUser") || "null");
  const username = user?.username;
  const regionKey = "esea";

  /* ---------- fetch latest quiz; block if already taken ---------- */
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        // latest by createdAt desc
        const q = query(collection(db, regionKey), orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          setLoading(false);
          return;
        }

        const docData = snap.docs[0].data();
        const quizId = snap.docs[0].id;

        // block if already attempted (admin bypass) — check multiple legacy fields
        if (username) {
          const userRef = doc(db, "users", username);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            const isAdmin = data?.role === "admin";
            const taken = data?.takenQuizzes || [];
            const attempted = data?.attemptedQuizzes || [];
            const attemptsMap = data?.attempts || {};
            const already =
              taken.includes(quizId) ||
              attempted.includes(quizId) ||
              Boolean(attemptsMap[quizId]);
            if (!isAdmin && already) {
              setQuizBlocked(true);
              setLoading(false);
              return;
            }
          }
        }

        const qs = Array.isArray(docData.questions) ? docData.questions : [];
        setQuiz({ ...docData, id: quizId });

        // init state (+draft restore)
        const draftKey = `quizDraft:${username || "anon"}:${quizId}`;
        const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
        const initAnswers = Array(qs.length).fill(null);
        const initPicked  = Array(qs.length).fill(null);
        const initTime    = Array(qs.length).fill(PER_QUESTION_SECONDS);
        const initLocked  = Array(qs.length).fill(false);

        if (draft) {
          if (Array.isArray(draft.answers)) draft.answers.forEach((v, i) => (initAnswers[i] = v));
          if (Array.isArray(draft.timeLeftArr)) {
            draft.timeLeftArr.forEach((v, i) => (initTime[i] = Math.max(0, Math.min(PER_QUESTION_SECONDS, v))));
          }
          if (Array.isArray(draft.locked)) draft.locked.forEach((v, i) => (initLocked[i] = !!v));
          if (typeof draft.currentQuestion === "number") {
            const idx = Math.max(0, Math.min(qs.length - 1, draft.currentQuestion));
            setCurrentQuestion(idx);
          }
        }

        setAnswers(initAnswers);
        setPickedIdx(initPicked);
        setTimeLeftArr(initTime);
        setLocked(initLocked);
      } catch (e) {
        console.error("ESEA: error fetching quiz", e);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  /* ---------- persist draft ---------- */
  const persistDraft = useCallback(() => {
    if (!quiz?.id) return;
    const draftKey = `quizDraft:${username || "anon"}:${quiz.id}`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({ answers, timeLeftArr, locked, currentQuestion })
    );
  }, [answers, timeLeftArr, locked, currentQuestion, quiz?.id, username]);

  /* ---------- per-question tick ---------- */
  useEffect(() => {
    if (!quiz) return;
    if (tickRef.current) clearInterval(tickRef.current);
    if (locked[currentQuestion]) return;
    if (timeLeftArr[currentQuestion] <= 0) return;

    tickRef.current = setInterval(() => {
      setTimeLeftArr((prev) => {
        const next = [...prev];
        if (next[currentQuestion] > 0) next[currentQuestion] = next[currentQuestion] - 1;
        return next;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [quiz, currentQuestion, locked, timeLeftArr[currentQuestion]]);

  /* ---------- when time hits 0: lock + bubble near first option ---------- */
  useEffect(() => {
    if (!quiz) return;
    const t = timeLeftArr[currentQuestion];
    if (t === 0 && !locked[currentQuestion]) {
      setLocked((prev) => { const n = [...prev]; n[currentQuestion] = true; return n; });

      if (answers[currentQuestion] == null) {
        const qObj = quiz.questions[currentQuestion] || {};
        const correctAnswer =
          qObj?.answer || (Array.isArray(qObj?.options) ? qObj.options[qObj.correctIndex || 0] : "");
        setFeedback({
          visible: true,
          type: "timeup",
          title: "⏰ Time’s up!",
          body: qObj?.wrongBody || "You ran out of time.",
          correctAnswer: correctAnswer || "",
        });
        requestAnimationFrame(() => updateBubblePos(currentQuestion, 0));
      }
    }
    persistDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeftArr, answers, currentQuestion]);

  /* ---------- compute bubble position next to an option ---------- */
  const updateBubblePos = (qIndex, optIndex) => {
    const btn = optionRefs.current?.[qIndex]?.[optIndex];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 12;
    const assumedWidth = 300;
    let left = r.right + gap;
    let side = "right";
    if (left + assumedWidth > window.innerWidth - 8) {
      left = Math.max(8, r.left - gap - assumedWidth);
      side = "left";
    }
    const top = r.top + r.height / 2; // translateY(-50%) in CSS
    setBubblePos({ top, left, side });
  };

  // recompute on resize while visible
  useEffect(() => {
    if (!feedback.visible) return;
    const handle = () => {
      const oi = pickedIdx[currentQuestion] != null ? pickedIdx[currentQuestion] : 0;
      updateBubblePos(currentQuestion, oi);
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [feedback.visible, currentQuestion, pickedIdx]);

  const playSound = (isCorrect) => {
    const audio = new Audio(isCorrect ? correctSound : wrongSound);
    audio.play().catch(() => {});
  };

  /* ---------- handle option selection (no auto-advance) ---------- */
  const handleSelect = (option, index) => {
    if (!quiz) return;
    const alreadyLocked = locked[currentQuestion] || timeLeftArr[currentQuestion] <= 0;
    if (alreadyLocked) return;

    const qObj = quiz.questions[currentQuestion];
    const correct = option === qObj.answer;
    playSound(correct);

    setAnswers((prev) => { const n = [...prev]; n[currentQuestion] = option; return n; });
    setPickedIdx((prev) => { const n = [...prev]; n[currentQuestion] = index; return n; });
    setLocked((prev) => { const n = [...prev]; n[currentQuestion] = true; return n; });

    const correctAnswer =
      qObj?.answer || (Array.isArray(qObj?.options) ? qObj.options[qObj.correctIndex || 0] : "");
    if (correct) {
      setFeedback({
        visible: true,
        type: "correct",
        title: qObj.correctTitle || "Hey, that’s right! 🎉",
        body: qObj.correctBody || "",
        correctAnswer: "",
      });
    } else {
      setFeedback({
        visible: true,
        type: "wrong",
        title: qObj.wrongTitle || "That’s not correct",
        body: qObj.wrongBody || "",
        correctAnswer: correctAnswer || "",
      });
    }
    requestAnimationFrame(() => updateBubblePos(currentQuestion, index));
  };

  /* ---------- nav ---------- */
  const goPrev = () => {
    setFeedback({ visible: false, type: null, title: "", body: "", correctAnswer: "" });
    setCurrentQuestion((i) => Math.max(0, i - 1));
  };
  const goNext = () => {
    if (!quiz) return;
    setFeedback({ visible: false, type: null, title: "", body: "", correctAnswer: "" });
    const last = quiz.questions.length - 1;
    if (currentQuestion < last) setCurrentQuestion((i) => i + 1);
    else handleSubmit();
  };

  useEffect(() => {
    setFeedback({ visible: false, type: null, title: "", body: "", correctAnswer: "" });
  }, [currentQuestion]);

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (!quiz) return;
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else {
        const idx = Number(e.key);
        if (
          !Number.isNaN(idx) &&
          idx >= 1 &&
          idx <= Math.min(4, quiz.questions[currentQuestion].options.length)
        ) {
          const oi = idx - 1;
          const opt = quiz.questions[currentQuestion].options[oi];
          handleSelect(opt, oi);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quiz, currentQuestion, timeLeftArr, locked, answers]);

  /* ---------- scoring & submit ---------- */
  const computeScore = useCallback(() => {
    if (!quiz) return 0;
    let s = 0;
    for (let i = 0; i < quiz.questions.length; i++) {
      const a = answers[i];
      const correct = quiz.questions[i].answer;
      if (a && a === correct) s += 1;
    }
    return s;
  }, [quiz, answers]);

  const handleSubmit = async () => {
    if (!quiz) return;
    setShowResult(true);
    const finalScore = computeScore();

    if (username) {
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
      await saveQuizResult(username, quiz.id, regionKey, finalScore, timeSpent);

      // ensure future block
      try {
        const userRef = doc(db, "users", username);
        await updateDoc(userRef, {
          takenQuizzes: arrayUnion(quiz.id),
          attemptedQuizzes: arrayUnion(quiz.id),
          // ["attempts." + quiz.id]: true,
        });
      } catch (e) {
        console.warn("ESEA: failed to tag user with quiz id:", e);
      }

      localStorage.removeItem(`quizDraft:${username}:${quiz.id}`);
    }
  };

  const percentDone = useMemo(
    () => (quiz ? Math.round(((currentQuestion + 1) / quiz.questions.length) * 100) : 0),
    [quiz, currentQuestion]
  );

  /* ---------- UI ---------- */
  if (loading) return <LoadingScreen />;

  if (quizBlocked) {
    return (
      <div className="esea-background-wrapper">
        <div className="esea-overlay-layer" />
        {resolvedBgs.map((src, i) => (
          <div key={i} className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`} style={{ backgroundImage: `url(${src})` }} />
        ))}
        <div className="esea-container">
          <div className="esea-box esea-blocked">
            ⛔ You already attempted this quiz.
            <br />
            <button onClick={() => navigate("/region")}>← Return to Region</button>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="esea-background-wrapper">
        <div className="esea-overlay-layer" />
        {resolvedBgs.map((src, i) => (
          <div key={i} className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`} style={{ backgroundImage: `url(${src})` }} />
        ))}
        <div className="esea-container">
          <div className="esea-box esea-blocked">
            No quiz available for ESEA
            <div><button onClick={() => navigate("/region")}>Return to Region</button></div>
          </div>
        </div>
      </div>
    );
  }

  const q = quiz.questions[currentQuestion];
  const selected = answers[currentQuestion];
  const isLocked = locked[currentQuestion] || timeLeftArr[currentQuestion] <= 0;

  return (
    <div className="esea-background-wrapper">
      <div className="esea-overlay-layer" />
      {resolvedBgs.map((src, i) => (
        <div key={i} className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`} style={{ backgroundImage: `url(${src})` }} />
      ))}

      <div className="esea-container">
        <div className="esea-box" style={{ overflow: "hidden" }}>
          {!showResult ? (
            <>
              {/* progress */}
              <div style={{ position: "relative", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.25)", overflow: "hidden", marginBottom: 14 }}>
                <div
                  style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${percentDone}%`, transition: "width 320ms ease",
                    background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(16,185,129,0.9))"
                  }}
                />
              </div>

              <h2 className="uscan-question" style={{ transition: "transform 200ms ease, opacity 200ms ease", willChange: "transform,opacity" }} key={`q-${currentQuestion}`}>
                Q{currentQuestion + 1}: {q.question}
              </h2>

              {/* per-question timer bar */}
              <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,0.15)", overflow: "hidden", margin: "6px 0 12px" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(timeLeftArr[currentQuestion] / PER_QUESTION_SECONDS) * 100}%`,
                    transition: "width 1000ms linear",
                    background: timeLeftArr[currentQuestion] > 5 ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)"
                  }}
                />
              </div>

              <div className="uscan-options" style={{ gap: 10 }}>
                {q.options.map((option, index) => {
                  const isCorrectNow = selected && option === q.answer;
                  const isWrongPick = selected === option && selected !== q.answer;
                  return (
                    <button
                      key={index}
                      ref={(el) => {
                        if (!optionRefs.current[currentQuestion]) optionRefs.current[currentQuestion] = [];
                        optionRefs.current[currentQuestion][index] = el;
                      }}
                      onClick={() => handleSelect(option, index)}
                      className={`uscan-option ${selected ? (isCorrectNow ? "correct" : isWrongPick ? "incorrect" : "") : ""}`}
                      disabled={isLocked}
                      style={{
                        transform: selected === option ? "scale(0.98)" : "scale(1)",
                        transition: "transform 150ms ease, opacity 200ms ease",
                        opacity: isLocked && !selected ? 0.7 : 1,
                      }}
                    >
                      <span style={{ opacity: 0.8, fontSize: 12, marginRight: 6 }}>{index + 1}.</span>
                      {option}
                    </button>
                  );
                })}
              </div>

              <div className="uscan-footer" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span>⏱ {timeLeftArr[currentQuestion]}s</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={goPrev} disabled={currentQuestion === 0}>Previous</button>
                  <button onClick={goNext}>
                    {currentQuestion === quiz.questions.length - 1 ? "Submit" : "Next"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="uscan-result we-result">
              <h2>Quiz Completed 🎉</h2>
              <p className="uscan-score">
                Your Score: {computeScore()} / {quiz.questions.length} (
                {Math.round((computeScore() / quiz.questions.length) * 100)}%)
              </p>
              <p className={`uscan-score ${ (computeScore() / quiz.questions.length) * 100 >= 80 ? "pass" : "fail" }`}>
                {((computeScore() / quiz.questions.length) * 100 >= 80) ? "✅ Great! You passed." : "❌ You did not pass."}
              </p>
              <button onClick={() => navigate("/region")}>Return to Region</button>
            </div>
          )}
        </div>

        {/* ===== Floating feedback bubble anchored to the picked option ===== */}
        {feedback.visible && (
          <div
            className="uscan-feedback-bubble"
            data-type={feedback.type}
            data-side={bubblePos.side}
            style={{ top: bubblePos.top, left: bubblePos.left }}
            role="dialog"
            aria-live="polite"
            tabIndex={-1}
          >
            <span className="uscan-feedback-arrow" />

            <div className="uscan-feedback-title">{feedback.title}</div>

            {feedback.body && (
              <div className="uscan-feedback-body">{feedback.body}</div>
            )}

            {feedback.correctAnswer && (
              <div className="uscan-feedback-ans">
                <strong>Correct answer:</strong> {feedback.correctAnswer}
              </div>
            )}

            <div className="uscan-feedback-actions">
              <button onClick={goNext}>
                {currentQuestion === quiz.questions.length - 1 ? "Submit" : "Next"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ESEA;
