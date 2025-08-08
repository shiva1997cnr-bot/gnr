// src/pages/AFR.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/afr.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { saveQuizResult } from "../utils/firestoreUtils";
import dayjs from "dayjs";
import LoadingScreen from "../components/LoadingScreen"; // <-- Added this line

const questions = [
  {
    question: "Who is the current Head of State of Nigeria (2025)?",
    options: ["Muhammadu Buhari", "Bola Ahmed Tinubu", "Goodluck Jonathan", "Yemi Osinbajo"],
    answer: "Bola Ahmed Tinubu",
  },
  {
    question: "What type of government does South Africa have?",
    options: ["Absolute Monarchy", "Federal Republic", "Parliamentary Republic", "Presidential Republic"],
    answer: "Parliamentary Republic",
  },
  {
    question: "What is the capital of Kenya?",
    options: ["Nairobi", "Mombasa", "Dodoma", "Kampala"],
    answer: "Nairobi",
  },
  {
    question: "Which currency is used in Ghana?",
    options: ["Ghanaian Cedi", "Naira", "Shilling", "Rand"],
    answer: "Ghanaian Cedi",
  },
  {
    question: "What is the national language of Ethiopia?",
    options: ["Somali", "Tigrinya", "Amharic", "Oromo"],
    answer: "Amharic",
  },
  {
    question: "Which is Nigeria’s main intelligence agency?",
    options: ["State Security Service (SSS)", "DGSE", "NIS", "MSS"],
    answer: "State Security Service (SSS)",
  },
  {
    question: "Which African country had a regime change in 2023?",
    options: ["Gabon", "Kenya", "South Africa", "Tanzania"],
    answer: "Gabon",
  },
  {
    question: "Which major international event will be hosted in Morocco (2025)?",
    options: ["UN Climate Summit", "African Union Conference", "Olympics", "World Economic Forum"],
    answer: "UN Climate Summit",
  },
  {
    question: "Which African country had a civil war escalation in 2024?",
    options: ["Sudan", "Botswana", "Lesotho", "Namibia"],
    answer: "Sudan",
  },
  {
    question: "Which agreement was signed in 2025 between ECOWAS nations?",
    options: ["West African Energy Pact", "Pan-African Union Deal", "AfCFTA Phase II", "Peace Accord 2025"],
    answer: "West African Energy Pact",
  },
];

function AFR() {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [quizBlocked, setQuizBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const startTime = useRef(Date.now());
  const navigate = useNavigate();
  const regionKey = "afr";

  const user = JSON.parse(localStorage.getItem("currentUser"));
  const username = user?.username;

  // ⛔️ Check if user already took the quiz this month
  useEffect(() => {
    const checkAttempt = async () => {
      if (!username) return;

      const userRef = doc(db, "users", username);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        setLoading(false);
        return;
      }

      const data = snap.data();
      const isAdmin = data.role === "admin";
      const prevAttempt = data?.scores?.[regionKey];

      const currentMonth = dayjs().format("YYYY-MM");
      const attemptMonth = prevAttempt?.date ? dayjs(prevAttempt.date).format("YYYY-MM") : null;

      if (!isAdmin && currentMonth === attemptMonth) {
        setQuizBlocked(true);
      }

      setLoading(false);
    };

    checkAttempt();
  }, [username]);

  // ⏳ Timer
  useEffect(() => {
    if (quizFinished || selected !== null || quizBlocked) return;
    if (timeLeft === 0) {
      handleNext();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, currentQ, quizFinished, selected, quizBlocked]);

  const handleOptionClick = (option) => {
    if (selected) return;
    setSelected(option);

    const isCorrect = option === questions[currentQ].answer;
    if (isCorrect) setScore((prev) => prev + 1);

    const audio = new Audio(isCorrect ? correctSound : wrongSound);
    audio.play();

    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  const handleNext = async () => {
    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
      setSelected(null);
      setTimeLeft(30);
    } else {
      setQuizFinished(true);
      if (!username) return;

      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
      await saveQuizResult(username, regionKey, score, timeSpent);

      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[username]) scores[username] = {};
      scores[username]["AFR"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const isPassed = (score / questions.length) * 100 >= 80;

  if (loading) return <LoadingScreen />; // <-- The change is here

  if (quizBlocked) {
    return (
      <div className="afr-container">
        <div className="afr-box afr-blocked">
          <h2>⛔ Quiz Already Taken</h2>
          <p>
            You’ve already taken the <strong>AFR quiz</strong> for this month.
          </p>
          <p>Try again next month!</p>
          <button onClick={() => navigate("/region")}>🔙 Return to Region</button>
        </div>
      </div>
    );
  }

  return (
    <div className="afr-container">
      {!quizFinished ? (
        <div className="afr-box">
          <div className="afr-question">
            Question {currentQ + 1} of {questions.length}
          </div>
          <div className="afr-question">{questions[currentQ].question}</div>
          <div className="afr-options">
            {questions[currentQ].options.map((option, index) => {
              const isCorrect = selected && option === questions[currentQ].answer;
              const isWrong = selected === option && option !== questions[currentQ].answer;
              return (
                <div
                  key={index}
                  className={`afr-option ${
                    selected
                      ? isCorrect
                        ? "correct"
                        : isWrong
                        ? "incorrect"
                        : ""
                      : ""
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  {option}
                </div>
              );
            })}
          </div>
          <div className="afr-footer">
            <span>⏱ Time Left: {timeLeft}s</span>
          </div>
        </div>
      ) : (
        <div className="afr-box afr-result">
          <h2>✅ Quiz Complete!</h2>
          <div className="afr-score">
            Your Score: {score} / {questions.length}
          </div>
          <div className={isPassed ? "text-green-500" : "text-red-500"}>
            {isPassed ? "Passed ✅" : "Failed ❌"}
          </div>
          <button onClick={() => navigate("/region")}>Return to Region Selection</button>
        </div>
      )}
    </div>
  );
}

export default AFR;