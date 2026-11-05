"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { BookOpenIcon, GitMergeIcon, MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet-400 text-primary-foreground shadow-sm shadow-primary/30">
        <GitMergeIcon className="size-4" />
      </span>
      <span className="text-sm font-semibold tracking-tight">BranchFlow</span>
    </Link>
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname()
  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/guide", label: "How it works", icon: BookOpenIcon },
  ]
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-xs">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                pathname === l.href && "bg-muted text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
