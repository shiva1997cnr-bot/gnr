body, html, #root {
  margin: 90;
  padding: 90;
  height: 100%;
  width: 100%;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(ellipse at top left, #1f0036, #0d1b2a, #000000);
  background-size: 200% 200%;
  animation: auroraGlow 10s ease-in-out infinite;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

@keyframes auroraGlow {
  0% {
    background-position: 0% 50%;
    filter: brightness(1) saturate(1);
  }
  50% {
    background-position: 100% 50%;
    filter: brightness(1.3) saturate(1.4);
  }
  100% {
    background-position: 0% 50%;
    filter: brightness(1) saturate(1);
  }
}

.glow-text {
  text-shadow: 0 0 8px #b300ff, 0 0 16px #7300e6, 0 0 32px #400080;
  animation: fadeInOut 4s ease-in-out infinite;
}

@keyframes fadeInOut {
  0%, 100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}


/* Container */
.container {
  text-align: absolute;
  animation: fadeIn 1.2s ease-out both;
}

/* Symbols Layout */
.symbols {
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  left: -200px;
  top: -0px;
  gap: 60px;
  margin-bottom: 60px;
  position: relative;
  height: 150px;
}

/* Hollow Circle (center) */
.circle {
  width: 100px;
  height: 100px;
  position: absolute;
  left: 300px;
  top: -10px;
  border: 6px solid white;
  border-radius: 50%;
  opacity: 0;
  animation: circleAppear 1.8s ease-out 0.2s forwards;
  z-index: 2;
  
}

/* Hollow Square (left of circle) */
.square {
  width: 100px;
  height: 100px;
  border: 6px solid white;
  border-radius: 20px;
  position: absolute;
  left: -25px;
  top: -10px;
  opacity: 0;
  animation: slidein 1
;
  animation: fadeInScale 2s ease-out 1s forwards;
}
.square ::after {
  width: 100px;
  height: 100px;position: absolute; 
  right: 200px;
  top: 10px;
  border: 6px solid white;
  border-radius: 20px;
  position: absolute;
  left: -140px;
  top: 0;
  opacity: 0;
  animation: fadeoutScale 3s ease-out 1s;
}

/* Hollow Triangle (right of circle, from circle center) */
.triangle {
  width: 0;
  height: 0;
  border-left: 60px solid transparent;
  border-right: 60px solid transparent;
  border-bottom: 100px solid white;
  position: absolute;
  left: 140px;
  top: 0;
  opacity: 0;
  animation: fadeInScale 1s ease-out 2s forwards;
}

.triangle::after {
  content: "";
  position: absolute;
  top: 12px;
  left: -45px;
  width: 0;
  height: 0;
  border-left: 45px solid transparent;
  border-right: 45px solid transparent;
  border-bottom: 78px solid #1a1a1a;
}

/* Title */
.title {
  font-size: 48px;
  font-weight: bold;
  position: absolute;
  left: 430px;
  top: 330px;
  margin-top: 20px;
  margin-bottom: 20px;
  opacity: 0;
  animation: fadeInText 2s ease-in-out 3.2s forwards;
}

/* Button Layout - aligns under center circle */
.button-row {
  display: absolute;
  position: absolute;
  top: 12000px;
  left: 45px;
  gap: 40px;
  margin-top: 20px;
}

/* Start (O) Button */
/* START BUTTON (◯) */
.start-button {
  width: auto;
  height: auto;
  border: none; /* no white border/circle */
  background-color: transparent;
  color: #229cee;
  font-size: 78px;
  font-weight: bold;
  position: absolute;
  top: 400px;
  left: 450px;
  cursor: pointer;
  opacity: 0;
  animation: fadeInUp 1s ease-in 5.2s forwards;
  outline: none;         /* prevent focus ring */
  -webkit-tap-highlight-color: transparent; /* remove tap flash on mobile */
}

.start-button:focus,
.start-button:active {
  outline: none;
  box-shadow: none; /* remove glow or highlight on click */
}

/* ABORT BUTTON (✖️) */
.abort-button {
  border: none;
  background-color: transparent;
  color: #fa2b2b;
  font-size: 118px;
  font-weight: bold;
  position: absolute;
  top: 460px;
  left: 740px;
  cursor: not-allowed;
  opacity: 0;
  animation: fadeInUp 1s ease-in 5.5s forwards;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.abort-button:hover {
  text-shadow: 0 0 15px rgba(248, 113, 113, 0.8); /* soft glow, not box shadow */
}


/* Abort (X) Button */
.abort-button {
  width: 70px;
  height: 70px;
  border: none;
  border-radius: 0%;
  background-color: transparent;
  color: #fa2b2b;
  font-size: 78px;
  font-weight: bold;
  position: absolute;
  top: 440px;
  left: 750px;
  cursor: not-allowed;
  transition: box-shadow 0.4s ease;
  opacity: 0;
  animation: fadeInUp 1s ease-in 5.5s forwards;
}

/* Hover Effects */
.start-button:hover {
  text-shadow: 0 0 20px #0551df;
}

.abort-button:hover {
  text-shadow: 0 0 20px #f84d4d;
}

/* Animations */
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.3); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes fadeInText {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes circleAppear {
  0% { opacity: 0; transform: scale(0.3); }
  100% { opacity: 1; transform: scale(1); }
}
/* ============================= */
/*      LOGIN PAGE STYLING      */
/* ============================= */
/* src/app.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom Animations */
@layer utilities {
  @keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 6s ease infinite;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeInUp {
    animation: fadeInUp 1s ease-out forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .animate-fadeIn {
    animation: fadeIn 1s ease-out forwards;
  }
}

/* Optional global styles */
body {
  @apply bg-[#0f172a] text-white font-sans antialiased;
  background: linear-gradient(to right, #0f172a, #1e293b, #0f172a);
}

input:focus,
button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1e293b;
}

::-webkit-scrollbar-thumb {
  background-color: #7c3aed;
  border-radius: 4px;
}

/* Hover scale utility for dramatic effect */
.hover\\:scale-105:hover {
  transform: scale(1.05);
}

/* Optional glowing headline */
h1 {
  text-shadow: 0 0 8px #d946ef, 0 0 20px #c026d3, 0 0 40px #a21caf;
}

