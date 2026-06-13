import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface-2 animate-shimmer",
        "bg-gradient-to-r from-surface-2 via-border to-surface-2 bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}
