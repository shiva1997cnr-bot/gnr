// src/pages/WE.jsx
import React, { useState, useEffect, useRef } from "react";
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
import duration from "dayjs/plugin/duration";
import "../styles/we.css";

dayjs.extend(duration);

function WE() {
  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null); // null=not chosen, -1=timed out, 0..n=chosen
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(true);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [countdown, setCountdown] = useState(null); // optional: if your docs have launchAt/startTime
  const [showResult, setShowResult] = useState(false);

  const startTime = useRef(Date.now());
  const navigate = useNavigate();
  const regionKey = "we";

  const user = JSON.parse(localStorage.getItem("currentUser"));
  const username = user?.username;

  // Resolve correct option index from either schema (answer string or correctIndex)
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

  // Fetch latest quiz (by createdAt desc, consistent with ESEA/LATAM), handle optional launchAt/startTime, and block if already taken
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        // get ONLY the latest quiz
        const qRef = query(collection(db, regionKey), orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(qRef);

        if (snap.empty) {
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data();
        const quizId = docSnap.id;

        // Optional scheduled start support (launchAt or startTime if present)
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

        // Block retakes (admin bypass) — check all legacy fields
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

        setQuiz({ ...data, id: quizId });
      } catch (err) {
        console.error("WE: error while fetching quiz:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Launch countdown tick (only if a future start was detected)
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Per-question timer
  useEffect(() => {
    if (!quiz || selectedIndex !== null || showResult || quizBlocked) return;
    if (timeLeft === 0) {
      // treat timeout as incorrect; user can press Next
      setSelectedIndex(-1);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, quiz, selectedIndex, showResult, quizBlocked]);

  // Click option by INDEX (not by text)
  const handleOptionClick = (index) => {
    if (selectedIndex !== null) return;
    setSelectedIndex(index);

    const qObj = quiz.questions[currentQ];
    const correctIdx = getCorrectIndex(qObj);
    const isCorrect = index === correctIdx;

    if (isCorrect) setScore((s) => s + 1);

    const audio = new Audio(isCorrect ? correctSound : wrongSound);
    audio.play();
  };

  const handleNext = async () => {
    const nextIndex = currentQ + 1;
    if (nextIndex < (quiz?.questions?.length || 0)) {
      setCurrentQ(nextIndex);
      setSelectedIndex(null);
      setTimeLeft(30);
      return;
    }

    // finished
    setShowResult(true);

    // save result and ensure future blocks
    try {
      if (!username) return;
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);

      // Save result (your util)
      await saveQuizResult(username, quiz.id, regionKey, score, timeSpent);

      // Ensure the next visit is blocked (compat with all schemas)
      const userRef = doc(db, "users", username);
      await updateDoc(userRef, {
        takenQuizzes: arrayUnion(quiz.id),
        attemptedQuizzes: arrayUnion(quiz.id),
        // If you also keep a map, uncomment:
        // ["attempts." + quiz.id]: true,
      });
    } catch (err) {
      console.error("WE: error saving result / tagging user doc:", err);
    }
  };

  const percentScore = quiz ? Math.round((score / quiz.questions.length) * 100) : 0;
  const passed = percentScore >= 80;

  // --- UI states ---
  if (loading)
    return (
      <div className="we-container">
        <div className="we-box">Loading...</div>
      </div>
    );

  if (countdown !== null)
    return (
      <div className="we-container">
        <div className="we-box">
          <h2>⏳ New Quiz Coming Soon!</h2>
          <p>Starts in: {dayjs.duration(countdown, "seconds").format("HH:mm:ss")}</p>
          <button onClick={() => navigate("/region")} className="we-footer-btn">
            ← Return
          </button>
        </div>
      </div>
    );

  if (!quiz)
    return (
      <div className="we-container">
        <div className="we-box">
          <h2>No quiz available for Western Europe</h2>
          <button onClick={() => navigate("/region")}>← Return</button>
        </div>
      </div>
    );

  if (quizBlocked)
    return (
      <div className="we-container">
        <div className="we-box we-blocked">
          ⛔ You already attempted this quiz.
          <br />
          <button onClick={() => navigate("/region")}>← Return</button>
        </div>
      </div>
    );

  const current = quiz.questions[currentQ];
  const revealIdx = selectedIndex !== null ? getCorrectIndex(current) : null;

  return (
    <div className="we-container">
      <div className="we-box">
        {!showResult ? (
          <>
            <div className="we-header">
              <button onClick={() => navigate("/region")} className="back-btn">
                ←
              </button>
              <h2>Western Europe Quiz</h2>
            </div>

            <div className="we-timer">Time Left: {timeLeft}s</div>

            <h3 className="we-question">{current.question}</h3>

            <div className="we-options">
              {current.options.map((opt, i) => {
                let cls = "";
                if (selectedIndex !== null) {
                  if (i === revealIdx) cls = "correct";
                  else if (i === selectedIndex && selectedIndex !== revealIdx) cls = "incorrect";
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleOptionClick(i)}
                    className={`we-option ${cls}`}
                    disabled={selectedIndex !== null}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="we-footer">
              {selectedIndex !== null ? (
                <button onClick={handleNext} className="we-next-btn">
                  Next
                </button>
              ) : (
                <small>Pick an answer — or wait for timer to skip</small>
              )}
            </div>
          </>
        ) : (
          <div className="we-result">
            <h2>Quiz Completed 🎉</h2>
            <p>
              Your Score: {score} / {quiz.questions.length} ({percentScore}%)
            </p>
            <p className={passed ? "pass" : "fail"}>
              {passed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button onClick={() => navigate("/region")}>← Return</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WE;
