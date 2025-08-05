// src/pages/USCAN.jsx  
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import '../styles/uscan.css';
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";

import { logActivity } from "../utils/activityLogger"; // ✅ Added

const questions = [
  {
    question: "Who is the current Head of State for Canada?",
    options: ["Justin Trudeau", "King Charles III", "Joe Biden", "Pierre Poilievre"],
    answer: "King Charles III",
  },
  {
    question: "What type of government does the United States have?",
    options: ["Federal Republic", "Constitutional Monarchy", "Parliamentary", "Dictatorship"],
    answer: "Federal Republic",
  },
  {
    question: "What is the name of the Canadian Parliament?",
    options: ["House of Commons", "National Assembly", "Senate", "Parliament Hill"],
    answer: "House of Commons",
  },
  {
    question: "What is the capital of the United States?",
    options: ["Washington, D.C.", "New York", "Los Angeles", "Chicago"],
    answer: "Washington, D.C.",
  },
  {
    question: "What currency is used in Canada?",
    options: ["Canadian Dollar", "US Dollar", "Euro", "Peso"],
    answer: "Canadian Dollar",
  },
  {
    question: "What are the official languages of Canada?",
    options: ["English and French", "Only English", "English and Spanish", "French and Spanish"],
    answer: "English and French",
  },
  {
    question: "What is the CIA?",
    options: ["Canadian Intelligence Agency", "Central Intelligence Agency", "Council of International Affairs", "Commonwealth Intelligence Agency"],
    answer: "Central Intelligence Agency",
  },
  {
    question: "What is the CSIS in Canada?",
    options: ["Canadian Security Intelligence Service", "Central Service of Internal Security", "Canada Secret Information Sector", "Commonwealth Surveillance Intelligence Service"],
    answer: "Canadian Security Intelligence Service",
  },
  {
    question: "Who is the current Head of State of the United States?",
    options: ["Donald Trump", "Kamala Harris", "Barack Obama", "Joe Biden"],
    answer: "Joe Biden",
  },
  {
    question: "What upcoming international event is hosted in Los Angeles in 2028?",
    options: ["World Cup", "Olympics", "G7 Summit", "Climate Pact"],
    answer: "Olympics",
  },
  {
    question: "Which country is NOT part of USMCA agreement?",
    options: ["Mexico", "Canada", "United States", "Brazil"],
    answer: "Brazil",
  },
  {
    question: "What recent agreement aims to strengthen semiconductor supply chains between US and Canada?",
    options: ["CHIPS Act", "NORAD Pact", "US-Canada Tech Deal", "North Tech Alliance"],
    answer: "US-Canada Tech Deal",
  },
  {
    question: "What is the capital of Canada?",
    options: ["Toronto", "Vancouver", "Ottawa", "Montreal"],
    answer: "Ottawa",
  },
  {
    question: "Which US agency handles foreign espionage?",
    options: ["NSA", "FBI", "CIA", "Homeland Security"],
    answer: "CIA",
  },
  {
    question: "Which agency is equivalent to FBI in Canada?",
    options: ["RCMP", "CSIS", "OPP", "Interpol"],
    answer: "RCMP",
  },
  {
    question: "When was the last US presidential election held?",
    options: ["2020", "2022", "2016", "2018"],
    answer: "2020",
  },
  {
    question: "Which country has bilingual federal laws?",
    options: ["US", "Canada", "Mexico", "UK"],
    answer: "Canada",
  },
  {
    question: "What is the federal structure of the US called?",
    options: ["Union of States", "Federal Republic", "Confederation", "Democratic Kingdom"],
    answer: "Federal Republic",
  },
  {
    question: "Which country uses RCMP as national police?",
    options: ["US", "Mexico", "Canada", "Australia"],
    answer: "Canada",
  },
  {
    question: "Which 2025 summit is planned in Washington, D.C.?",
    options: ["Climate Pact", "G20 Summit", "G7 Summit", "UN Assembly"],
    answer: "G7 Summit",
  },
  {
    question: "What is the largest state in the US by area?",
    options: ["California", "Texas", "Alaska", "Montana"],
    answer: "Alaska",
  },
  {
    question: "Which country recently passed Online Streaming Act (2023)?",
    options: ["US", "Canada", "UK", "Germany"],
    answer: "Canada",
  },
  {
    question: "Where is NORAD headquartered?",
    options: ["Ottawa", "Colorado", "Alberta", "Washington D.C."],
    answer: "Colorado",
  },
  {
    question: "What is the House of Representatives?",
    options: ["US Senate", "Canadian Parliament", "Lower house of US Congress", "Upper house of Canadian Parliament"],
    answer: "Lower house of US Congress",
  },
  {
    question: "Which country’s parliament is bicameral with Senate and Commons?",
    options: ["US", "Canada", "Mexico", "UK"],
    answer: "Canada",
  }
];

function USCAN() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const navigate = useNavigate();

  useEffect(() => {
    if (timeLeft === 0) handleNext();
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleOptionClick = (option) => {
    if (selected) return;
    setSelected(option);

    const correct = option === questions[currentQuestion].answer;
    if (correct) setScore(score + 1);

    const audio = new Audio(correct ? correctSound : wrongSound);
    audio.play();
  };

  const handleNext = () => {
    if (currentQuestion + 1 < questions.length) {
      setCurrentQuestion(currentQuestion + 1);
      setSelected(null);
      setTimeLeft(30);
    } else {
      setShowResult(true);
      saveScore();
    }
  };

  const saveScore = () => {
    const employeeId = localStorage.getItem("employeeId") || "default";

    const scores = JSON.parse(localStorage.getItem("scores")) || {};
    const register = JSON.parse(localStorage.getItem("register")) || {};
    const report = JSON.parse(localStorage.getItem("report")) || {};

    if (!scores[employeeId]) scores[employeeId] = {};
    if (!register[employeeId]) register[employeeId] = {};
    if (!report[employeeId]) report[employeeId] = {};

    scores[employeeId]["USCAN"] = score;
    register[employeeId]["USCAN"] = score;
    report[employeeId]["USCAN"] = score;

    localStorage.setItem("scores", JSON.stringify(scores));
    localStorage.setItem("register", JSON.stringify(register));
    localStorage.setItem("report", JSON.stringify(report));

    // ✅ Activity log entry
    logActivity("QUIZ_ATTEMPT", `USCAN Quiz | Score: ${score}/${questions.length}`);
  };

  const getPassFailText = () => {
    const percent = (score / questions.length) * 100;
    return percent >= 80 ? "✅ Great! You passed." : "❌ You did not pass.";
  };

  return (
    <div className="uscan-container">
      <div className="uscan-box">
        {!showResult ? (
          <>
            <h2 className="uscan-question">
              Q{currentQuestion + 1}: {questions[currentQuestion].question}
            </h2>
            <div className="uscan-options">
              {questions[currentQuestion].options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionClick(option)}
                  className={`uscan-option ${
                    selected
                      ? option === questions[currentQuestion].answer
                        ? "correct"
                        : option === selected
                        ? "incorrect"
                        : ""
                      : ""
                  }`}
                  disabled={!!selected}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="uscan-footer">
              <span>⏱ {timeLeft}s</span>
              {selected && <button onClick={handleNext}>Next</button>}
            </div>
          </>
        ) : (
          <div className="uscan-result">
            <h2>Quiz Completed!</h2>
            <p className="uscan-score">Your Score: {score} / {questions.length}</p>
            <p className="uscan-score">{getPassFailText()}</p>
            <button onClick={() => navigate("/region")}>
              Return to Region
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default USCAN;
