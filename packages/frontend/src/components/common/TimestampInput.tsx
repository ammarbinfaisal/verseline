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
      {label && (
        <span className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium w-12 shrink-0">
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder="00:00:00.000"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-invalid={error || undefined}
        className={[
          "bg-[var(--surface-2)] text-[var(--text)] border rounded-md px-2 py-1.5 text-[var(--text-fs-2)] font-mono w-32",
          "focus:outline-none focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          "transition-colors duration-[120ms] ease-[var(--ease-out-soft)]",
          error
            ? "border-[var(--error)] focus-visible:ring-[var(--error)]"
            : "border-[var(--border)] focus:border-[var(--brand-primary)] focus-visible:ring-[var(--focus-ring)]",
        ].join(" ")}
      />
    </div>
  );
}
