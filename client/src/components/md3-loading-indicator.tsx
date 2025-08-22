import { cn } from "@/lib/utils";

interface MD3LoadingIndicatorProps {
  /** Size variant of the loading indicator */
  size?: "small" | "medium" | "large";
  /** Color variant */
  variant?: "primary" | "secondary" | "error";
  /** Progress value for determinate mode (0-1) */
  progress?: number;
  /** Whether the indicator should be indeterminate (infinite spinning) */
  indeterminate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
  /** ARIA attributes for accessibility */
  "aria-valuenow"?: number;
  "aria-valuemin"?: number;
  "aria-valuemax"?: number;
  /** Test ID for testing */
  "data-testid"?: string;
}

export default function MD3LoadingIndicator({
  size = "medium",
  variant = "primary",
  progress,
  indeterminate = true,
  className,
  label = "Loading",
  "aria-valuenow": ariaValueNow,
  "aria-valuemin": ariaValueMin = 0,
  "aria-valuemax": ariaValueMax = 100,
  "data-testid": testId,
  ...props
}: MD3LoadingIndicatorProps) {
  const isDeterminate = progress !== undefined && !indeterminate;
  const radius = 18; // For viewBox 48x48, radius should be 18 to maintain proper proportions
  const circumference = 2 * Math.PI * radius;
  
  // Convert progress (0-1) to percentage for aria-valuenow
  const progressPercentage = isDeterminate ? Math.round((progress || 0) * 100) : undefined;

  return (
    <div
      className={cn(
        "md3-loading-indicator",
        `md3-loading-indicator--${size}`,
        `md3-loading-indicator--${variant}`,
        {
          "md3-loading-indicator--indeterminate": !isDeterminate,
          "md3-loading-indicator--determinate": isDeterminate,
        },
        className
      )}
      role="progressbar"
      aria-label={label}
      aria-valuenow={isDeterminate ? progressPercentage : ariaValueNow}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      data-testid={testId}
      style={
        isDeterminate
          ? {
              "--progress": progress || 0,
              "--circumference": circumference,
            } as React.CSSProperties
          : undefined
      }
      {...props}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        {isDeterminate && (
          <circle
            className="md3-progress-track"
            cx="24"
            cy="24"
            r={radius}
          />
        )}
        <circle
          className="md3-progress-path"
          cx="24"
          cy="24"
          r={radius}
        />
      </svg>
    </div>
  );
}

// Convenience components for common use cases
export function MD3ButtonLoading({ 
  className, 
  ...props 
}: Omit<MD3LoadingIndicatorProps, "size">) {
  return (
    <MD3LoadingIndicator
      size="small"
      className={cn("mr-2", className)}
      {...props}
    />
  );
}

export function MD3FullPageLoading({ 
  className,
  label = "Loading content",
  ...props 
}: MD3LoadingIndicatorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <MD3LoadingIndicator
          size="large"
          className={className}
          label={label}
          {...props}
        />
        <p className="md-typescale-body-large text-[var(--md-sys-color-on-background)]">
          {label}...
        </p>
      </div>
    </div>
  );
}

export function MD3VideoProcessingLoading({
  progress,
  className,
  ...props
}: MD3LoadingIndicatorProps & { progress?: number }) {
  return (
    <div className="flex flex-col items-center space-y-6">
      <MD3LoadingIndicator
        size="large"
        progress={progress}
        indeterminate={progress === undefined}
        variant="primary"
        className={className}
        label="Processing video"
        {...props}
      />
    </div>
  );
}