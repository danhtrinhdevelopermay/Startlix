import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 ripple-container md-typescale-label-large",
  {
    variants: {
      variant: {
        // Material Design 3 Filled Button
        filled: "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:shadow-md hover:shadow-[var(--md-sys-color-primary)]/25 active:shadow-sm",
        // Material Design 3 Outlined Button  
        outlined:
          "border border-[var(--md-sys-color-outline)] bg-transparent text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary)]/12 active:bg-[var(--md-sys-color-primary)]/20",
        // Material Design 3 Text Button
        text: "bg-transparent text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary)]/12 active:bg-[var(--md-sys-color-primary)]/20",
        // Material Design 3 Tonal Button
        tonal:
          "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] hover:shadow-md hover:shadow-[var(--md-sys-color-secondary-container)]/25 active:shadow-sm",
        // Legacy variants for compatibility
        default: "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:shadow-md hover:shadow-[var(--md-sys-color-primary)]/25",
        destructive:
          "bg-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error)] hover:shadow-md hover:shadow-[var(--md-sys-color-error)]/25",
        secondary:
          "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] hover:shadow-md",
        ghost: "bg-transparent hover:bg-[var(--md-sys-color-surface-variant)]/50",
        link: "text-[var(--md-sys-color-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 rounded-[var(--md-sys-shape-corner-large)]",
        sm: "h-8 px-4 rounded-[var(--md-sys-shape-corner-medium)] md-typescale-label-medium",
        lg: "h-12 px-8 rounded-[var(--md-sys-shape-corner-large)]",
        icon: "h-10 w-10 rounded-[var(--md-sys-shape-corner-medium)]",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "default",
    },
  }
)

// Ripple effect function
const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
  const button = event.currentTarget
  const rect = button.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = event.clientX - rect.left - size / 2
  const y = event.clientY - rect.top - size / 2
  
  const ripple = document.createElement('span')
  ripple.className = 'ripple'
  ripple.style.width = ripple.style.height = size + 'px'
  ripple.style.left = x + 'px'
  ripple.style.top = y + 'px'
  
  // Check if button has dark background to use appropriate ripple color
  const computedStyle = window.getComputedStyle(button)
  const backgroundColor = computedStyle.backgroundColor
  const isDarkBackground = backgroundColor.includes('rgb') && 
    backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number).reduce((acc, val) => acc + val, 0)! < 384
  
  if (isDarkBackground) {
    ripple.classList.add('ripple-dark')
  }
  
  button.appendChild(ripple)
  
  // Remove ripple after animation completes
  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.parentNode.removeChild(ripple)
    }
  }, 600)
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      // Create ripple effect
      createRipple(event)
      
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
