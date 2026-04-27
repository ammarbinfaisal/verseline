import { cn } from "./cn";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  /** Render as a rounded square (avatar/icon placeholder) */
  circle?: boolean;
}

export function Skeleton({ className, width, height, circle }: SkeletonProps) {
  return (
    <div
      className={cn("vl-skeleton", circle && "rounded-full", className)}
      style={{
        width,
        height,
      }}
      aria-hidden="true"
    />
  );
}
