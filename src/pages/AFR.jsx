// src/pages/AFR.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";
import "../styles/afr.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { hasUserAttemptedQuiz, saveQuizResult } from "../utils/firestoreUtils";
import { logActivity } from "../utils/activityLogger";
import LoadingScreen from "../components/LoadingScreen";

const PER_QUESTION_SECONDS = 30;

/* ---------- bg helpers: load /public/afr/bg{1..4}.(jpeg|jpg|webp|png) ---------- */
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
      const bases = ["bg1", "bg2", "bg3", "bg4"];
      const exts = ["jpeg", "jpg", "webp", "png"];
      const candidates = [];
      bases.forEach((b) => exts.forEach((e) => candidates.push(`/afr/${b}.${e}`)));
      const checks = await Promise.all(candidates.map(tryLoad));
      const good = checks.filter((c) => c.ok).map((c) => c.url);
      if (!cancelled) setBgImages(good);
    })();
    return () => { cancelled = true; };
  }, []);
  return bgImages;
};
/* --------------------------------------------------------------------------- */

function AFR() {
  const navigate = useNavigate();
  const regionKey = "afr";

  // quiz + per-question state
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);          // string | null per index
  const [pickedIdx, setPickedIdx] = useState([]);      // number | null per index
  const [timeLeftArr, setTimeLeftArr] = useState([]);  // seconds per index
  const [locked, setLocked] = useState([]);            // boolean per index

  // flow
  const [showResult, setShowResult] = useState(false);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);

  // feedback bubble
  const [feedback, setFeedback] = useState({
    visible: false,
    type: null, // 'correct' | 'wrong' | 'timeup'
    title: "",
    body: "",
    correctAnswer: "",
  });
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0, side: "right" }); // side: left|right

  // timers/refs
  const startTime = useRef(Date.now());
  const tickRef = useRef(null);
  const optionRefs = useRef({}); // { [qIndex]: [ref0, ref1, ...] }

  // backgrounds
  const resolvedBgs = useResolvedBackgrounds();
  const [bgIndex, setBgIndex] = useState(0);
  useEffect(() => {
    if (!resolvedBgs.length) return;
    const t = setInterval(() => setBgIndex((p) => (p + 1) % resolvedBgs.length), 9500);
    return () => clearInterval(t);
  }, [resolvedBgs.length]);

  const user = JSON.parse(localStorage.getItem("currentUser") || "null");
  const username = user?.username;

  /* ---------- fetch latest AFR quiz (USCAN-style: launchAt + block) ---------- */
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        if (!username) { setLoading(false); return; }

        const now = new Date();
        const q = query(
          collection(db, regionKey),
          where("launchAt", "<=", now),
          orderBy("launchAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) { setLoading(false); return; }

        const docSnap = snap.docs[0];
        const data = docSnap.data();
        const quizId = docSnap.id;

        // future launch support
        const launchTime = dayjs(data.launchAt?.toDate?.() || data.launchAt);
        if (launchTime.isValid() && dayjs().isBefore(launchTime)) {
          setCountdown(launchTime.diff(dayjs(), "second"));
          setLoading(false);
          return;
        }

        // block if already taken
        const attempted = await hasUserAttemptedQuiz(username, quizId);
        if (attempted) { setQuizBlocked(true); setLoading(false); return; }

        const qs = Array.isArray(data.questions) ? data.questions : [];
        setQuiz({ ...data, id: quizId });

        // init state (+draft restore)
        const draftKey = `quizDraft:${username}:${quizId}`;
        const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
        const initAnswers = Array(qs.length).fill(null);
        const initPicked  = Array(qs.length).fill(null);
        const initTime    = Array(qs.length).fill(PER_QUESTION_SECONDS);
        const initLocked  = Array(qs.length).fill(false);

        if (draft) {
          if (Array.isArray(draft.answers)) draft.answers.forEach((v, i) => (initAnswers[i] = v));
          if (Array.isArray(draft.timeLeftArr))
            draft.timeLeftArr.forEach((v, i) => (initTime[i] = Math.max(0, Math.min(PER_QUESTION_SECONDS, v))));
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
        console.error("AFR: error fetching quiz", e);
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
    const draftKey = `quizDraft:${username}:${quiz.id}`;
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
        if (!Number.isNaN(idx) && idx >= 1 && idx <= Math.min(4, quiz.questions[currentQuestion].options.length)) {
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
      try {
        logActivity("QUIZ_ATTEMPT", `AFR Quiz | Score: ${finalScore}/${quiz.questions.length}`);
      } catch {}
      // optional: also tag user doc like other regions
      try {
        const userRef = doc(db, "users", username);
        await updateDoc(userRef, {
          takenQuizzes: arrayUnion(quiz.id),
          attemptedQuizzes: arrayUnion(quiz.id),
        });
      } catch (e) {
        console.warn("AFR: failed to tag user doc with quiz id:", e);
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

  if (countdown !== null) {
    return (
      <div className="afr-loading">
        ⏳ New quiz starts in {countdown}s
        <div><button onClick={() => navigate("/region")}>Return to Region</button></div>
      </div>
    );
  }

  if (quizBlocked) {
    return (
      <div className="afr-background-wrapper">
        <div className="afr-overlay-layer" />
        {resolvedBgs.map((src, i) => (
          <div key={i} className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`} style={{ backgroundImage: `url(${src})` }} />
        ))}
        <div className="afr-container">
          <div className="afr-box afr-blocked">
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
      <div className="afr-background-wrapper">
        <div className="afr-overlay-layer" />
        {resolvedBgs.map((src, i) => (
          <div key={i} className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`} style={{ backgroundImage: `url(${src})` }} />
        ))}
        <div className="afr-container">
          <div className="afr-box afr-blocked">
            No quiz available for AFR
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
    <div className="afr-background-wrapper">
      <div className="afr-overlay-layer" />
      {resolvedBgs.map((src, i) => (
        <div key={i} className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`} style={{ backgroundImage: `url(${src})` }} />
      ))}

      <div className="afr-container">
        <div className="afr-box" style={{ overflow: "hidden" }}>
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

export default AFR;
