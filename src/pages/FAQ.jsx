import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/faq.css";

/** Escape for regex building in highlight() */
const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Tiny highlighter for search terms */
const Highlight = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i}>{part}</mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

export default function FAQ() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(new Set()); // ids of open items

  const faqs = useMemo(
    () => [
      {
        id: "what",
        q: "What is Generalist?",
        a: "Generalist is a quick-learning app built around region-based quizzes. Choose a region, take short, timed quizzes, and track progress on your Profile while competing on the leaderboard."
      },
      {
        id: "regions",
        q: "Which regions can I practice?",
        a: "US/CAN, South Asia (SA), Western Europe (WE), Latin America (LATAM), Africa (AFR), and ESEA."
      },
      {
        id: "start",
        q: "How do I start a quiz?",
        a: "Go to the Regions page, pick a region, then open any available quiz. If a quiz is scheduled for later, it will show its launch time."
      },
      {
        id: "timer",
        q: "How long do I have per question?",
        a: "Quizzes are time-bound to keep competition fair. The default timer is 30 seconds per question unless otherwise noted on the quiz."
      },
      {
        id: "attempts",
        q: "How many attempts do I get?",
        a: "One attempt per quiz to keep the playing field level."
      },
      {
        id: "feedback",
        q: "How is feedback shown?",
        a: "After submitting, you’ll see a verdict tier based on your score: Excellent, Impressive, or Needs Improvement."
      },
      {
        id: "profile",
        q: "Where can I see my past scores?",
        a: "Your Profile shows your scores organized by region, along with time spent and timestamps."
      },
      {
        id: "live",
        q: "What is Live Quiz?",
        a: "Live Quiz sessions run at scheduled times. You answer in real time and see your rank update as others submit."
      },
      {
        id: "leaderboard",
        q: "How do I move up the leaderboard?",
        a: "Improve accuracy and answer within the time limit. Consistent performance across regions helps you rise."
      },
      {
        id: "switch",
        q: "Can I switch regions at any time?",
        a: "Yes. You can practice in any region and return later to another."
      },
      {
        id: "not-visible",
        q: "I don’t see a new quiz yet — why?",
        a: "Some quizzes have launch times. If the time hasn’t arrived or the quiz is unpublished, it may not appear yet."
      },
      {
        id: "data",
        q: "What data do you store about me?",
        a: "We store your name or username/email, quiz scores, time spent, and timestamps in Firestore. This powers your Profile and overall analytics."
      },
      {
        id: "signin",
        q: "Do I need to sign in every time?",
        a: "Your session is remembered on this device. If you clear storage or switch devices, you may need to sign in again."
      },
      {
        id: "issues",
        q: "How do I report an issue or incorrect question?",
        a: "From any page, use your usual feedback channel (e.g., team chat) or contact your organizer with the quiz title and a brief description."
      },
      {
        id: "export",
        q: "Can I export my scores?",
        a: "You can always review your Profile for a snapshot of performance. Personal export is on our roadmap."
      }
    ],
    []
  );

  const normalized = (s) => (s || "").toLowerCase();
  const filtered = useMemo(() => {
    const k = normalized(q);
    if (!k) return faqs;
    return faqs.filter(
      (item) => normalized(item.q).includes(k) || normalized(item.a).includes(k)
    );
  }, [faqs, q]);

  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpen(new Set(filtered.map((i) => i.id)));
  const collapseAll = () => setOpen(new Set());

  return (
    <div className="faq-page">
      {/* Top banner */}
      <section className="faq-banner" role="banner" aria-label="FAQ Banner">
        <div className="faq-banner__overlay">
          <h1 className="faq-title">Frequently Asked Questions</h1>
          <p className="faq-tagline">Quick answers to help you get the most out of Generalist.</p>

          <div className="faq-cta">
            <button className="btn btn-primary" onClick={() => navigate("/region")}>
              Go to Regions
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/profile")}>
              View Profile
            </button>
          </div>
        </div>
      </section>

      {/* Search + Accordion */}
      <section className="faq-section">
        <div className="container">
          <div className="faq-search" role="search">
            <span className="search-ico" aria-hidden="true">
              {/* Search icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 21l-4.3-4.3m2.8-6.2a8 8 0 11-16 0 8 8 0 0116 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="faq-input"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search questions…"
              aria-label="Search FAQs"
            />
            {q && (
              <button className="clear-btn" onClick={() => setQ("")} aria-label="Clear search">
                Clear
              </button>
            )}
          </div>

          <div className="faq-tools">
            <span className="faq-count">
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="faq-bulk">
              <button className="linklike" onClick={expandAll}>Expand all</button>
              <span className="sep">•</span>
              <button className="linklike" onClick={collapseAll}>Collapse all</button>
            </div>
          </div>

          <ul className="faq-accordion">
            {filtered.map((item) => {
              const isOpen = open.has(item.id);
              return (
                <li key={item.id} className={`faq-item ${isOpen ? "open" : ""}`}>
                  <button
                    className="faq-q"
                    onClick={() => toggle(item.id)}
                    aria-expanded={isOpen}
                    aria-controls={`panel-${item.id}`}
                    id={`header-${item.id}`}
                  >
                    <span className="qtext">
                      <Highlight text={item.q} query={q} />
                    </span>
                    <span className="chev" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>

                  <div
                    className="faq-a"
                    id={`panel-${item.id}`}
                    role="region"
                    aria-labelledby={`header-${item.id}`}
                    aria-hidden={!isOpen}
                  >
                    <p><Highlight text={item.a} query={q} /></p>
                  </div>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 && (
            <div className="faq-empty">
              No matches. Try a different term like <em>“timer”</em>, <em>“attempts”</em>, or <em>“profile”</em>.
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="faq-footer">
        <div className="container">
          <p>© {new Date().getFullYear()} Generalist. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
