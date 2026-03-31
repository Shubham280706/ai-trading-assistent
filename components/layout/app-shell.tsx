"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Bell, LayoutDashboard, LogIn, Star, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#07101c_0%,#0a1322_40%,#08111f_100%)]" />
      <div className="fixed inset-0 -z-10 bg-grid bg-[length:36px_36px] opacity-[0.06]" />
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-slate-950 shadow-glow">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-primary/80">TradeWIthS</p>
              <p className="text-base font-semibold text-white">TradeWIthS</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            <NavLink href="/" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4" />} />
            <NavLink href="/watchlist" label="Watchlist" icon={<Star className="h-4 w-4" />} />
          </nav>
          <div className="flex items-center gap-3">
            <button className="rounded-2xl border border-border bg-white/5 p-2 text-muted transition hover:text-white">
              <Bell className="h-4 w-4" />
            </button>
            {session?.user ? (
              <Button variant="secondary" onClick={() => void signOut()}>
                Sign out
              </Button>
            ) : (
              <Button onClick={() => void signIn("google")}>
                <LogIn className="mr-2 inline h-4 w-4" />
                Google Login
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <motion.div whileHover={{ y: -1 }}>
      <Link
        href={href}
        className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white"
      >
        {icon}
        {label}
      </Link>
    </motion.div>
  );
}
