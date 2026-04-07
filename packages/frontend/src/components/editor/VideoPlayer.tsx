"use client";

interface VideoPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
}

export default function VideoPlayer({ src, className = "", autoPlay = false }: VideoPlayerProps) {
  return (
    <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        src={src}
        controls
        autoPlay={autoPlay}
        className="w-full h-full object-contain"
        playsInline
      />
    </div>
  );
}
