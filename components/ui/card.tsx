import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card/95 p-5 backdrop-blur-xl shadow-[0_20px_80px_rgba(8,17,31,0.35)]",
        className
      )}
    >
      {children}
    </div>
  );
}
