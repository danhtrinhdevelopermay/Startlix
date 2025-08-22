import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[var(--fluent-touch-target-size)] h-11 w-full rounded-[var(--fluent-border-radius-medium)] border border-[var(--fluent-neutral-stroke-1)] bg-[var(--fluent-neutral-background-1)] px-[var(--fluent-space-horizontal-m)] py-[var(--fluent-space-vertical-m)] fluent-body-medium text-[var(--fluent-neutral-foreground-1)] placeholder:text-[var(--fluent-neutral-foreground-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fluent-brand-primary)] focus-visible:border-[var(--fluent-brand-primary)] hover:border-[var(--fluent-neutral-stroke-2)] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--fluent-neutral-background-3)] file:border-0 file:bg-transparent file:text-sm file:font-medium transition-all duration-200 focus-visible:shadow-[var(--fluent-shadow-4)]",
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
