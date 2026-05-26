import { cn } from "@/lib/utils";

export default function Logo({
  className,
  size = "md",
}: {
  className?: string;
  /** Kept for backward compatibility; ignored — the logo is now wordmark-only. */
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-lg tracking-[0.18em]",
    md: "text-2xl tracking-[0.18em]",
    lg: "text-4xl md:text-5xl tracking-[0.2em]",
  } as const;

  // Larger sizes get the AI-shimmer treatment so the wordmark feels alive;
  // the small variant stays plain so it doesn't compete in dense headers.
  const useShimmer = size === "lg";

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      {/* Soft halo glow behind the wordmark — only on the display size. */}
      {useShimmer && (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 blur-2xl opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, transparent 70%)",
          }}
        />
      )}
      <span
        className={cn(
          "font-bold",
          useShimmer ? "text-shimmer" : "text-canvas-white",
          sizes[size]
        )}
      >
        APEX TUTOR
      </span>
    </div>
  );
}
