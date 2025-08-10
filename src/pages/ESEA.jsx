// src/pages/ESEA.jsx
import "../styles/esea.css";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import "../styles/app.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { saveQuizResult } from "../utils/firestoreUtils";

function ESEA() {
  const [quiz, setQuiz] = useState(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [showScore, setShowScore] = useState(false);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const startTime = useRef(Date.now());

  const user = JSON.parse(localStorage.getItem("currentUser"));
  const username = user?.username;

  const regionKey = "esea"; // ESEA collection name in Firestore

  // Fetch latest quiz + block if already taken (admin bypass)
  useEffect(() => {
    const fetchQuiz = async () => {
      if (!username) {
        setLoading(false);
        return;
      }

      try {
        // get ONLY the latest quiz via createdAt desc
        const q = query(collection(db, regionKey), orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          setLoading(false);
          return;
        }

        const latest = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setQuiz(latest);

        // read user doc once; check multiple possible fields for backward compatibility
        const userRef = doc(db, "users", username);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          const isAdmin = data?.role === "admin";
          const taken = data?.takenQuizzes || [];
          const attempted = data?.attemptedQuizzes || [];
          const attemptsMap = data?.attempts || {};

          const already =
            taken.includes(latest.id) ||
            attempted.includes(latest.id) ||
            Boolean(attemptsMap[latest.id]);

          if (!isAdmin && already) {
            setQuizBlocked(true);
          }
        }
      } catch (error) {
        console.error("Error fetching quiz:", error);
      }

      setLoading(false);
    };

    fetchQuiz();
  }, [username]);

  // Timer countdown
  useEffect(() => {
    if (selected !== null || showScore || quizBlocked) return;

    const timer = setTimeout(() => {
      if (time > 0) {
        setTime((prev) => prev - 1);
      } else {
        handleNext();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [time, selected, showScore, quizBlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOption = (option) => {
    if (selected) return;

    setSelected(option);
    const isCorrect = option === quiz.questions[current].answer;

    const sound = new Audio(isCorrect ? correctSound : wrongSound);
    sound.play();

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  const handleNext = async () => {
    if (!quiz) return;

    if (current < quiz.questions.length - 1) {
      setCurrent((prev) => prev + 1);
      setSelected(null);
      setTime(30);
    } else {
      setShowScore(true);

      if (!username || !quiz?.id) return;

      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);

      // Save result (your util)
      await saveQuizResult(username, quiz.id, regionKey, score, timeSpent);

      // 🔒 Ensure the block will work next time:
      // Persist quiz.id to both takenQuizzes and attemptedQuizzes for compatibility.
      try {
        const userRef = doc(db, "users", username);
        await updateDoc(userRef, {
          takenQuizzes: arrayUnion(quiz.id),
          attemptedQuizzes: arrayUnion(quiz.id),
          // If you also keep a map, uncomment next line:
          // ["attempts." + quiz.id]: true,
        });
      } catch (e) {
        console.warn("Failed to append quiz to user.takenQuizzes/attemptedQuizzes:", e);
      }
    }
  };

  const getOptionClass = (option) => {
    if (!selected) return "esea-option";
    if (option === quiz.questions[current].answer) return "esea-option correct";
    if (option === selected) return "esea-option incorrect";
    return "esea-option";
  };

  const isPassed = quiz ? (score / quiz.questions.length) * 100 >= 80 : false;

  if (loading) return <p className="esea-box">Loading...</p>;

  if (!quiz) {
    return (
      <div className="esea-container">
        <div className="esea-box">
          <h2>No quiz available for ESEA</h2>
          <button onClick={() => navigate("/region")}>🔙 Return to Region</button>
        </div>
      </div>
    );
  }

  if (quizBlocked) {
    return (
      <div className="esea-container">
        <div className="esea-box esea-result">
          <h2 className="text-red-500 text-xl font-bold mb-4">⛔ Quiz Already Taken</h2>
          <p className="mb-4">You've already taken the <strong>ESEA</strong> quiz.</p>
          <p>Wait until a new quiz is created to try again!</p>
          <button onClick={() => navigate("/region")}>🔙 Return to Region</button>
        </div>
      </div>
    );
  }

  return (
    <div className="esea-container">
      <div className="esea-box">
        {!showScore ? (
          <>
            <h2 className="esea-question">{quiz.title || "ESEA Region Quiz"}</h2>
            <div className="flex justify-between mb-2">
              <span>
                Question {current + 1} / {quiz.questions.length}
              </span>
              <span>⏱ {time}s</span>
            </div>
            <p className="font-semibold mb-3">{quiz.questions[current].question}</p>
            <div className="esea-options">
              {quiz.questions[current].options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOption(option)}
                  disabled={!!selected}
                  className={getOptionClass(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="esea-result">
            <h2>✅ Quiz Completed!</h2>
            <p className="esea-score">
              Your Score: {score} / {quiz.questions.length}
            </p>
            <p className={isPassed ? "text-green-600" : "text-red-600"}>
              {isPassed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button onClick={() => navigate("/region")}>Return to Region Selection</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ESEA;
