// src/pages/ESEA.jsx
import "../styles/esea.css";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/app.css";

import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { saveQuizResult } from "../utils/firestoreUtils";
import dayjs from "dayjs";

const questions = [
  {
    question: "Who is the Head of State in Australia?",
    options: ["Governor-General", "Prime Minister", "King", "President"],
    answer: "King",
  },
  {
    question: "What type of government does New Zealand have?",
    options: [
      "Federal Republic",
      "Parliamentary Democracy",
      "Military Junta",
      "Absolute Monarchy",
    ],
    answer: "Parliamentary Democracy",
  },
  {
    question: "What is the capital of Vietnam?",
    options: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hue"],
    answer: "Hanoi",
  },
  {
    question: "Currency of Japan?",
    options: ["Won", "Yuan", "Yen", "Baht"],
    answer: "Yen",
  },
  {
    question: "Official language of the Philippines?",
    options: ["English", "Tagalog", "Spanish", "Cebuano"],
    answer: "Tagalog",
  },
  {
    question: "Main intelligence agency of Australia?",
    options: ["MI6", "CIA", "ASIO", "NSA"],
    answer: "ASIO",
  },
  {
    question: "Has Myanmar experienced recent regime changes?",
    options: ["Yes", "No", "Ongoing", "Unclear"],
    answer: "Yes",
  },
  {
    question: "Upcoming international event in Japan 2025?",
    options: [
      "World Expo Osaka",
      "Olympics",
      "G20 Summit",
      "FIFA World Cup",
    ],
    answer: "World Expo Osaka",
  },
  {
    question: "What is the Parliament of Thailand called?",
    options: [
      "Dewan Rakyat",
      "National Assembly",
      "People’s Council",
      "Diet",
    ],
    answer: "National Assembly",
  },
  {
    question: "Recent war or conflict in East/Southeast Asia?",
    options: [
      "China-Taiwan Tensions",
      "Indonesia-Vietnam war",
      "Japan-Korea clash",
      "Australia-Malaysia dispute",
    ],
    answer: "China-Taiwan Tensions",
  },
];

function ESEA() {
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
  const regionKey = "esea";

  // ⛔ Check if already attempted this month
  useEffect(() => {
    const checkAttempt = async () => {
      if (!username) {
        setLoading(false);
        return;
      }

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

  // ⏳ Timer countdown
  useEffect(() => {
    if (selected !== null || showScore || quizBlocked) return;

    const timer = setTimeout(() => {
      if (time > 0) {
        setTime(time - 1);
      } else {
        handleNext();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [time, selected, showScore, quizBlocked]);

  const handleOption = (option) => {
    if (selected) return;

    setSelected(option);
    const isCorrect = option === questions[current].answer;

    const sound = new Audio(isCorrect ? correctSound : wrongSound);
    sound.play();

    if (isCorrect) {
      setScore(score + 1);
    }

    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  const handleNext = async () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setSelected(null);
      setTime(30);
    } else {
      setShowScore(true);

      if (!username) return;

      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
      await saveQuizResult(username, regionKey, score, timeSpent);

      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[username]) scores[username] = {};
      scores[username]["ESEA"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const getOptionClass = (option) => {
    if (!selected) return "esea-option";
    if (option === questions[current].answer) return "esea-option correct";
    if (option === selected) return "esea-option incorrect";
    return "esea-option";
  };

  const isPassed = (score / questions.length) * 100 >= 80;

  if (loading) return <p className="esea-box">Loading...</p>;

  if (quizBlocked) {
    return (
      <div className="esea-container">
        <div className="esea-box esea-result">
          <h2 className="text-red-500 text-xl font-bold mb-4">⛔ Quiz Already Taken</h2>
          <p className="mb-4">You've already taken the <strong>ESEA</strong> quiz this month.</p>
          <p>Try again next month!</p>
          <button onClick={() => navigate("/region")}>
            🔙 Return to Region
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="esea-container">
      <div className="esea-box">
        {!showScore ? (
          <>
            <h2 className="esea-question">ESEA Region Quiz 🇯🇵 🇦🇺 🇻🇳</h2>
            <div className="flex justify-between mb-2">
              <span>Question {current + 1} / {questions.length}</span>
              <span>⏱ {time}s</span>
            </div>
            <p className="font-semibold mb-3">{questions[current].question}</p>
            <div className="esea-options">
              {questions[current].options.map((option, index) => (
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
              Your Score: {score} / {questions.length}
            </p>
            <p className={isPassed ? "text-green-600" : "text-red-600"}>
              {isPassed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button onClick={() => navigate("/region")}>
              Return to Region Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ESEA;
