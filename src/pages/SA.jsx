// src/pages/SA.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
  query,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import { saveQuizResult } from "../utils/firestoreUtils";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import dayjs from "dayjs";
import "../styles/sa.css";

function SA() {
  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState(null);
  const startTime = useRef(Date.now());
  const navigate = useNavigate();

  const regionKey = "sa";
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const username = user?.username;

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const q = query(collection(db, regionKey), orderBy("createdAt", "desc"), limit(1));
        const qSnap = await getDocs(q);

        if (qSnap.empty) {
          setLoading(false);
          return;
        }

        const latestQuiz = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };

        // Optional scheduled start
        const startTimeQuiz = latestQuiz.startTime
          ? dayjs(latestQuiz.startTime.toDate?.() || latestQuiz.startTime)
          : null;
        if (startTimeQuiz && startTimeQuiz.isAfter(dayjs())) {
          setUpcoming(startTimeQuiz);
          setLoading(false);
          return;
        }

        // Block if already taken (admin bypass) — check multiple legacy fields
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
              taken.includes(latestQuiz.id) ||
              attempted.includes(latestQuiz.id) ||
              Boolean(attemptsMap[latestQuiz.id]);

            if (!isAdmin && already) {
              setQuizBlocked(true);
              setLoading(false);
              return;
            }
          }
        }

        setQuiz(latestQuiz);
      } catch (err) {
        console.error("Error fetching quiz:", err);
      }
      setLoading(false);
    };

    fetchQuiz();
  }, [username]);

  useEffect(() => {
    if (quizFinished || selected !== null || quizBlocked || upcoming) return;
    if (timeLeft === 0) {
      handleNext();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, selected, quizFinished, quizBlocked, upcoming]);

  const handleOptionClick = (option) => {
    if (selected) return;
    setSelected(option);

    const isCorrect = option === quiz.questions[currentQ].answer;
    if (isCorrect) setScore((prev) => prev + 1);

    const audio = new Audio(isCorrect ? correctSound : wrongSound);
    audio.play();

    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  const handleNext = async () => {
    if (currentQ + 1 < quiz.questions.length) {
      setCurrentQ(currentQ + 1);
      setSelected(null);
      setTimeLeft(30);
    } else {
      setQuizFinished(true);

      if (!username) return;
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);

      // save result
      await saveQuizResult(username, quiz.id, regionKey, score, timeSpent);

      // ensure next visits are blocked (compat with all schemas)
      try {
        const userRef = doc(db, "users", username);
        await updateDoc(userRef, {
          takenQuizzes: arrayUnion(quiz.id),
          attemptedQuizzes: arrayUnion(quiz.id),
          // If you also track a map:
          // ["attempts." + quiz.id]: true,
        });
      } catch (e) {
        console.warn("SA: failed to tag user doc with quiz id:", e);
      }
    }
  };

  const isPassed = quiz ? (score / quiz.questions.length) * 100 >= 80 : false;

  if (loading) return <p className="sa-box">Loading...</p>;

  if (upcoming) {
    return (
      <div className="sa-container">
        <div className="sa-box sa-result">
          <h2>📅 Upcoming Quiz</h2>
          <p>Next South Asia quiz will start on:</p>
          <strong>{upcoming.format("YYYY-MM-DD HH:mm")}</strong>
          <button className="sa-footer-button" onClick={() => navigate("/region")}>
            🔙 Return to Region
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="sa-container">
        <div className="sa-box sa-result">
          <h2>No quiz available for South Asia</h2>
          <button className="sa-footer-button" onClick={() => navigate("/region")}>
            🔙 Return to Region
          </button>
        </div>
      </div>
    );
  }

  if (quizBlocked) {
    return (
      <div className="sa-container">
        <div className="sa-box sa-result">
          <h2 className="text-red-500 text-xl font-bold mb-4">⛔ Quiz Already Taken</h2>
          <p>You’ve already taken the latest South Asia quiz.</p>
          <p>Wait for the next one to participate again.</p>
          <button className="sa-footer-button" onClick={() => navigate("/region")}>
            🔙 Return to Region
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-container">
      <div className="sa-box">
        {!quizFinished ? (
          <>
            <div className="sa-question">
              Question {currentQ + 1} of {quiz.questions.length}
            </div>
            <div className="sa-timer">⏱ Time Left: {timeLeft}s</div>
            <div className="sa-question">{quiz.questions[currentQ].question}</div>

            <div className="sa-options">
              {quiz.questions[currentQ].options.map((option, idx) => {
                let className = "sa-option";
                if (selected) {
                  if (option === quiz.questions[currentQ].answer) {
                    className += " correct";
                  } else if (option === selected) {
                    className += " incorrect";
                  }
                }
                return (
                  <div
                    key={idx}
                    className={className}
                    onClick={() => handleOptionClick(option)}
                  >
                    {option}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="sa-result">
            <h2>✅ Quiz Complete!</h2>
            <div>
              Your Score: {score} / {quiz.questions.length}
            </div>
            <div className={isPassed ? "text-green-500" : "text-red-500"}>
              {isPassed ? "Passed ✅" : "Failed ❌"}
            </div>
            <button className="sa-footer-button" onClick={() => navigate("/region")}>
              Return to Region
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SA;
