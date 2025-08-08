import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/we.css";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";
import { saveQuizResult } from "../utils/firestoreUtils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

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
  const [startTime] = useState(Date.now());
  const [quizBlocked, setQuizBlocked] = useState(false);
  const navigate = useNavigate();

  const regionKey = "we";

  useEffect(() => {
    const checkAttempt = async () => {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      if (!user || !user.username) {
        console.error("User not found");
        return;
      }

      const username = user.username;
      const userRef = doc(db, "users", username);
      const snap = await getDoc(userRef);
      const data = snap.data();
      const isAdmin = data?.role === "admin";
      const prevAttempt = data?.scores?.[regionKey];

      const currentMonth = dayjs().format("YYYY-MM");
      const attemptMonth = prevAttempt?.date ? dayjs(prevAttempt.date).format("YYYY-MM") : null;

      if (!isAdmin && currentMonth === attemptMonth) {
        setQuizBlocked(true);
      }
    };

    checkAttempt();
  }, []);

  useEffect(() => {
    if (quizFinished || quizBlocked) return;
    if (timeLeft === 0) handleNext();
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, currentQ, quizFinished, quizBlocked]);

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

      const endTime = Date.now();
      const timeSpent = Math.floor((endTime - startTime) / 1000);

      const user = JSON.parse(localStorage.getItem("currentUser"));
      if (!user || !user.username) {
        console.error("User not found");
        return;
      }

      const username = user.username;

      await saveQuizResult(username, regionKey, score, timeSpent);
    }
  };

  const isPassed = (score / questions.length) * 100 >= 80;

  if (quizBlocked) {
    return (
      <div className="we-container">
        <div className="we-box we-blocked">
          ⛔ You have already attempted the Western Europe quiz this month.
          <button onClick={() => navigate("/region")} className="we-footer-btn">
            Return to Region Selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="we-container">
      <div className="we-box">
        {!quizFinished ? (
          <>
            <h2 className="we-question">Western Europe Region Quiz</h2>
            <div className="we-timer">Time Left: {timeLeft}s</div>
            <h3 className="we-question">{questions[currentQ].question}</h3>
            <div className="we-options">
              {questions[currentQ].options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleOptionClick(option)}
                  className={`we-option ${
                    selected
                      ? option === questions[currentQ].answer
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
          </>
        ) : (
          <div className="we-result">
            <h2>Quiz Completed 🎉</h2>
            <p className="we-score">Your Score: {score} / {questions.length}</p>
            <p className={isPassed ? "pass" : "fail"}>
              {isPassed ? "Passed ✅" : "Failed ❌"}
            </p>
            <button onClick={() => navigate("/region")} className="we-footer-btn">
              Return to Region Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WE;
