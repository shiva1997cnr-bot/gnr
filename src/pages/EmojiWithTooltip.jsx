// components/EmojiWithTooltip.jsx
import React from "react";
import "./EmojiWithTooltip.css"; // We'll add CSS next

export default function EmojiWithTooltip({ emoji, users }) {
  const count = users.length;
  const tooltipText = `${emoji} reacted by: ${users.join(", ")}`;
  const label = count > 3 ? "3+" : count;

  return (
    <span className="emoji-tooltip-wrapper">
      <span className="emoji-with-count">{emoji} {label}</span>
      <div className="emoji-tooltip">{tooltipText}</div>
    </span>
  );
}
