import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import correctSound from "../assets/correct.mp3";
import wrongSound from "../assets/wrong.mp3";

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
    setSelected(option);
    const isCorrect = option === questions[current].answer;

    // Play appropriate sound
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
    }
  };

  const getOptionStyle = (option) => {
    if (!selected) return "bg-white hover:bg-blue-100";
    if (option === questions[current].answer) return "bg-green-300 text-white";
    if (option === selected) return "bg-red-300 text-white";
    return "bg-white";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-xl">
        {!showScore ? (
          <>
            <h2 className="text-xl font-bold mb-4">
              ESEA Region Quiz 🇯🇵 🇦🇺 🇻🇳
            </h2>
            <div className="flex justify-between mb-2">
              <span>
                Question {current + 1} / {questions.length}
              </span>
              <span>Time: {time}s</span>
            </div>
            <p className="font-semibold mb-4">
              {questions[current].question}
            </p>
            <div className="space-y-2">
              {questions[current].options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOption(option)}
                  disabled={!!selected}
                  className={`w-full text-left p-2 rounded-md border transition duration-300 ${getOptionStyle(option)}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Quiz Completed ✅</h2>
            <p className="text-xl mb-2">
              Your Score: {score} / {questions.length}
            </p>
            <button
              onClick={() => navigate("/region")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return to Region
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ESEA;
