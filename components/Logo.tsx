import { cn } from "@/lib/utils";

export default function Logo({
  className,
  showText = true,
  size = "md",
}: {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { orb: "w-6 h-6", text: "text-sm" },
    md: { orb: "w-8 h-8", text: "text-base" },
    lg: { orb: "w-10 h-10", text: "text-lg" },
  } as const;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("relative rounded-full overflow-hidden shadow-sm", sizes[size].orb)}>
        <div className="orb-logo absolute inset-0 rounded-full" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent" />
        <div className="absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full bg-white/80 blur-[1px]" />
      </div>
      {showText && (
        <span className={cn("font-bold tracking-wider text-ink", sizes[size].text)}>
          APEX TUTOR
        </span>
      )}
    </div>
  );
}
