"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Home, PlusCircle, Power, UserCheck, Video } from "lucide-react";
import { useAuth } from "@/lib/authContext";

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const isHome = pathname === "/";
  const isSchedule = pathname === "/schedule";
  const isJoin = pathname?.startsWith("/join");

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const displayName = user?.name ?? "Account";
  const avatarText = user ? initials(user.name) : "?";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Video size={19} fill="currentColor" />
          </span>
          <span>zoomly</span>
        </Link>
        <nav>
          <Link href="/" className={`nav-item ${isHome ? "active" : ""}`}>
            <Home size={19} />
            Home
          </Link>
          <Link href="/schedule" className={`nav-item ${isSchedule ? "active" : ""}`}>
            <CalendarDays size={19} />
            Meetings
          </Link>
          <Link href="/join" className={`nav-item ${isJoin ? "active" : ""}`}>
            <UserCheck size={19} />
            Join
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item logout-nav-item" onClick={handleLogout} title="Sign out">
            <Power size={18} />
            Sign out
          </button>
          <div className="profile">
            <span className="avatar">{avatarText}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{user?.email ?? ""}</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            <span className="brand-mark">
              <Video size={16} fill="currentColor" />
            </span>
            <span>zoomly</span>
          </Link>
          <div className="topbar-actions">
            <button className="avatar avatar-small topbar-avatar-btn" onClick={handleLogout} title="Sign out">
              {avatarText}
            </button>
          </div>
        </header>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <Link href="/" className={`mobile-nav-item ${isHome ? "active" : ""}`}>
          <Home size={20} />
          <span>Home</span>
        </Link>
        <Link href="/join" className={`mobile-nav-item ${isJoin ? "active" : ""}`}>
          <PlusCircle size={20} />
          <span>Join</span>
        </Link>
        <Link href="/schedule" className={`mobile-nav-item ${isSchedule ? "active" : ""}`}>
          <CalendarDays size={20} />
          <span>Schedule</span>
        </Link>
      </nav>
    </div>
  );
}
