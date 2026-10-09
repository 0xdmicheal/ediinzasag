import React, { type ComponentPropsWithoutRef, type CSSProperties } from "react"
import { cn } from "cn"

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string
  shimmerSize?: string
  borderRadius?: string
  shimmerDuration?: string
  background?: string
}

/** A light travels around the rim. Used for the Нэвтрэх button. */
export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "var(--primary-foreground)",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "999px",
      background = "var(--primary)",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
          } as CSSProperties
        }
        className={cn(
          "group relative z-0 inline-flex cursor-pointer items-center justify-center gap-1.5 overflow-hidden border border-primary-foreground/15 px-4 whitespace-nowrap text-primary-foreground [background:var(--bg)] [border-radius:var(--radius)]",
          "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px",
          "disabled:pointer-events-none disabled:opacity-60",
          className,
        )}
        ref={ref}
        {...props}
      >
        <div className="absolute inset-0 -z-30 overflow-visible blur-[2px]" style={{ containerType: "size" }}>
          <div className="animate-shimmer-slide absolute inset-0 aspect-square h-[100cqh] rounded-none">
            <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
          </div>
        </div>
        <span className="relative z-10 inline-flex items-center justify-center gap-1.5">{children}</span>
        <div className="absolute inset-0 size-full rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 ease-in-out group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />
        <div className="absolute inset-(--cut) -z-20 [border-radius:var(--radius)] [background:var(--bg)]" />
      </button>
    )
  },
)

ShimmerButton.displayName = "ShimmerButton"
