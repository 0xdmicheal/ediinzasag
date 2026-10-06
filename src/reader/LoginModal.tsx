import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { AnimatePresence, motion, MotionConfig } from "motion/react"

import { LoginPanel } from "@/pages/LoginPage"
import { useReader } from "@/reader/session"

/**
 * The login card as a popup over the current page, with everything behind it
 * blurred. Opened by any "Нэвтрэх" (header, save, 🔥, comments); closes on
 * sign-in, the ✕, Escape or a click outside, and leaves the reader where they were.
 */
export function LoginModal() {
  const { reader, loginOpen, closeLogin } = useReader()
  const location = useLocation()
  const open = loginOpen && !reader

  // Signed in by any route (code, password, Google demo): close.
  useEffect(() => {
    if (reader && loginOpen) closeLogin()
  }, [reader, loginOpen, closeLogin])

  // Navigating away closes it too.
  useEffect(() => {
    closeLogin()
  }, [location.pathname, closeLogin])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeLogin()
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, closeLogin])

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[90] overflow-y-auto">
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={closeLogin}
              className="bg-background/40 fixed inset-0 backdrop-blur-xl"
            />
            <div className="pointer-events-none relative flex min-h-full items-center justify-center p-3 sm:p-6">
              <motion.div
                key="panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="login-title"
                initial={{ opacity: 0, scale: 0.94, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ type: "spring", damping: 24, stiffness: 300, mass: 0.8 }}
                className="pointer-events-auto w-full max-w-5xl"
              >
                <LoginPanel from={`${location.pathname}${location.hash}`} onDone={closeLogin} onClose={closeLogin} />
              </motion.div>
            </div>
          </div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  )
}
