// src/pages/LATAM.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import './styles/latam.css';
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";

const questions = [
  {
    question: "Who is the Head of State in Brazil (2025)?",
    options: ["President", "Prime Minister", "Monarch", "Chancellor"],
    answer: "President",
  },
  {
    question: "What type of government does Argentina have?",
    options: ["Federal Republic", "Constitutional Monarchy", "Theocracy", "Military Junta"],
    answer: "Federal Republic",
  },
  {
    question: "What is the capital of Chile?",
    options: ["Santiago", "Lima", "Buenos Aires", "Bogotá"],
    answer: "Santiago",
  },
  {
    question: "What is the currency of Colombia?",
    options: ["Peso", "Real", "Sol", "Dollar"],
    answer: "Peso",
  },
  {
    question: "Which language is official in Peru?",
    options: ["Spanish", "Portuguese", "French", "English"],
    answer: "Spanish",
  },
  {
    question: "What is the Parliament of Mexico called?",
    options: ["Congress of the Union", "National Assembly", "People’s Council", "Legislative Forum"],
    answer: "Congress of the Union",
  },
  {
    question: "Which country has recent regime change in 2024?",
    options: ["Bolivia", "Brazil", "Paraguay", "Uruguay"],
    answer: "Bolivia",
  },
  {
    question: "Which agency is Argentina's intelligence unit?",
    options: ["AFI", "ABIN", "DINA", "CIA"],
    answer: "AFI",
  },
  {
    question: "Which Latin American country signed a major climate agreement in 2025?",
    options: ["Chile", "Venezuela", "Brazil", "Ecuador"],
    answer: "Brazil",
  },
  {
    question: "What upcoming event is hosted by Mexico in 2025?",
    options: ["Pan American Games", "Olympics", "G20 Summit", "COP30"],
    answer: "G20 Summit",
  },
];

function LATAM() {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const navigate = useNavigate();

  useEffect(() => {
    if (quizFinished) return;
    if (timeLeft === 0) {
      handleNext();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, currentQ, quizFinished]);

  const handleOptionClick = (option) => {
    if (selected) return;
    setSelected(option);

    const isCorrect = option === questions[currentQ].answer;
    if (isCorrect) setScore(score + 1);

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
      scores[employeeId]["LATAM"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const isPassed = (score / questions.length) * 100 >= 80;

  return (
    <div className="latam-container">
      <div className="latam-box">
        <h1 className="text-3xl font-bold mb-4">LATAM Quiz 🌎</h1>

        {quizFinished ? (
          <div className="latam-result">
            <h2>Your Score: {score} / {questions.length}</h2>
            <p className={`latam-score ${isPassed ? "text-green-500" : "text-red-500"}`}>
              {isPassed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button className="latam-footer-button" onClick={() => navigate("/region")}>
              Return to Region
            </button>
          </div>
        ) : (
          <>
            <div className="latam-question">
              Question {currentQ + 1} of {questions.length}
            </div>
            <div className="latam-score">Time Left: {timeLeft}s</div>
            <div className="latam-question">{questions[currentQ].question}</div>

            <div className="latam-options">
              {questions[currentQ].options.map((option, idx) => {
                let className = "latam-option";
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

export default LATAM;
