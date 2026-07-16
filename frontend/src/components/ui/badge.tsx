import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-hud-grid/50 bg-hud-grid/10 text-hud-grid",
        secondary:
          "border-hud-grid/25 bg-transparent text-hud-ink",
        destructive:
          "border-hud-warn/60 bg-hud-warn/10 text-hud-warn",
        outline: "border-hud-grid/30 text-hud-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
