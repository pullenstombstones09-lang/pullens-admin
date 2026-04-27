"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth, AuthProvider } from "@/lib/auth-context";
import { getNavItems } from "@/lib/permissions";
import { ToastProvider } from "@/components/ui/toast";
import { AlertBadge } from "@/components/alert-badge";
import {
  Home,
  Users,
  ClipboardCheck,
  Banknote,
  Wallet,
  Scale,
  Bell,
  Download,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

const iconMap: Record<string, ReactNode> = {
  home: <Home className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  "clipboard-check": <ClipboardCheck className="h-5 w-5" />,
  banknotes: <Banknote className="h-5 w-5" />,
  wallet: <Wallet className="h-5 w-5" />,
  scale: <Scale className="h-5 w-5" />,
  bell: <Bell className="h-5 w-5" />,
  download: <Download className="h-5 w-5" />,
  cog: <Settings className="h-5 w-5" />,
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const navItems = getNavItems(user.role);

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-6">
        <h1 className="text-xl font-black tracking-wide text-white leading-none">
          PULLENS ADMIN
        </h1>
        <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-[#C4A35A] uppercase">
          Cast in Stone
        </p>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      <nav className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                    "transition-all duration-200 ease-out",
                    "min-h-[48px]",
                    isActive
                      ? "border-l-[3px] border-[#C4A35A] bg-[#C4A35A]/10 text-[#C4A35A] pl-[9px] shadow-[inset_0_0_20px_rgba(196,163,90,0.05)]"
                      : "text-white/70 hover:bg-white/[0.06] hover:text-white hover:pl-3.5"
                  )}
                >
                  <span className={cn(
                    "shrink-0 transition-transform duration-200",
                    !isActive && "group-hover:scale-110"
                  )}>
                    {iconMap[item.icon] || <Home className="h-5 w-5" />}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.icon === "bell" && <AlertBadge />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-4 h-px bg-white/10" />

      <div className="px-4 py-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-white/50 capitalize">
            {user.role.replace(/_/g, " ")}
          </p>
        </div>
        <button
          onClick={logout}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
            "text-white/60 hover:bg-white/5 hover:text-red-400 transition-colors",
            "min-h-[44px]"
          )}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loading } = useAuth();

  const pathname = usePathname();
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#F5F3EF] gap-4">
        <div className="relative">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#C4A35A]/20 border-t-[#C4A35A]" />
        </div>
        <p className="text-xs font-semibold tracking-[0.2em] text-[#1A1A2E]/30 uppercase">Loading</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F3EF]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-[280px] lg:shrink-0 lg:flex-col bg-gradient-to-b from-[#1A1A2E] to-[#141425]">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile slide-out sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-gradient-to-b from-[#1A1A2E] to-[#141425] lg:hidden",
          "transition-transform duration-250 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-5 rounded-lg p-2 text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b-2 border-[#C4A35A]/20 bg-white px-4 lg:hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[#333333] hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-[#1A1A2E]">
            PULLENS ADMIN
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <DashboardShell>{children}</DashboardShell>
      </ToastProvider>
    </AuthProvider>
  );
}
