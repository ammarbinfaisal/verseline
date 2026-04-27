import { Spinner } from "./Spinner";
import { cn } from "./cn";

type Status = "saved" | "dirty" | "saving" | "error" | "idle";

interface StatusPillProps {
  status: Status;
  label?: string;
  className?: string;
  onClick?: () => void;
  shortcut?: string;
}

const map: Record<Status, { default: string; icon: string; bg: string; fg: string }> = {
  saved:  { default: "All changes saved", icon: "✓", bg: "var(--success-bg)", fg: "var(--success)" },
  dirty:  { default: "Unsaved",            icon: "●", bg: "var(--warn-bg)",    fg: "var(--warn)" },
  saving: { default: "Saving",             icon: "",  bg: "var(--surface-2)",  fg: "var(--text-muted)" },
  error:  { default: "Save failed",        icon: "⚠", bg: "var(--error-bg)",   fg: "var(--error)" },
  idle:   { default: "",                   icon: "",  bg: "var(--surface-2)",  fg: "var(--text-muted)" },
};

export function StatusPill({ status, label, className, onClick, shortcut }: StatusPillProps) {
  const m = map[status];
  const text = label ?? m.default;
  const Tag = (onClick ? "button" : "span") as "button" | "span";

  return (
    <Tag
      onClick={onClick}
      role="status"
      aria-live={status === "saving" ? "polite" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm",
        "text-[var(--text-fs-1)] font-medium",
        onClick &&
          "cursor-pointer hover:brightness-110 focus-visible:outline focus-visible:outline-2 " +
          "focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
        className,
      )}
      style={{ background: m.bg, color: m.fg }}
    >
      {status === "saving" ? (
        <Spinner size={10} />
      ) : (
        m.icon && <span aria-hidden="true">{m.icon}</span>
      )}
      <span>{text}</span>
      {shortcut && (
        <span className="text-[var(--text-faint)] font-mono ml-1" aria-hidden="true">
          {shortcut}
        </span>
      )}
    </Tag>
  );
}
