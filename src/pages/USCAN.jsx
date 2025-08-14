// src/pages/USCAN.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";
import "../styles/uscan.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { hasUserAttemptedQuiz, saveQuizResult } from "../utils/firestoreUtils";
import { logActivity } from "../utils/activityLogger";
import LoadingScreen from "../components/LoadingScreen";

const PER_QUESTION_SECONDS = 30;

/* ---------- bg helpers: load /public/us/bg{1..7}.(webp|jpg|jpeg|png) ---------- */
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
      const bases = ["bg1", "bg2", "bg3", "bg4", "bg5", "bg6", "bg7"];
      const exts = ["webp", "jpg", "jpeg", "png"];
      const candidates = [];
      bases.forEach((b) => exts.forEach((e) => candidates.push(`/us/${b}.${e}`)));
      const checks = await Promise.all(candidates.map(tryLoad));
      const good = checks.filter((c) => c.ok).map((c) => c.url);
      if (!cancelled) setBgImages(good);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return bgImages;
};
/* --------------------------------------------------------------------------- */

function USCAN() {
  const navigate = useNavigate();

  // quiz + per-question state
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]); // string | null per index
  const [pickedIdx, setPickedIdx] = useState([]); // number | null per index
  const [timeLeftArr, setTimeLeftArr] = useState([]); // seconds remaining per index
  const [locked, setLocked] = useState([]); // boolean per index

  // flow state
  const [showResult, setShowResult] = useState(false);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);

  // feedback dialog state (floating bubble next to chosen option)
  const [feedback, setFeedback] = useState({
    visible: false,
    type: null, // 'correct' | 'wrong' | 'timeup'
    title: "",
    body: "",
    correctAnswer: "",
  });

  // where to draw the bubble (anchored to selected button)
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0, side: "right" }); // side: right|left

  // timers
  const startTime = useRef(Date.now());
  const tickRef = useRef(null);

  // option button refs (per question -> per option)
  const optionRefs = useRef({}); // { [qIndex]: [ref0, ref1, ...] }

  // backgrounds
  const resolvedBgs = useResolvedBackgrounds();
  const [bgIndex, setBgIndex] = useState(0);
  useEffect(() => {
    if (!resolvedBgs.length) return;
    const t = setInterval(() => setBgIndex((p) => (p + 1) % resolvedBgs.length), 9500);
    return () => clearInterval(t);
  }, [resolvedBgs.length]);

  /* ---------- load latest USCAN quiz ---------- */
  useEffect(() => {
    const fetchQuiz = async () => {
      const user = JSON.parse(localStorage.getItem("currentUser") || "null");
      const username = user?.username;
      if (!username) {
        setLoading(false);
        return;
      }

      try {
        const now = new Date();
        const q = query(
          collection(db, "uscan"),
          where("launchAt", "<=", now),
          orderBy("launchAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setLoading(false);
          return;
        }

        const docData = snap.docs[0].data();
        const quizId = snap.docs[0].id;
        const launchTime = dayjs(docData.launchAt?.toDate?.() || docData.launchAt);

        if (dayjs().isBefore(launchTime)) {
          setCountdown(launchTime.diff(dayjs(), "second"));
          setLoading(false);
          return;
        }

        const attempted = await hasUserAttemptedQuiz(username, quizId);
        if (attempted) {
          setQuizBlocked(true);
          setLoading(false);
          return;
        }

        const qs = Array.isArray(docData.questions) ? docData.questions : [];
        setQuiz({ ...docData, id: quizId });

        // init state (+ draft restore)
        const draftKey = `quizDraft:${username}:${quizId}`;
        const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
        const initAnswers = Array(qs.length).fill(null);
        const initPicked = Array(qs.length).fill(null);
        const initTime = Array(qs.length).fill(PER_QUESTION_SECONDS);
        const initLocked = Array(qs.length).fill(false);

        if (draft) {
          if (Array.isArray(draft.answers)) draft.answers.forEach((v, i) => (initAnswers[i] = v));
          if (Array.isArray(draft.timeLeftArr)) {
            draft.timeLeftArr.forEach(
              (v, i) => (initTime[i] = Math.max(0, Math.min(PER_QUESTION_SECONDS, v)))
            );
          }
          if (Array.isArray(draft.locked)) draft.locked.forEach((v, i) => (initLocked[i] = !!v));
        }

        setAnswers(initAnswers);
        setPickedIdx(initPicked);
        setTimeLeftArr(initTime);
        setLocked(initLocked);

        if (draft && typeof draft.currentQuestion === "number") {
          const idx = Math.max(0, Math.min(qs.length - 1, draft.currentQuestion));
          setCurrentQuestion(idx);
        }
      } catch (e) {
        console.error("Error fetching quiz:", e);
      }
      setLoading(false);
    };
    fetchQuiz();
  }, []);

  /* ---------- countdown until quiz start ---------- */
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setCountdown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  /* ---------- persist draft ---------- */
  const persistDraft = useCallback(() => {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    const username = user?.username;
    if (!username || !quiz?.id) return;
    const draftKey = `quizDraft:${username}:${quiz.id}`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({ answers, timeLeftArr, locked, currentQuestion })
    );
  }, [answers, timeLeftArr, locked, currentQuestion, quiz?.id]);

  /* ---------- tick per current question ---------- */
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
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [quiz, currentQuestion, locked, timeLeftArr[currentQuestion]]);

  /* ---------- when time hits 0, lock + bubble near first option (no auto-advance) ---------- */
  useEffect(() => {
    if (!quiz) return;
    const t = timeLeftArr[currentQuestion];
    if (t === 0 && !locked[currentQuestion]) {
      setLocked((prev) => {
        const n = [...prev];
        n[currentQuestion] = true;
        return n;
      });

      if (answers[currentQuestion] == null) {
        const q = quiz.questions[currentQuestion] || {};
        const correctAnswer =
          q?.answer || (Array.isArray(q?.options) ? q.options[q.correctIndex || 0] : "");
        setFeedback({
          visible: true,
          type: "timeup",
          title: "⏰ Time’s up!",
          body: q?.wrongBody || "You ran out of time.",
          correctAnswer: correctAnswer || "",
        });
        // anchor to first option (fallback)
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
    const assumedWidth = 300; // approximate bubble width for edge detection
    let left = r.right + gap;
    let side = "right";
    if (left + assumedWidth > window.innerWidth - 8) {
      left = Math.max(8, r.left - gap - assumedWidth);
      side = "left";
    }
    const top = r.top + r.height / 2; // translateY(-50%) in styles
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

  /* ---------- handle option selection: lock + show bubble (no auto-advance) ---------- */
  const handleSelect = (option, index) => {
    if (!quiz) return;
    const alreadyLocked = locked[currentQuestion] || timeLeftArr[currentQuestion] <= 0;
    if (alreadyLocked) return;

    const q = quiz.questions[currentQuestion];
    const correct = option === q.answer;
    playSound(correct);

    setAnswers((prev) => {
      const n = [...prev];
      n[currentQuestion] = option;
      return n;
    });
    setPickedIdx((prev) => {
      const n = [...prev];
      n[currentQuestion] = index;
      return n;
    });
    setLocked((prev) => {
      const n = [...prev];
      n[currentQuestion] = true;
      return n;
    });

    const correctAnswer =
      q?.answer || (Array.isArray(q?.options) ? q.options[q.correctIndex || 0] : "");
    if (correct) {
      setFeedback({
        visible: true,
        type: "correct",
        title: q.correctTitle || "Hey, that’s right! 🎉",
        body: q.correctBody || "",
        correctAnswer: "",
      });
    } else {
      setFeedback({
        visible: true,
        type: "wrong",
        title: q.wrongTitle || "That’s not correct",
        body: q.wrongBody || "",
        correctAnswer: correctAnswer || "",
      });
    }

    // position bubble next to the selected option
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
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else {
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
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    const username = user?.username;
    if (username) {
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
      await saveQuizResult(username, quiz.id, "uscan", finalScore, timeSpent);
      logActivity("QUIZ_ATTEMPT", `USCAN Quiz | Score: ${finalScore}/${quiz.questions.length}`);
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
      <div className="uscan-loading">
        ⏳ New quiz starts in {countdown}s
        <div>
          <button onClick={() => navigate("/region")}>Return to Region</button>
        </div>
      </div>
    );
  }

  if (quizBlocked) {
    return (
      <div className="uscan-background-wrapper">
        <div className="uscan-overlay-layer" />
        {resolvedBgs.map((src, i) => (
          <div
            key={i}
            className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className="uscan-container">
          <div className="uscan-box uscan-blocked">
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
      <div className="uscan-loading">
        No quiz available for USCAN
        <div>
          <button onClick={() => navigate("/region")}>Return to Region</button>
        </div>
      </div>
    );
  }

  const q = quiz.questions[currentQuestion];
  const selected = answers[currentQuestion];
  const isLocked = locked[currentQuestion] || timeLeftArr[currentQuestion] <= 0;

  return (
    <div className="uscan-background-wrapper">
      <div className="uscan-overlay-layer" />
      {resolvedBgs.map((src, i) => (
        <div
          key={i}
          className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}

      <div className="uscan-container">
        <div className="uscan-box" style={{ overflow: "hidden" }}>
          {!showResult ? (
            <>
              {/* progress */}
              <div
                style={{
                  position: "relative",
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.25)",
                  overflow: "hidden",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${percentDone}%`,
                    transition: "width 320ms ease",
                    background:
                      "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(16,185,129,0.9))",
                  }}
                />
              </div>

              <h2
                className="uscan-question"
                style={{
                  transition: "transform 200ms ease, opacity 200ms ease",
                  willChange: "transform,opacity",
                }}
                key={`q-${currentQuestion}`}
              >
                Q{currentQuestion + 1}: {q.question}
              </h2>

              {/* per-question timer bar */}
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.15)",
                  overflow: "hidden",
                  margin: "6px 0 12px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(timeLeftArr[currentQuestion] / PER_QUESTION_SECONDS) * 100}%`,
                    transition: "width 1000ms linear",
                    background:
                      timeLeftArr[currentQuestion] > 5
                        ? "rgba(34,197,94,0.9)"
                        : "rgba(239,68,68,0.9)",
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
                        if (!optionRefs.current[currentQuestion])
                          optionRefs.current[currentQuestion] = [];
                        optionRefs.current[currentQuestion][index] = el;
                      }}
                      onClick={() => handleSelect(option, index)}
                      className={`uscan-option ${
                        selected
                          ? isCorrectNow
                            ? "correct"
                            : isWrongPick
                            ? "incorrect"
                            : ""
                          : ""
                      }`}
                      disabled={isLocked}
                      style={{
                        transform: selected === option ? "scale(0.98)" : "scale(1)",
                        transition: "transform 150ms ease, opacity 200ms ease",
                        opacity: isLocked && !selected ? 0.7 : 1,
                      }}
                    >
                      <span style={{ opacity: 0.8, fontSize: 12, marginRight: 6 }}>
                        {index + 1}.
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>

              <div
                className="uscan-footer"
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <span>⏱ {timeLeftArr[currentQuestion]}s</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={goPrev} disabled={currentQuestion === 0}>
                    Previous
                  </button>
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
              <p
                className={`uscan-score ${
                  (computeScore() / quiz.questions.length) * 100 >= 80 ? "pass" : "fail"
                }`}
              >
                {(computeScore() / quiz.questions.length) * 100 >= 80
                  ? "✅ Great! You passed."
                  : "❌ You did not pass."}
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

export default USCAN;
