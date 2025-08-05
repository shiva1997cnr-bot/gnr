// src/pages/AFR.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import '../styles/afr.css';
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";


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
  const navigate = useNavigate();

  useEffect(() => {
    if (quizFinished || selected !== null) return;
    if (timeLeft === 0) {
      handleNext();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, currentQ, quizFinished, selected]);

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

  const handleNext = () => {
    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
      setSelected(null);
      setTimeLeft(30);
    } else {
      setQuizFinished(true);

      const employeeId = localStorage.getItem("employeeId") || "default";
      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[employeeId]) scores[employeeId] = {};
      scores[employeeId]["AFR"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const isPassed = (score / questions.length) * 100 >= 80;

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
