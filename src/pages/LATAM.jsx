// src/pages/LATAM.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

      // 💾 Save score under employeeId
      const employeeId = localStorage.getItem("employeeId") || "default";
      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[employeeId]) scores[employeeId] = {};
      scores[employeeId]["LATAM"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const isPassed = (score / questions.length) * 100 >= 80;

  return (
    <div className="min-h-screen bg-red-100 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-4">LATAM Quiz 🌎</h1>
      {quizFinished ? (
        <div className="text-center">
          <h2 className="text-2xl mb-2">Your Score: {score} / {questions.length}</h2>
          <p className={`text-lg font-semibold ${isPassed ? "text-green-700" : "text-red-600"}`}>
            {isPassed ? "Passed ✅" : "Failed ❌"}
          </p>
          <button
            onClick={() => navigate("/region")}
            className="mt-6 px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Region
          </button>
        </div>
      ) : (
        <>
          <div className="text-xl font-semibold mb-2">
            Question {currentQ + 1} of {questions.length}
          </div>
          <div className="text-lg font-bold text-red-700 mb-4">Time Left: {timeLeft}s</div>
          <div className="text-xl font-medium mb-6">
            {questions[currentQ].question}
          </div>
          <div className="grid grid-cols-1 gap-3 w-full max-w-xl">
            {questions[currentQ].options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option)}
                className={`p-3 rounded border transition-colors ${
                  selected
                    ? option === questions[currentQ].answer
                      ? "bg-green-500 text-white"
                      : option === selected
                      ? "bg-red-500 text-white"
                      : "bg-gray-200"
                    : "bg-white hover:bg-red-200"
                }`}
                disabled={!!selected}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default LATAM;
