"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, PlusCircle, Settings, UserCheck, Video } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isSchedule = pathname === "/schedule";
  const isJoin = pathname?.startsWith("/join");

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
          <span className="nav-item muted">
            <Settings size={19} />
            Settings
          </span>
          <div className="profile">
            <span className="avatar">AJ</span>
            <span>
              <strong>Akshat Jaipuriar</strong>
              <small>Basic</small>
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
            <button className="icon-button" aria-label="Help">
              ?
            </button>
            <span className="avatar avatar-small">AJ</span>
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

