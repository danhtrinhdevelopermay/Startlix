import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fluent-brand-primary)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 fluent-body-medium active:scale-[0.96]",
  {
    variants: {
      variant: {
        // Fluent Design 2 iOS Primary Button
        filled: "bg-[var(--fluent-brand-primary)] text-white hover:bg-[var(--fluent-brand-primary-hover)] active:bg-[var(--fluent-brand-primary-pressed)] shadow-[var(--fluent-shadow-4)]",
        // Fluent Design 2 iOS Outlined Button  
        outlined:
          "border border-[var(--fluent-neutral-stroke-1)] bg-transparent text-[var(--fluent-brand-primary)] hover:bg-[var(--fluent-neutral-background-2)] active:bg-[var(--fluent-neutral-background-3)] hover:border-[var(--fluent-neutral-stroke-2)]",
        // Fluent Design 2 iOS Text Button
        text: "bg-transparent text-[var(--fluent-brand-primary)] hover:bg-[var(--fluent-neutral-background-2)] active:bg-[var(--fluent-neutral-background-3)]",
        // Fluent Design 2 iOS Subtle Button
        subtle:
          "bg-[var(--fluent-neutral-background-2)] text-[var(--fluent-neutral-foreground-1)] hover:bg-[var(--fluent-neutral-background-3)] active:bg-[var(--fluent-neutral-background-4)]",
        // Legacy variants for compatibility
        default: "bg-[var(--fluent-brand-primary)] text-white hover:bg-[var(--fluent-brand-primary-hover)] active:bg-[var(--fluent-brand-primary-pressed)] shadow-[var(--fluent-shadow-4)]",
        destructive:
          "bg-[var(--fluent-error-primary)] text-white hover:bg-red-600 active:bg-red-700 shadow-[var(--fluent-shadow-4)]",
        secondary:
          "bg-[var(--fluent-neutral-background-2)] text-[var(--fluent-neutral-foreground-1)] hover:bg-[var(--fluent-neutral-background-3)] active:bg-[var(--fluent-neutral-background-4)]",
        ghost: "bg-transparent hover:bg-[var(--fluent-neutral-background-2)] active:bg-[var(--fluent-neutral-background-3)]",
        link: "text-[var(--fluent-brand-primary)] underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        default: "min-h-[var(--fluent-touch-target-size)] h-11 px-[var(--fluent-space-horizontal-l)] rounded-[var(--fluent-border-radius-medium)]",
        sm: "min-h-[32px] h-8 px-[var(--fluent-space-horizontal-m)] rounded-[var(--fluent-border-radius-small)] text-sm",
        lg: "min-h-[var(--fluent-touch-target-size)] h-12 px-[var(--fluent-space-horizontal-xl)] rounded-[var(--fluent-border-radius-large)]",
        icon: "min-h-[var(--fluent-touch-target-size)] h-11 w-11 rounded-[var(--fluent-border-radius-medium)]",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "default",
    },
  }
)

// iOS-style haptic feedback and visual feedback
const createIOSFeedback = (event: React.MouseEvent<HTMLButtonElement>) => {
  const button = event.currentTarget
  
  // Add haptic feedback for iOS (subtle scale animation already handled by CSS)
  if ('vibrate' in navigator) {
    navigator.vibrate(1)
  }
  
  // Optional: Add a subtle highlight effect for better visual feedback
  button.style.transform = 'scale(0.96)'
  
  setTimeout(() => {
    button.style.transform = ''
  }, 150)
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      // Create iOS-style feedback
      createIOSFeedback(event)
      
      // Call the original onClick if provided
      if (onClick) {
        onClick(event)
      }
    }

    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={asChild ? onClick : handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
