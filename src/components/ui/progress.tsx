import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  /** Visual variant — default follows accent, status variants match status colors */
  variant?: "default" | "low" | "medium" | "high";
}

function autoVariant(value: number): "low" | "medium" | "high" {
  if (value < 60) return "low";
  if (value < 85) return "medium";
  return "high";
}

const trackClasses = "h-1 w-full overflow-hidden rounded-full bg-surface-2";

const fillClasses: Record<string, string> = {
  default: "bg-accent/70",
  low: "bg-status-online/70",
  medium: "bg-status-starting/80",
  high: "bg-status-offline/80",
};

export function Progress({
  value,
  variant,
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const resolved = variant ?? autoVariant(clamped);
  return (
    <div className={cn(trackClasses, className)} {...props}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fillClasses[resolved])}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
