.leaderboard-wrapper {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 320px;
  z-index: 999;
  transition: all 0.3s ease-in-out;
}


.leaderboard-wrapper .leaderboard-container {
  margin-top: none;
  max-height: visible;
  overflow-y: auto;
  animation: fadeIn 0.5s ease forwards;
}

.fade-in {
  opacity: 0;
  animation: fadeIn 0.6s ease-in-out forwards;
}

.fade-in-late {
  opacity: 0;
  animation: fadeIn 0.8s ease-in-out forwards;
}

/* 🪄 Slide up for each leaderboard row */
.slide-up {
  opacity: 0;
  transform: translateY(12px);
  animation: slideUp 0.4s ease-out forwards;
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 📍 Floating fixed position - bottom right of the screen */
.leaderboard-floating-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10;
  width: 320px;
  max-height: none;
  overflow-y: visible;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 16px;
  backdrop-filter: blur(8px);
  color: #fff;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease;
}

.leaderboard-floating-container:hover {
  transform: scale(1.015);
}

/* Smooth scrollbar for overflow */
.leaderboard-floating-container::-webkit-scrollbar {
  width: 6px;
}
.leaderboard-floating-container::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
}
.leaderboard-container {
  max-width: 360px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  color: #fff;
  font-family: "Segoe UI", sans-serif;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.25);
  margin: 20px auto;
  font-size: 0.9rem;
}

.leaderboard-title {
  font-size: 1.2rem;
  text-align: center;
  margin-bottom: 12px;
  color: #ffd700;
  letter-spacing: 0.5px;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.leaderboard-entry {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: transform 0.2s;
}

.leaderboard-entry:hover {
  transform: scale(1.02);
  background-color: rgba(255, 255, 255, 0.1);
}

.leaderboard-entry .rank {
  font-weight: bold;
  width: 30px;
}

.leaderboard-entry .name {
  flex-grow: 1;
  text-align: left;
  padding-left: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leaderboard-entry .score {
  font-weight: bold;
  color: #00e676;
}

.top-rank {
  background-color: rgba(255, 255, 255, 0.12);
  border-left: 3px solid gold;
}

.leaderboard-current {
  margin-top: 14px;
  text-align: center;
}

.leaderboard-current h3 {
  font-size: 1rem;
  color: #ffffffcc;
  margin-bottom: 6px;
}

.leaderboard-entry.highlight {
  background-color: rgba(0, 255, 255, 0.2);
  border-left: 3px solid #00e5ff;
}

.leaderboard-toggle-button {
  width: 100%;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  backdrop-filter: blur(6px);
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.3s ease;
}

.leaderboard-toggle-button:hover {
  background: rgba(83, 58, 58, 0.1);
  animation: glowPulse 1.5s ease-in-out;
}

/* 👇 Emoji reactions inline at top-right, minimal size */
.reactions {
  display: flex;
  gap: 2px;
  position: absolute;
  top: 4px;
  left: 50%;
  font-size: 1rem;
  z-index: 2;
  font-weight: normal;
}

/* Each visible emoji */
.emoji-reaction {
  font-size: inherit;
  cursor: default;
}

/* +x hidden emoji count */
.emoji-more {
  font-size: 0.6rem;
  opacity: 0.7;
}

/* Reaction popup (on hover) */
.emoji-options {
  position: absolute;
  top: -38px;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  padding: 4px;
  border-radius: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  z-index: 5;
  animation: fadeIn 0.2s ease-in-out;
}

/* Label above emojis */
.react-to-name {
  width: 20%;
  font-size: .8rem;
  color: #fffb09;
  margin-bottom: 1px;
  text-align: center;
}

/* Emoji buttons */
.emoji-button {
  font-size: 1.7rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease;
  padding: 0;
  margin: 0;
}

.emoji-button:hover {
  transform: scale(1.2);
}

/* Optional animation */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
