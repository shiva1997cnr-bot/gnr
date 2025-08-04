// src/pages/AFR.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-yellow-50 p-4">
      <h1 className="text-3xl font-bold mb-6">🌍 Welcome to Africa Quiz</h1>

      {!quizFinished ? (
        <div className="w-full max-w-xl bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-lg font-semibold mb-2">
            Question {currentQ + 1} of {questions.length}
          </h2>
          <p className="mb-4 text-gray-700">{questions[currentQ].question}</p>

          <div className="space-y-3">
            {questions[currentQ].options.map((option, index) => {
              const isCorrect = selected && option === questions[currentQ].answer;
              const isWrong = selected === option && option !== questions[currentQ].answer;
              return (
                <button
                  key={index}
                  className={`w-full p-2 rounded-lg border text-left transition-colors ${
                    selected
                      ? isCorrect
                        ? "bg-green-300 border-green-500 text-white"
                        : isWrong
                        ? "bg-red-300 border-red-500 text-white"
                        : "bg-gray-100 border-gray-300"
                      : "bg-gray-100 border-gray-300 hover:bg-yellow-100"
                  }`}
                  onClick={() => handleOptionClick(option)}
                  disabled={!!selected}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-gray-500">⏱ Time Left: {timeLeft}s</p>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-md text-center">
          <h2 className="text-2xl font-bold mb-4">✅ Quiz Complete!</h2>
          <p className="text-lg mb-2">Your Score: {score} / {questions.length}</p>
          <p className={`text-lg font-semibold ${isPassed ? "text-green-600" : "text-red-600"}`}>
            {isPassed ? "Passed ✅" : "Failed ❌"}
          </p>
          <button
            onClick={() => navigate("/region")}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Return to Region Selection
          </button>
        </div>
      )}
    </div>
  );
}

export default AFR;
