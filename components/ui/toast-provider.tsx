"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { useToastStore } from "@/hooks/use-toast-store";

export function ToastProvider() {
  const { toasts, remove } = useToastStore();

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        remove(toast.id);
      }, 3500)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, remove]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="rounded-2xl border border-border bg-slate-950/90 p-4 shadow-2xl backdrop-blur"
          >
            <p className="text-sm font-semibold text-white">{toast.title}</p>
            {toast.description ? (
              <p className="mt-1 text-sm text-muted">{toast.description}</p>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
