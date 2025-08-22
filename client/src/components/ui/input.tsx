import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-14 w-full rounded-[var(--md-sys-shape-corner-extra-small)] border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-highest)] px-4 py-2 md-typescale-body-large text-[var(--md-sys-color-on-surface)] placeholder:text-[var(--md-sys-color-on-surface-variant)] focus-visible:outline-none focus-visible:border-[var(--md-sys-color-primary)] focus-visible:border-2 hover:border-[var(--md-sys-color-on-surface)] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--md-sys-color-surface-variant)] file:border-0 file:bg-transparent file:text-sm file:font-medium transition-colors duration-200",
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
