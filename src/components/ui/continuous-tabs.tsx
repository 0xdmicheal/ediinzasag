import { useId } from "react"
import { LayoutGroup, motion } from "motion/react"

/*
 * Watermelon UI "Continuous Tabs" (registry: continuous-tabs-base), adapted:
 * controlled, a unique layoutId per instance, ARIA tabs, and sized for the site.
 */

export interface ContinuousTab<T extends string> {
  id: T
  label: string
}

export function ContinuousTabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: ContinuousTab<T>[]
  active: T
  onChange: (id: T) => void
  /** Accessible name for the tab list. */
  label: string
}) {
  const pill = useId()
  return (
    <LayoutGroup id={pill}>
      <div
        role="tablist"
        aria-label={label}
        className="border-border bg-background relative flex w-full items-center gap-0.5 overflow-x-auto rounded-lg border-2 p-1 shadow-[inset_0_-2px_4px_color-mix(in_oklch,var(--foreground)_8%,transparent)] [scrollbar-width:none] sm:w-fit sm:gap-1"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className="relative flex-1 shrink-0 rounded-md px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:flex-none sm:px-5"
            >
              {isActive ? (
                <motion.span
                  layoutId="active-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.9 }}
                  className="bg-foreground absolute inset-0 rounded-md shadow-xs"
                />
              ) : null}
              <span
                className={`relative z-10 text-[13px] font-semibold whitespace-nowrap transition-colors duration-200 sm:text-sm ${isActive ? "text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
