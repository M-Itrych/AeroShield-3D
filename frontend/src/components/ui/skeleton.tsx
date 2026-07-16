import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-hud-grid/8", className)}
      {...props}
    />
  )
}

export { Skeleton }
