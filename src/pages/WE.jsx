// src/pages/WE.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";

const questions = [
  {
    question: "Who is the head of state of France?",
    options: ["Emmanuel Macron", "Olaf Scholz", "Pedro Sánchez", "Alexander Van der Bellen"],
    answer: "Emmanuel Macron",
  },
  {
    question: "What type of government does Germany have?",
    options: ["Federal Parliamentary Republic", "Monarchy", "Presidential Republic", "Military Junta"],
    answer: "Federal Parliamentary Republic",
  },
  {
    question: "What is the Parliament of the UK called?",
    options: ["National Assembly", "Congress", "House of Commons", "Bundestag"],
    answer: "House of Commons",
  },
  {
    question: "What is the capital of Austria?",
    options: ["Vienna", "Zurich", "Brussels", "Oslo"],
    answer: "Vienna",
  },
  {
    question: "What is the currency used in Spain?",
    options: ["Euro", "Pound", "Franc", "Krone"],
    answer: "Euro",
  },
  {
    question: "What are the official languages of Switzerland?",
    options: ["German, French, Italian, Romansh", "German only", "French and German", "Italian only"],
    answer: "German, French, Italian, Romansh",
  },
  {
    question: "Which is the main intelligence agency of the UK?",
    options: ["MI6", "CIA", "BND", "DGSE"],
    answer: "MI6",
  },
  {
    question: "Which Western European country experienced major farmer protests in 2025?",
    options: ["Netherlands", "Italy", "Ireland", "Sweden"],
    answer: "Netherlands",
  },
  {
    question: "Which major global summit is being hosted by Italy in 2025?",
    options: ["G7 Summit", "BRICS Summit", "UNGA", "EU Migration Forum"],
    answer: "G7 Summit",
  },
  {
    question: "Which two countries signed a defense pact in 2025?",
    options: ["France and Germany", "UK and Sweden", "Spain and Portugal", "Austria and Hungary"],
    answer: "UK and Sweden",
  },
];

function WE() {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [quizFinished, setQuizFinished] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (quizFinished) return;
    if (timeLeft === 0) handleNext();
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
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
    }, 1500); // ⏱ delay before moving to next
  };

  const handleNext = () => {
    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
      setSelected(null);
      setTimeLeft(30);
    } else {
      setQuizFinished(true);

      // 💾 Save score under employeeId in localStorage
      const employeeId = localStorage.getItem("employeeId") || "default";
      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[employeeId]) scores[employeeId] = {};
      scores[employeeId]["WE"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const isPassed = (score / questions.length) * 100 >= 80;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-300 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl text-center">
        {!quizFinished ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Western Europe Region Quiz</h2>
            <div className="text-sm mb-2 text-gray-600">Time Left: {timeLeft}s</div>
            <h3 className="text-lg font-medium mb-3">{questions[currentQ].question}</h3>
            <div className="grid gap-2">
              {questions[currentQ].options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleOptionClick(option)}
                  className={`py-2 px-4 rounded-lg border transition-all duration-300 ${
                    selected
                      ? option === questions[currentQ].answer
                        ? "bg-green-500 text-white"
                        : option === selected
                        ? "bg-red-500 text-white"
                        : "bg-gray-200"
                      : "bg-blue-100 hover:bg-blue-200"
                  }`}
                  disabled={!!selected}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-2">Quiz Completed 🎉</h2>
            <p className="text-lg mb-1">Your Score: {score} / {questions.length}</p>
            <p className={`text-md font-semibold ${isPassed ? "text-green-700" : "text-red-600"}`}>
              {isPassed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button
              onClick={() => navigate("/region")}
              className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Return to Region Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WE;
