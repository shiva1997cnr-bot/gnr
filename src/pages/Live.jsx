import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/live.css";

export default function Live() {
  const navigate = useNavigate();

  const [now, setNow] = useState(new Date());
  const [is24h, setIs24h] = useState(true);
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : "."));
    }, 500);
    return () => clearInterval(dotTimer);
  }, []);

  const timeParts = useMemo(() => {
    const hours = is24h ? now.getHours() : ((now.getHours() + 11) % 12) + 1;
    const mins = now.getMinutes();
    const secs = now.getSeconds();
    const ampm = now.getHours() >= 12 ? "PM" : "AM";
    const pad = (n) => String(n).padStart(2, "0");
    return {
      hh: pad(hours),
      mm: pad(mins),
      ss: pad(secs),
      ampm,
      dateStr: now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }, [now, is24h]);

  return (
    <div className="live-root">
      {/* Floating back button (top-left) */}
      <button
        className="live-back-btn"
        title="Back"
        aria-label="Go back"
        onClick={() => navigate("/region")}

      >
        {/* inline SVG to avoid extra deps */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Animated gradient background */}
      <div className="bg-gradient"></div>

      {/* Subtle grid */}
      <div className="bg-grid"></div>

      {/* Floating particles */}
      <div className="particles">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className={`p p-${(i % 6) + 1}`} />
        ))}
      </div>

      {/* Center stage */}
      <main className="clock-stage">
        {/* Radar/pulse ring */}
        <div className="pulse-ring" aria-hidden />

        {/* Glassy clock card */}
        <div className="clock-card">
          <div className="clock-top">
            <span className="live-dot" />
            <span className="live-label">LIVE</span>
            <div className="spacer" />
            <button
              className="fmt-toggle"
              onClick={() => setIs24h((v) => !v)}
              title={`Switch to ${is24h ? "12-hour" : "24-hour"} format`}
            >
              {is24h ? "24H" : "12H"}
            </button>
          </div>

          <div className="clock-digits" aria-live="polite">
            <span className="digit">{timeParts.hh}</span>
            <span className="colon">:</span>
            <span className="digit">{timeParts.mm}</span>
            <span className="colon">:</span>
            <span className="digit seconds">{timeParts.ss}</span>
            {!is24h && <span className="ampm">{timeParts.ampm}</span>}
          </div>

          <div className="clock-sub">
            <span className="date">{timeParts.dateStr}</span>
            <span className="dot">•</span>
            <span className="tz">{timeParts.tz}</span>
          </div>

          {/* Waiting host message with animated dots */}
          <div className="waiting-host">
            Waiting for host to join{dots}
          </div>

          {/* Decorative scan line */}
          <div className="scanline" />
        </div>
      </main>
    </div>
  );
}
