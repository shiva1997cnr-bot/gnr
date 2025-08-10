// src/pages/USCAN.jsx
import React, { useState, useEffect, useRef } from "react";
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

function USCAN() {
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const startTime = useRef(Date.now());
  const navigate = useNavigate();

  const bgImages = [
    "/us/bg1.webp",
    "/us/bg2.webp",
    "/us/bg3.webp",
    "/us/bg4.webp",
    "/us/bg5.webp",
    "/us/bg6.webp",
    "/us/bg7.webp",
  ];
  const [bgIndex, setBgIndex] = useState(0);

  // Background cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % bgImages.length);
    }, 9500);
    return () => clearInterval(interval);
  }, []);

  // Fetch latest quiz from "uscan" collection
  useEffect(() => {
    const fetchQuiz = async () => {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      const username = user?.username;
      if (!username) {
        setLoading(false);
        return;
      }

      try {
        const now = new Date();

        // Only get quizzes whose launchAt is before now
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

        // If quiz is scheduled in future
        if (dayjs().isBefore(launchTime)) {
          setCountdown(launchTime.diff(dayjs(), "second"));
          setLoading(false);
          return;
        }

        // Check if user already attempted this quiz
        const attempted = await hasUserAttemptedQuiz(username, quizId);
        if (attempted) {
          setQuizBlocked(true);
          setLoading(false);
          return;
        }

        setQuiz({ ...docData, id: quizId });
      } catch (error) {
        console.error("Error fetching quiz:", error);
      }
      setLoading(false);
    };

    fetchQuiz();
  }, []);

  // Countdown for quiz launch
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      window.location.reload();
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Timer for each question
  useEffect(() => {
    if (!quiz || selected) return;
    if (timeLeft === 0) handleNext();
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, quiz, selected]);

  const handleOptionClick = (option) => {
    if (selected) return;
    setSelected(option);

    const correct = option === quiz.questions[currentQuestion].answer;
    if (correct) setScore((prev) => prev + 1);

    const audio = new Audio(correct ? correctSound : wrongSound);
    audio.play();
  };

  const handleNext = async () => {
    if (currentQuestion + 1 < quiz.questions.length) {
      setCurrentQuestion((prev) => prev + 1);
      setSelected(null);
      setTimeLeft(30);
    } else {
      setShowResult(true);
      await saveScore();
    }
  };

  const saveScore = async () => {
    const user = JSON.parse(localStorage.getItem("currentUser"));
    const username = user?.username;
    if (!username) return;

    const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
    await saveQuizResult(username, quiz.id, "uscan", score, timeSpent);

    logActivity("QUIZ_ATTEMPT", `USCAN Quiz | Score: ${score}/${quiz.questions.length}`);
  };

  const getPassFailText = () => {
    const percent = (score / quiz.questions.length) * 100;
    return percent >= 80 ? "✅ Great! You passed." : "❌ You did not pass.";
  };

  // UI states
  if (loading) return <LoadingScreen />;

  if (countdown !== null)
    return (
      <div className="uscan-loading">
        ⏳ New quiz starts in {countdown}s
        <div>
          <button onClick={() => navigate("/region")}>Return to Region</button>
        </div>
      </div>
    );

  // ⬇️ UPDATED to match AFR: show glassy box over rotating background
  if (quizBlocked)
    return (
      <div className="uscan-background-wrapper">
        <div className="uscan-overlay-layer"></div>
        {bgImages.map((src, index) => (
          <div
            key={index}
            className={`bg-fade-layer ${index === bgIndex ? "visible" : ""}`}
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

  if (!quiz)
    return (
      <div className="uscan-loading">
        No quiz available for USCAN
        <div>
          <button onClick={() => navigate("/region")}>Return to Region</button>
        </div>
      </div>
    );

  return (
    <div className="uscan-background-wrapper">
      <div className="uscan-overlay-layer"></div>
      {bgImages.map((src, index) => (
        <div
          key={index}
          className={`bg-fade-layer ${index === bgIndex ? "visible" : ""}`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}

      <div className="uscan-container">
        <div className="uscan-box">
          {!showResult ? (
            <>
              <h2 className="uscan-question">
                Q{currentQuestion + 1}: {quiz.questions[currentQuestion].question}
              </h2>
              <div className="uscan-options">
                {quiz.questions[currentQuestion].options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleOptionClick(option)}
                    className={`uscan-option ${
                      selected
                        ? option === quiz.questions[currentQuestion].answer
                          ? "correct"
                          : option === selected
                          ? "incorrect"
                          : ""
                        : ""
                    }`}
                    disabled={!!selected}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="uscan-footer">
                <span>⏱ {timeLeft}s</span>
                {selected && <button onClick={handleNext}>Next</button>}
              </div>
            </>
          ) : (
            // WE-style result styling only (unchanged)
            <div className="uscan-result we-result">
              <h2>Quiz Completed 🎉</h2>
              <p className="uscan-score">
                Your Score: {score} / {quiz.questions.length} (
                {Math.round((score / quiz.questions.length) * 100)}%)
              </p>
              <p
                className={`uscan-score ${
                  (score / quiz.questions.length) * 100 >= 80 ? "pass" : "fail"
                }`}
              >
                {getPassFailText()}
              </p>
              <button onClick={() => navigate("/region")}>Return to Region</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default USCAN;
