import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/about.css";

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      {/* Top banner */}
      <section className="about-banner" role="banner" aria-label="Generalist Overview Banner">
        <div className="about-banner__overlay">
          <h1 className="about-title">Generalist</h1>
          <p className="about-tagline">Learn fast. Compete fairly.</p>

          <div className="about-cta">
            <button className="btn btn-primary" onClick={() => navigate("/region")}>
              Go to Regions
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/profile")}>
              View Profile
            </button>
          </div>
        </div>
      </section>

      {/* Intro: What Generalist is */}
      <section className="about-section">
        <div className="container">
          <h2 className="section-title">What is Generalist?</h2>
          <p className="section-text">
            Generalist is a bite-sized learning app built around region-based quizzes. Pick a region -
            <strong> US/CAN, South Asia, Western Europe, Latin America, Africa,</strong> or
            <strong> ESEA</strong> - and sharpen your understanding of that Geography, Polity and Governance. You’ll get
            instant feedback, track progress on your Profile, and climb the leaderboard through fair,
            time-bound challenges. There’s even a live quiz mode for real-time excitement with your peers.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="about-section muted">
        <div className="container">
          <h2 className="section-title">How it works</h2>
          <ol className="how-grid" aria-label="Steps to use Generalist">
            <li className="how-card">
              <div className="how-icon">🧭</div>
              <h3>Pick a region</h3>
              <p>Select US/CAN, SA, WE, LATAM, AFR, or ESEA to focus your practice.</p>
            </li>
            <li className="how-card">
              <div className="how-icon">⏱️</div>
              <h3>Take the quiz</h3>
              <p>Short, time-bound questions keep it fair and focused.</p>
            </li>
            <li className="how-card">
              <div className="how-icon">📊</div>
              <h3>Get feedback</h3>
              <p>See your score and a quick verdict right away.</p>
            </li>
            <li className="how-card">
              <div className="how-icon">🗂️</div>
              <h3>Track progress</h3>
              <p>Your Profile shows region-wise performance over time.</p>
            </li>
            <li className="how-card">
              <div className="how-icon">🏆</div>
              <h3>Climb the board</h3>
              <p>Improve consistently to rise on the leaderboard.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* Scoring & Attempts */}
      <section className="about-section">
        <div className="container">
          <h2 className="section-title">Scoring & attempts at a glance</h2>
          <ul className="bullets">
            <li>⏳ <strong>Time-bound</strong> questions keep play fair (default: <strong>30s per question</strong>).</li>
            <li>🔁 <strong>One attempt per quiz</strong> to keep competition equal.</li>
            <li>🏷️ Feedback tiers: <strong>Excellent</strong>, <strong>Impressive</strong>, <strong>Needs Improvement</strong>.</li>
          </ul>
        </div>
      </section>

      {/* Live Quiz */}
      <section className="about-section muted">
        <div className="container">
          <h2 className="section-title">Live quiz overview</h2>
          <p className="section-text">
            Join scheduled live sessions to compete in real time. You’ll see your position update as people
            answer — it’s fast, fun, and a great way to test what you know under a timer.
          </p>
        </div>
      </section>

      {/* Data & Privacy + Tech badges */}
      <section className="about-section">
        <div className="container two-col">
          <div>
            <h2 className="section-title">Data & privacy basics</h2>
            <ul className="bullets">
              <li>🗄️ We store your <strong>name, username, quiz scores & timestamps</strong>.</li>
              <li>☁️ Data lives in <strong>Firestore</strong> to power profiles, leaderboards, and analytics.</li>
              <li>🎯 We use your data only to show progress, measure learning, and improve the experience.</li>
            </ul>
          </div>

          <div>
            <h2 className="section-title">Built for trust</h2>
            <ul className="badges">
              <li>⚡ Real-time updates</li>
              <li>🧱 Firebase (Firestore)</li>
              <li>📄 Export scores to XLSX</li>
              <li>🎯 Lightweight & responsive</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA again */}
      <section className="about-section cta-block">
        <div className="container ctas-stack">
          <h2 className="section-title">Ready to dive in?</h2>
          <div className="about-cta">
            <button className="btn btn-primary" onClick={() => navigate("/region")}>
              Go to Regions
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/profile")}>
              View Profile
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="about-footer">
        <div className="container">
          <p>© {new Date().getFullYear()} Generalist. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
