import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[var(--fluent-touch-target-size)] h-11 w-full rounded-[var(--fluent-border-radius-medium)] fluent-glass-subtle px-[var(--fluent-space-horizontal-m)] py-[var(--fluent-space-vertical-m)] fluent-body-medium text-[var(--fluent-neutral-foreground-1)] placeholder:text-[var(--fluent-neutral-foreground-3)] focus-visible:outline-none focus-visible:fluent-glass-strong focus-visible:fluent-shadow-medium focus-visible:transform focus-visible:-translate-y-1 hover:fluent-glass disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium transition-all duration-300",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
