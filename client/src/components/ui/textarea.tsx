import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-[var(--fluent-border-radius-medium)] fluent-glass-subtle px-[var(--fluent-space-horizontal-m)] py-[var(--fluent-space-vertical-m)] fluent-body-medium text-[var(--fluent-neutral-foreground-1)] placeholder:text-[var(--fluent-neutral-foreground-3)] focus-visible:outline-none focus-visible:fluent-glass-strong focus-visible:fluent-shadow-medium focus-visible:transform focus-visible:-translate-y-1 hover:fluent-glass disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
