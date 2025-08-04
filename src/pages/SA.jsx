// src/pages/SA.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";

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
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const navigate = useNavigate();

  useEffect(() => {
    if (timeLeft === 0) handleNext();
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleOptionClick = (option) => {
    if (selectedOption) return;
    setSelectedOption(option);

    const isCorrect = option === questions[currentQuestion].answer;
    if (isCorrect) setScore(score + 1);

    const audio = new Audio(isCorrect ? correctSound : wrongSound);
    audio.play();

    setTimeout(() => {
      handleNext();
    }, 1500); // ⏱ wait 1.5s before moving to next
  };

  const handleNext = () => {
    const next = currentQuestion + 1;
    if (next < questions.length) {
      setCurrentQuestion(next);
      setSelectedOption(null);
      setTimeLeft(30);
    } else {
      setShowScore(true);

      // Save to localStorage by employeeId
      const employeeId = localStorage.getItem("employeeId") || "default";
      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[employeeId]) scores[employeeId] = {};
      scores[employeeId]["SA"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const isPassed = (score / questions.length) * 100 >= 80;

  return (
    <div className="h-screen bg-orange-100 flex flex-col items-center justify-center p-4">
      {!showScore ? (
        <div className="w-full max-w-xl text-center">
          <h1 className="text-2xl font-bold mb-4">South Asia Quiz 🌏</h1>
          <div className="mb-2 text-lg font-medium">Time Left: {timeLeft}s</div>
          <h2 className="text-xl font-semibold mb-4">
            {questions[currentQuestion].question}
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {questions[currentQuestion].options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option)}
                className={`px-4 py-2 rounded-lg text-white transition-all duration-300 ${
                  selectedOption
                    ? option === questions[currentQuestion].answer
                      ? "bg-green-600"
                      : option === selectedOption
                      ? "bg-red-500"
                      : "bg-gray-300 text-black"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
                disabled={!!selectedOption}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Quiz Completed 🎉</h2>
          <p className="mb-2 text-xl">Your Score: {score} / {questions.length}</p>
          <p className={`text-lg font-semibold mb-6 ${isPassed ? "text-green-700" : "text-red-600"}`}>
            {isPassed ? "Great! You Passed ✅" : "Oops! You didn't pass ❌"}
          </p>
          <button
            onClick={() => navigate("/region")}
            className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Return to Region
          </button>
        </div>
      )}
    </div>
  );
}

export default SA;
