import Link from "next/link";
import { Server, Zap, Terminal, FolderOpen, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Zap,
    title: "Fast Dashboard",
    description:
      "Server cards update live. Redis-cached data means near-instant loads even with dozens of servers.",
  },
  {
    icon: Terminal,
    title: "Live Console",
    description:
      "Stream server output in real time via WebSocket with ANSI color, command history, and power controls.",
  },
  {
    icon: FolderOpen,
    title: "Full File Manager",
    description:
      "Browse, upload, edit, archive, and delete files directly from the panel. Monaco editor with syntax highlighting.",
  },
  {
    icon: Download,
    title: "One-Command Install",
    description:
      "A single curl command installs the panel, provisions TLS via Caddy, and configures the database.",
  },
];

function NavButton({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors",
        variant === "primary" &&
          "bg-accent text-accent-foreground hover:bg-accent/90",
        variant === "secondary" &&
          "border border-border bg-surface text-foreground hover:bg-surface-2"
      )}
    >
      {children}
    </Link>
  );
}

function HeroButton({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center rounded-md px-6 text-base font-medium transition-colors",
        variant === "primary" &&
          "bg-accent text-accent-foreground hover:bg-accent/90",
        variant === "secondary" &&
          "border border-border bg-surface text-foreground hover:bg-surface-2"
      )}
    >
      {children}
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-accent" />
            <span className="font-semibold text-foreground">HobbyPanel</span>
          </div>
          <nav className="flex items-center gap-2">
            <NavButton href="/login" variant="secondary">
              Sign in
            </NavButton>
            <NavButton href="/register">Get started</NavButton>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 pt-36 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Server className="h-3 w-3" />
            Self-hostable Minecraft panel
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Manage your servers
            <br />
            <span className="text-accent">without the noise</span>
          </h1>

          <p className="max-w-2xl text-lg text-muted">
            HobbyPanel is a fast, clean replacement for Pterodactyl&apos;s
            frontend. It runs on your own hardware, connects to Wings daemons
            you already have, and loads in under a second.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <HeroButton href="/register">Create an account</HeroButton>
            <HeroButton href="/login" variant="secondary">
              Sign in
            </HeroButton>
          </div>

          {/* Install snippet */}
          <div className="w-full max-w-xl rounded-lg border border-border bg-surface px-5 py-3 text-left">
            <p className="mb-1 text-xs text-muted">
              One-line install on Ubuntu 22.04/24.04
            </p>
            <code className="font-mono text-sm text-accent">
              curl -fsSL https://get.hobbyservers.gg | bash
            </code>
          </div>
        </section>

        {/* Feature grid */}
        <section className="border-t border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-widest text-muted">
              Everything you need
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-card-hover"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent/10">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <h3 className="mb-1.5 text-sm font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted">
          HobbyPanel — open source, self-hostable.
        </div>
      </footer>
    </div>
  );
}
