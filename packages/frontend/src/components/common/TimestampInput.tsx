"use client";

import { useState, useRef } from "react";

interface TimestampInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

/** Validate HH:MM:SS or HH:MM:SS.mmm format */
function isValidTimestamp(v: string): boolean {
  return /^\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(v);
}

/** Normalize to HH:MM:SS.mmm */
function normalize(v: string): string {
  const [timePart, msPart = "000"] = v.split(".");
  const ms = msPart.padEnd(3, "0").slice(0, 3);
  return `${timePart}.${ms}`;
}

export default function TimestampInput({ value, onChange, label, className = "" }: TimestampInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // When not editing, the displayed value is always the external value.
  // When editing, we show the local draft. No effect needed — derive directly.
  const displayValue = editing ? draft : value;

  function handleFocus() {
    setEditing(true);
    setDraft(value);
    setError(false);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function handleBlur() {
    setEditing(false);
    if (isValidTimestamp(draft)) {
      setError(false);
      onChange(normalize(draft));
    } else {
      setError(true);
      setDraft(value);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") inputRef.current?.blur();
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-xs text-zinc-500 dark:text-zinc-400 w-12 shrink-0">{label}</span>}
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder="00:00:00.000"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={[
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border rounded px-2 py-1 text-sm font-mono w-32",
          "focus:outline-none focus:ring-1",
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-zinc-400 dark:border-zinc-600 focus:ring-indigo-500",
        ].join(" ")}
      />
    </div>
  );
}
