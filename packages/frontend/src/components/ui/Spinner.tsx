interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 14, className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid currentColor`,
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "vl-spinner-rotate 0.7s linear infinite",
        opacity: 0.7,
      }}
    >
      <style>{`
        @keyframes vl-spinner-rotate {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}
