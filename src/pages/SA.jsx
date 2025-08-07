// src/pages/SA.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/sa.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { saveQuizResult } from "../utils/firestoreUtils";

const questions = [
  {
    question: "Who is the Head of State in India?",
    options: ["Prime Minister", "President", "King", "Chief Justice"],
    answer: "President",
  },
  {
    question: "What type of government does Pakistan have?",
    options: ["Monarchy", "Parliamentary Republic", "Military Junta", "Theocracy"],
    answer: "Parliamentary Republic",
  },
  {
    question: "What is the name of the Parliament in Bangladesh?",
    options: ["Jatiya Sangsad", "Lok Sabha", "Majlis", "National Assembly"],
    answer: "Jatiya Sangsad",
  },
  {
    question: "What is the capital of Sri Lanka?",
    options: ["Kandy", "Colombo", "Galle", "Jaffna"],
    answer: "Colombo",
  },
  {
    question: "Currency of Nepal?",
    options: ["Nepali Rupee", "Indian Rupee", "Taka", "Sri Lankan Rupee"],
    answer: "Nepali Rupee",
  },
  {
    question: "Which language is widely spoken in Afghanistan?",
    options: ["Pashto", "Bengali", "Tamil", "Hindi"],
    answer: "Pashto",
  },
  {
    question: "Which agency is India’s primary external intelligence service?",
    options: ["RAW", "ISI", "Mossad", "CIA"],
    answer: "RAW",
  },
  {
    question: "Recent regime change occurred in which South Asian country in 2024?",
    options: ["Maldives", "Pakistan", "Nepal", "Sri Lanka"],
    answer: "Pakistan",
  },
  {
    question: "Which major international event is set in India in 2025?",
    options: ["BRICS Summit", "G20", "SAARC Meet", "World Cup"],
    answer: "BRICS Summit",
  },
  {
    question: "Which South Asian country was involved in a border clash in 2025?",
    options: ["India", "Nepal", "Bhutan", "Bangladesh"],
    answer: "India",
  },
];

function SA() {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const startTime = useRef(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    if (quizFinished || selected !== null) return;
    if (timeLeft === 0) {
      handleNext();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, selected, quizFinished]);

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

      const user = JSON.parse(localStorage.getItem("currentUser"));
      if (!user || !user.username) {
        console.error("❌ Username not found in localStorage");
        return;
      }

      const username = user.username;
      const regionKey = "sa";
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);

      // ✅ Save to Firestore
      await saveQuizResult(username, regionKey, score, timeSpent);
      console.log(`✅ SA result saved for ${username}`);

      // ✅ Optionally save locally
      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[username]) scores[username] = {};
      scores[username]["SA"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const isPassed = (score / questions.length) * 100 >= 80;

  return (
    <div className="sa-container">
      <div className="sa-box">
        <h1 className="text-3xl font-bold mb-4">South Asia Quiz 🌏</h1>

        {quizFinished ? (
          <div className="sa-result">
            <h2>Your Score: {score} / {questions.length}</h2>
            <p className={`sa-score ${isPassed ? "text-green-500" : "text-red-500"}`}>
              {isPassed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button className="sa-footer-button" onClick={() => navigate("/region")}>
              Return to Region
            </button>
          </div>
        ) : (
          <>
            <div className="sa-question">
              Question {currentQ + 1} of {questions.length}
            </div>
            <div className="sa-score">Time Left: {timeLeft}s</div>
            <div className="sa-question">{questions[currentQ].question}</div>

            <div className="sa-options">
              {questions[currentQ].options.map((option, idx) => {
                let className = "sa-option";
                if (selected) {
                  if (option === questions[currentQ].answer) {
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
        )}
      </div>
    </div>
  );
}

export default SA;
