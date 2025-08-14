// src/pages/LATAM.jsx
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
import { saveQuizResult } from "../utils/firestoreUtils";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import dayjs from "dayjs";
import "../styles/latam.css";
import LoadingScreen from "../components/LoadingScreen";

const PER_QUESTION_SECONDS = 30;

/* ---------- Background helpers: /public/latam/bg{1..5}.{jpeg|jpg|png|webp} ---------- */
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
      const exts = ["jpeg", "jpg", "png", "webp"];
      const candidates = [];
      bases.forEach((b) => exts.forEach((e) => candidates.push(`/latam/${b}.${e}`)));
      const checks = await Promise.all(candidates.map(tryLoad));
      const good = checks.filter((c) => c.ok).map((c) => c.url);
      if (!cancelled) {
        setBgImages(good);
        if (good.length === 0) {
          console.warn("[LATAM] No background images found. Place bg1..bg5 in /public/latam.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return bgImages;
};
/* --------------------------------------------------------------------------- */

function LATAM() {
  const navigate = useNavigate();
  const regionKey = "latam";

  // quiz + per-question state
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);           // string | null per index
  const [pickedIdx, setPickedIdx] = useState([]);       // number | null per index
  const [timeLeftArr, setTimeLeftArr] = useState([]);   // seconds remaining per index
  const [locked, setLocked] = useState([]);             // boolean per index

  // flow state
  const [showResult, setShowResult] = useState(false);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null); // supports optional launchAt/startTime

  // feedback bubble (outside box, near picked option)
  const [feedback, setFeedback] = useState({
    visible: false,
    type: null, // 'correct' | 'wrong' | 'timeup'
    title: "",
    body: "",
    correctAnswer: "",
  });
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0, side: "right" });

  // timers & refs
  const startTime = useRef(Date.now());
  const tickRef = useRef(null);
  const optionRefs = useRef({}); // { [qIndex]: [ref0, ref1, ...] }

  // current user
  const user = JSON.parse(localStorage.getItem("currentUser") || "null");
  const username = user?.username;

  // backgrounds
  const resolvedBgs = useResolvedBackgrounds();
  const [bgIndex, setBgIndex] = useState(0);
  useEffect(() => {
    if (!resolvedBgs.length) return;
    const t = setInterval(() => setBgIndex((p) => (p + 1) % resolvedBgs.length), 9500);
    return () => clearInterval(t);
  }, [resolvedBgs.length]);

  /* ---------- fetch latest LATAM quiz, block repeats ---------- */
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const qRef = query(collection(db, regionKey), orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(qRef);
        if (snap.empty) {
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data();
        const quizId = docSnap.id;

        // Optional scheduled start (launchAt or startTime if present)
        const launchMoment = dayjs(
          data.launchAt?.toDate?.() ||
            data.launchAt ||
            data.startTime?.toDate?.() ||
            data.startTime
        );
        if (launchMoment.isValid() && dayjs().isBefore(launchMoment)) {
          setCountdown(launchMoment.diff(dayjs(), "second"));
          setLoading(false);
          return;
        }

        // Block retakes (admin bypass) across legacy fields
        if (username) {
          const userRef = doc(db, "users", username);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          const isAdmin = userData?.role === "admin";
          const taken = userData?.takenQuizzes || [];
          const attempted = userData?.attemptedQuizzes || [];
          const attemptsMap = userData?.attempts || {};
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

        // init quiz
        const qs = Array.isArray(data.questions) ? data.questions : [];
        setQuiz({ ...data, id: quizId });

        // init per-question state
        setAnswers(Array(qs.length).fill(null));
        setPickedIdx(Array(qs.length).fill(null));
        setTimeLeftArr(Array(qs.length).fill(PER_QUESTION_SECONDS));
        setLocked(Array(qs.length).fill(false));
      } catch (err) {
        console.error("LATAM: error while fetching quiz:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  /* ---------- launch countdown tick ---------- */
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

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
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [quiz, currentQuestion, locked, timeLeftArr[currentQuestion]]);

  /* ---------- time up handling (no auto-advance) ---------- */
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
          q?.answer ||
          (Array.isArray(q?.options) ? q.options[q.correctIndex || 0] : "");
        setFeedback({
          visible: true,
          type: "timeup",
          title: "⏰ Time’s up!",
          body: q?.wrongBody || "You ran out of time.",
          correctAnswer: correctAnswer || "",
        });
        // anchor near first option as a fallback
        requestAnimationFrame(() => updateBubblePos(currentQuestion, 0));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeftArr, answers, currentQuestion]);

  /* ---------- get correct index for reveal ---------- */
  const getCorrectIndex = (qObj) => {
    if (!qObj) return -1;
    if (typeof qObj.correctIndex === "number") return Number(qObj.correctIndex);
    if (typeof qObj.answer === "string" && Array.isArray(qObj.options)) {
      const ans = qObj.answer.trim();
      const idx = qObj.options.findIndex((o) => String(o ?? "").trim() === ans);
      return idx >= 0 ? idx : -1;
    }
    return -1;
  };

  /* ---------- compute bubble position next to an option ---------- */
  const updateBubblePos = (qIndex, optIndex) => {
    const btn = optionRefs.current?.[qIndex]?.[optIndex];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 12;
    const assumedWidth = 300; // approximate bubble width
    let left = r.right + gap;
    let side = "right";
    if (left + assumedWidth > window.innerWidth - 8) {
      left = Math.max(8, r.left - gap - assumedWidth);
      side = "left";
    }
    const top = r.top + r.height / 2;
    setBubblePos({ top, left, side });
  };

  // keep bubble aligned on resize
  useEffect(() => {
    if (!feedback.visible) return;
    const handle = () => {
      const oi = pickedIdx[currentQuestion] != null ? pickedIdx[currentQuestion] : 0;
      updateBubblePos(currentQuestion, oi);
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [feedback.visible, currentQuestion, pickedIdx]);

  const playSound = (ok) => {
    const audio = new Audio(ok ? correctSound : wrongSound);
    audio.play().catch(() => {});
  };

  /* ---------- choose option: lock + show bubble ---------- */
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

    // position bubble near picked option
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

  /* ---------- score + submit ---------- */
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

    try {
      if (username) {
        const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
        await saveQuizResult(username, quiz.id, regionKey, finalScore, timeSpent);
        const userRef = doc(db, "users", username);
        await updateDoc(userRef, {
          takenQuizzes: arrayUnion(quiz.id),
          attemptedQuizzes: arrayUnion(quiz.id),
        });
      }
    } catch (err) {
      console.error("LATAM: error saving result / tagging user doc:", err);
    }
  };

  const percentDone = useMemo(
    () => (quiz ? Math.round(((currentQuestion + 1) / quiz.questions.length) * 100) : 0),
    [quiz, currentQuestion]
  );

  /* ---------- UI ---------- */
  if (loading) {
    // ✅ Default loading screen (same component used in AFR/USCAN)
    return <LoadingScreen />;
  }

  if (countdown !== null) {
    return (
      <div className="latam-loading">
        ⏳ New quiz starts in {countdown}s
        <div>
          <button onClick={() => navigate("/region")}>Return to Region</button>
        </div>
      </div>
    );
  }

  if (quizBlocked) {
    return (
      <div className="latam-background-wrapper">
        <div className="latam-overlay-layer" />
        {resolvedBgs.map((src, i) => (
          <div
            key={i}
            className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className="latam-container">
          <div className="latam-box latam-blocked">
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
      <div className="latam-loading">
        No quiz available for LATAM
        <div>
          <button onClick={() => navigate("/region")}>Return to Region</button>
        </div>
      </div>
    );
  }

  const q = quiz.questions[currentQuestion];
  const selected = answers[currentQuestion];
  const isLocked = locked[currentQuestion] || timeLeftArr[currentQuestion] <= 0;
  const revealIdx = selected != null ? getCorrectIndex(q) : null;

  return (
    <div className="latam-background-wrapper">
      <div className="latam-overlay-layer" />
      {resolvedBgs.map((src, i) => (
        <div
          key={i}
          className={`bg-fade-layer ${i === bgIndex ? "visible" : ""}`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}

      <div className="latam-container">
        <div className="latam-box" style={{ overflow: "hidden" }}>
          {!showResult ? (
            <>
              {/* progress bar */}
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
                className="latam-question"
                style={{ transition: "transform 200ms ease, opacity 200ms ease" }}
                key={`q-${currentQuestion}`}
              >
                Q{currentQuestion + 1}: {q.question}
              </h2>

              {/* per-question time bar */}
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

              <div className="latam-options" style={{ gap: 10 }}>
                {q.options.map((option, index) => {
                  const isCorrectNow = selected && index === revealIdx;
                  const isWrongPick =
                    selected === option && revealIdx !== null && index !== revealIdx;
                  return (
                    <button
                      key={index}
                      ref={(el) => {
                        if (!optionRefs.current[currentQuestion])
                          optionRefs.current[currentQuestion] = [];
                        optionRefs.current[currentQuestion][index] = el;
                      }}
                      onClick={() => handleSelect(option, index)}
                      className={`latam-option ${
                        selected ? (isCorrectNow ? "correct" : isWrongPick ? "incorrect" : "") : ""
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

              <div className="latam-footer" style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            <div className="latam-result we-result">
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

        {/* ===== Floating feedback bubble near the picked option ===== */}
        {feedback.visible && (
          <div
            role="dialog"
            aria-live="polite"
            tabIndex={-1}
            className="latam-feedback-bubble"
            data-type={feedback.type}
            data-side={bubblePos.side}
            style={{ top: bubblePos.top, left: bubblePos.left }}
          >
            <span className="latam-feedback-arrow" />
            <div className="latam-feedback-title">{feedback.title}</div>
            {feedback.body && <div className="latam-feedback-body">{feedback.body}</div>}
            {feedback.correctAnswer && (
              <div className="latam-feedback-ans">
                <strong>Correct answer:</strong> {feedback.correctAnswer}
              </div>
            )}
            <div className="latam-feedback-actions">
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

export default LATAM;
