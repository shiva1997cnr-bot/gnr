// src/pages/LATAM.jsx
import React, { useEffect, useState, useRef } from "react";
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
import { saveQuizResult } from "../utils/firestoreUtils";
import { db } from "../firebase";
import "../styles/latam.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";

function LATAM() {
  const regionKey = "latam";
  const [quizData, setQuizData] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(true);
  const startTime = useRef(Date.now());
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("currentUser"));
  const username = user?.username;

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        // get only the latest quiz
        const q = query(collection(db, regionKey), orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          setQuizData(null);
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const latest = { id: docSnap.id, ...docSnap.data() };
        setQuizData(latest);

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
              taken.includes(latest.id) ||
              attempted.includes(latest.id) ||
              Boolean(attemptsMap[latest.id]);

            if (!isAdmin && already) {
              setQuizBlocked(true);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching ${regionKey} quiz:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [username]);

  useEffect(() => {
    if (loading || quizFinished || selected !== null || quizBlocked) return;
    if (timeLeft === 0) {
      handleNext();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, selected, quizFinished, quizBlocked, loading]);

  const handleOptionClick = (option) => {
    if (selected || quizBlocked) return;
    setSelected(option);

    const isCorrect = option === quizData.questions[currentQ].answer;
    if (isCorrect) setScore((prev) => prev + 1);

    const audio = new Audio(isCorrect ? correctSound : wrongSound);
    audio.play();

    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  const handleNext = async () => {
    if (!quizData) return;

    if (currentQ + 1 < quizData.questions.length) {
      setCurrentQ((prev) => prev + 1);
      setSelected(null);
      setTimeLeft(30);
    } else {
      setQuizFinished(true);

      if (!username) return;

      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);

      // save result
      await saveQuizResult(username, quizData.id, regionKey, score, timeSpent);

      // ensure next visit is blocked (write to user doc)
      try {
        const userRef = doc(db, "users", username);
        await updateDoc(userRef, {
          takenQuizzes: arrayUnion(quizData.id),
          attemptedQuizzes: arrayUnion(quizData.id),
          // If you also track a map:
          // ["attempts." + quizData.id]: true,
        });
      } catch (e) {
        console.warn("Failed to update user attempted lists:", e);
      }

      // keep your local scores if you want them
      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[username]) scores[username] = {};
      scores[username]["LATAM"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  if (loading) {
    return (
      <div className="latam-container">
        <div className="latam-box">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="latam-container">
        <div className="latam-box">
          <h2>No quiz available for LATAM</h2>
          <button className="latam-footer-button" onClick={() => navigate("/region")}>
            Return to Region
          </button>
        </div>
      </div>
    );
  }

  if (quizBlocked) {
    return (
      <div className="latam-container">
        <div className="latam-box">
          <h2 className="text-xl text-red-500 font-semibold mb-4">
            You have already attempted this LATAM quiz. 📅
          </h2>
          <button className="latam-footer-button" onClick={() => navigate("/region")}>
            Return to Region
          </button>
        </div>
      </div>
    );
  }

  const isPassed = (score / quizData.questions.length) * 100 >= 80;

  return (
    <div className="latam-container">
      <div className="latam-box">
        <h1 className="text-3xl font-bold mb-4">LATAM Quiz 🌎</h1>

        {!quizFinished ? (
          <>
            <div className="latam-question">
              Question {currentQ + 1} of {quizData.questions.length}
            </div>
            <div className="latam-score">Time Left: {timeLeft}s</div>
            <div className="latam-question">{quizData.questions[currentQ].question}</div>

            <div className="latam-options">
              {quizData.questions[currentQ].options.map((option, idx) => {
                let className = "latam-option";
                if (selected) {
                  if (option === quizData.questions[currentQ].answer) {
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
          <div className="latam-result">
            <h2>Your Score: {score} / {quizData.questions.length}</h2>
            <p className={`latam-score ${isPassed ? "text-green-500" : "text-red-500"}`}>
              {isPassed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button className="latam-footer-button" onClick={() => navigate("/region")}>
              Return to Region
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LATAM;
