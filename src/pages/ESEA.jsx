import '../styles/esea.css';
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/app.css";

import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
// REMOVE this line if app.css is already imported in App.jsx
// import ".,./styles/app.css";


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
  const navigate = useNavigate();

  useEffect(() => {
    if (selected !== null || showScore) return;

    const timer = setTimeout(() => {
      if (time > 0) {
        setTime(time - 1);
      } else {
        handleNext();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [time, selected, showScore]);

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

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setSelected(null);
      setTime(30);
    } else {
      setShowScore(true);

      const employeeId = localStorage.getItem("employeeId") || "default";
      const scores = JSON.parse(localStorage.getItem("scores")) || {};
      if (!scores[employeeId]) scores[employeeId] = {};
      scores[employeeId]["ESEA"] = score;
      localStorage.setItem("scores", JSON.stringify(scores));
    }
  };

  const getOptionClass = (option) => {
    if (!selected) return "esea-option";
    if (option === questions[current].answer) return "esea-option correct";
    if (option === selected) return "esea-option incorrect";
    return "esea-option";
  };

  return (
    <div className="esea-container">
      <div className="esea-box">
        {!showScore ? (
          <>
            <h2 className="esea-question">ESEA Region Quiz 🇯🇵 🇦🇺 🇻🇳</h2>
            <div className="flex justify-between mb-2">
              <span>
                Question {current + 1} / {questions.length}
              </span>
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
            <p className={score >= 8 ? "text-green-600" : "text-red-600"}>
              {score >= 8 ? "Passed ✅" : "Failed ❌"}
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
