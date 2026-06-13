import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "online"
  | "offline"
  | "starting"
  | "stopping"
  | "default"
  | "amber";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  online: "bg-status-online/15 text-status-online border-status-online/20",
  offline: "bg-status-offline/15 text-status-offline border-status-offline/20",
  starting:
    "bg-status-starting/15 text-status-starting border-status-starting/20",
  stopping:
    "bg-status-stopping/15 text-status-stopping border-status-stopping/20",
  default: "bg-surface-2 text-muted border-border",
  amber: "bg-accent/15 text-accent border-accent/20",
};

const dotClasses: Record<BadgeVariant, string> = {
  online: "bg-status-online",
  offline: "bg-status-offline",
  starting: "bg-status-starting animate-pulse",
  stopping: "bg-status-stopping animate-pulse",
  default: "bg-muted",
  amber: "bg-accent",
};

export function Badge({
  variant = "default",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotClasses[variant])}
        />
      )}
      {children}
    </span>
  );
}
