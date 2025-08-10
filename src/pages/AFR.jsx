// src/pages/AFR.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";
import "../styles/afr.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { hasUserAttemptedQuiz, saveQuizResult } from "../utils/firestoreUtils";
import { logActivity } from "../utils/activityLogger";
import LoadingScreen from "../components/LoadingScreen";

function AFR() {
  // quiz + UI state
  const [quiz, setQuiz] = useState(null);                 // full quiz doc
  const [quizId, setQuizId] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // gating/flags
  const [quizBlocked, setQuizBlocked] = useState(false);  // already attempted
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);       // seconds until launch

  // misc
  const startTime = useRef(Date.now());
  const navigate = useNavigate();
  const regionKey = "afr";

  // keep your background untouched
  const bgImages = ["/afr/bg1.webp", "/afr/bg2.webp", "/afr/bg3.webp", "/afr/bg4.webp"];
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % bgImages.length);
    }, 9500);
    return () => clearInterval(interval);
  }, []);

  const user = JSON.parse(localStorage.getItem("currentUser"));
  const username = user?.username;

  // --- Fetch latest AFR quiz (US/CAN-style logic: launchAt + countdown + attempted check) ---
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        if (!username) {
          setLoading(false);
          return;
        }

        const now = new Date();
        // mirror US/CAN query: only quizzes whose launchAt <= now, ordered by launchAt desc, top 1
        const q = query(
          collection(db, regionKey),
          where("launchAt", "<=", now),
          orderBy("launchAt", "desc"),
          limit(1)
        );

        const snap = await getDocs(q);
        if (snap.empty) {
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data();
        const id = docSnap.id;
        setQuizId(id);

        // handle scheduled launch (same behavior as your US/CAN page):
        const launchTime = dayjs(data.launchAt?.toDate?.() || data.launchAt);
        if (dayjs().isBefore(launchTime)) {
          setCountdown(launchTime.diff(dayjs(), "second"));
          setLoading(false);
          return;
        }

        // attempted check using hasUserAttemptedQuiz (US/CAN style)
        const attempted = await hasUserAttemptedQuiz(username, id);
        if (attempted) {
          setQuizBlocked(true);
          setLoading(false);
          return;
        }

        setQuiz({ id, ...data });
      } catch (err) {
        console.error("Error fetching AFR quiz:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [username]);

  // --- Countdown to launch (US/CAN behavior: simple ticking & reload at 0) ---
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // --- Per-question timer (pause when an option is chosen or result shown) ---
  useEffect(() => {
    if (!quiz || selected || showResult || quizBlocked) return;
    if (timeLeft === 0) {
      handleNext();
      return;
    }
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, quiz, selected, showResult, quizBlocked]);

  const handleOptionClick = (option) => {
    if (selected) return; // prevent multiple clicks on the same question
    setSelected(option);

    const correct = option === quiz.questions[currentQ].answer;
    if (correct) setScore((prev) => prev + 1);

    const audio = new Audio(correct ? correctSound : wrongSound);
    audio.play();
    // US/CAN style: do NOT auto-advance; show "Next" button once selected
  };

  const handleNext = async () => {
    if (!quiz) return;

    if (currentQ + 1 < quiz.questions.length) {
      setCurrentQ((prev) => prev + 1);
      setSelected(null);
      setTimeLeft(30);
    } else {
      setShowResult(true);

      if (!username || !quizId) return;
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);

      // saveQuizResult(username, quizId, regionKey, score, timeSpent)
      await saveQuizResult(username, quizId, regionKey, score, timeSpent);

      // optional: activity log (mirrors US/CAN)
      try {
        logActivity(
          "QUIZ_ATTEMPT",
          `AFR Quiz | Score: ${score}/${quiz.questions.length}`
        );
      } catch (e) {
        // non-blocking
        console.warn("logActivity failed:", e);
      }
    }
  };

  const passed = quiz ? (score / quiz.questions.length) * 100 >= 80 : false;

  // --- UI states (US/CAN-style) ---
  if (loading) return <LoadingScreen />;
  if (countdown !== null) {
    return (
      <div className="afr-loading">⏳ New quiz starts in {countdown}s</div>
    );
  }
  if (quizBlocked) {
    // ⬇️ ONLY THIS BLOCK CHANGED to match WE: message + Return button, with background intact
    return (
      <div
        className="afr-container"
        style={{ backgroundImage: `url(${bgImages[bgIndex]})` }}
      >
        <div className="afr-box afr-blocked">
          ⛔ You already attempted this quiz.
          <br />
          <button onClick={() => navigate("/region")}>← Return to Region</button>
        </div>
      </div>
    );
  }
  if (!quiz) {
    return (
      <div className="afr-loading">No quiz available for AFR</div>
    );
  }

  // --- Main render (background untouched, AFR classes kept) ---
  return (
    <div
      className="afr-container"
      style={{ backgroundImage: `url(${bgImages[bgIndex]})` }}
    >
      <div className="afr-box">
        {!showResult ? (
          <>
            <div className="afr-question">
              Q{currentQ + 1}: {quiz.questions[currentQ].question}
            </div>

            <div className="afr-options">
              {quiz.questions[currentQ].options.map((option, index) => (
                <div
                  key={index}
                  onClick={() => handleOptionClick(option)}
                  className={`afr-option ${
                    selected
                      ? option === quiz.questions[currentQ].answer
                        ? "correct"
                        : option === selected
                        ? "incorrect"
                        : ""
                      : ""
                  }`}
                >
                  {option}
                </div>
              ))}
            </div>

            <div className="afr-footer">
              <span>⏱ {timeLeft}s</span>
              {selected && (
                <button className="afr-next" onClick={handleNext}>
                  Next
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="afr-result">
            <h2 className="text-3xl font-bold mb-4">✅ Quiz Completed!</h2>
            <p className="afr-score">
              Your Score: {score} / {quiz.questions.length}
            </p>
            <p className={passed ? "text-green-500" : "text-red-500"}>
              {passed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button className="afr-footer-button" onClick={() => navigate("/region")}>
              Return to Region
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AFR;
