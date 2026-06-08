import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Boxes, FileText, Menu, Settings, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/electrosoft-logo.png";

const NAV = [
  { to: "/",         label: "Testing",      icon: Activity, description: "Live reactor test" },
  { to: "/setup",    label: "Test Objects", icon: Boxes,    description: "Create & manage units" },
  { to: "/reports",  label: "Reports",      icon: FileText, description: "Results & export" },
  { to: "/settings", label: "Settings",     icon: Settings, description: "Preferences & data" },
] as const;

export function AppSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-panel text-foreground shadow-sm lg:hidden"
        aria-label="Toggle navigation"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop on mobile */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-panel transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card">
            <img src={logo} alt="" className="h-7 w-7 object-contain dark:invert" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.32em] text-amber-500 dark:text-amber-400">
              Electrosoft
            </div>
            <div className="truncate text-sm font-semibold text-foreground">
              Automation Suite
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Workspace
          </div>
          {NAV.map(({ to, label, icon: Icon, description }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`group flex items-start gap-3 rounded-md px-3 py-2.5 transition ${
                  active
                    ? "bg-accent text-foreground shadow-inner"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 ${active ? "text-amber-500 dark:text-amber-400" : ""}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-[11px] text-muted-foreground">{description}</div>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          RLTS v2.1
        </div>
      </aside>
    </>
  );
}
