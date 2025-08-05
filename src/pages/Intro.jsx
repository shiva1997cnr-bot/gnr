// src/pages/Intro.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './intro.css';


function Intro() {
  const [showContent, setShowContent] = useState(false);
  const navigate = useNavigate();
  const audioRef = useRef(null);

  useEffect(() => {
    // We can directly set the state without a timer if we want the content to show immediately.
    // The delay might be for a specific animation; I'll keep the timer.
    const timer = setTimeout(() => setShowContent(true), 500);

    const playAudio = () => {
      if (audioRef.current) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.log("Autoplay blocked by browser:", err);
          });
        }
      }
    };

    playAudio();

    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    navigate("/region");
  };

  return (
    <div className="intro-page min-h-screen bg-black text-white px-6 sm:px-12 flex items-center justify-center">
      <audio ref={audioRef} loop autoPlay>
        <source src="/intro-music.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>

      {showContent && (
        <div className="text-center sm:ml-16">
          <div className="symbols flex justify-center gap-4 mb-6">
            <div className="circle w-6 h-6 rounded-full bg-white"></div>
            <div className="triangle w-0 h-0 border-l-8 border-r-8 border-b-12 border-transparent border-b-white"></div>
            <div className="square w-6 h-6 bg-white"></div>
          </div>

          {/* This title class is from your custom CSS */}
          <h1 className="title text-3xl sm:text-5xl font-bold mb-6">Generalist Quiz Game</h1>

          <div className="flex justify-center items-center gap-8">
            <button
              onClick={handleStart}
              // This button has custom styles and Tailwind styles
              className="intro-start-button text-white text-2xl px-6 py-2 rounded-full transition duration-300 transform hover:scale-105"
            >
              O
            </button>
            {/* This button has custom styles and Tailwind styles */}
            <div className="abort-button text-red-500 text-2xl">X</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Intro;