"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, ChevronRight, Clock, History, LoaderCircle, Plus, Sparkles, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MeetingCard } from "@/components/MeetingCard";
import { Toast } from "@/components/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import type { Dashboard, Meeting } from "@/lib/types";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      api.dashboard().then(setData).catch((err) => setError(err.message));
    }

    const updateTime = () => {
      setCurrentTime(
        new Intl.DateTimeFormat("en", {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date())
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (searchParams.get("scheduled")) setToast("Meeting scheduled and added to your workspace.");
    if (searchParams.get("left")) setToast("You left the meeting room.");
  }, [searchParams]);

  async function newMeeting() {
    setCreating(true);
    try {
      const meeting = await api.createInstant();
      router.push(`/meeting/${meeting.meeting_id}?host=1&name=${encodeURIComponent(user?.name ?? "Host")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create instant meeting.");
    } finally {
      setCreating(false);
    }
  }

  async function copyInvite(meeting: Meeting) {
    await navigator.clipboard.writeText(`${window.location.origin}${meeting.invite_url}`);
    setToast("Invite link copied to clipboard.");
  }

  const todayFormatted = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
      ? "Good afternoon"
      : "Good evening";

  // Show a spinner while auth is loading or redirecting
  if (authLoading || (!user && !authLoading)) {
    return (
      <AppShell>
        <div className="loading-row">
          <LoaderCircle className="spin" size={22} /> Checking session…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="dashboard">
        <section className="welcome">
          <div>
            <div className="eyebrow-badge">
              <span className="live-dot" />
              <span>{todayFormatted}</span>
            </div>
            <h1>
              {greeting}, {user?.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="subtitle">Ready to collaborate? Launch an instant video room or manage upcoming calls.</p>
          </div>

          <div className="time-card">
            <Clock size={18} className="time-icon" />
            <span>{currentTime || "12:00 PM"}</span>
          </div>
        </section>

        <section className="actions-grid">
          <button className="action-card primary-action" onClick={newMeeting} disabled={creating}>
            <div className="action-icon-badge">
              {creating ? <LoaderCircle className="spin" size={26} /> : <Plus size={26} />}
            </div>
            <div className="action-text">
              <strong>{creating ? "Launching Room..." : "New Meeting"}</strong>
              <span>Instant video workspace</span>
            </div>
            <Sparkles className="card-sparkle-bg" size={60} />
          </button>

          <button className="action-card secondary-action" onClick={() => router.push("/join")}>
            <div className="action-icon-badge blue-badge">
              <UserPlus size={24} />
            </div>
            <div className="action-text">
              <strong>Join Meeting</strong>
              <span>Enter meeting ID or invite link</span>
            </div>
          </button>

          <button className="action-card secondary-action" onClick={() => router.push("/schedule")}>
            <div className="action-icon-badge purple-badge">
              <CalendarPlus size={24} />
            </div>
            <div className="action-text">
              <strong>Schedule</strong>
              <span>Plan ahead on your calendar</span>
            </div>
          </button>
        </section>

        {error && <div className="page-error">{error}</div>}

        <section className="content-section">
          <div className="section-heading">
            <div>
              <h2>Upcoming meetings</h2>
              <p>Your upcoming sessions and calls.</p>
            </div>
            <button className="text-button" onClick={() => router.push("/schedule")}>
              Schedule call <ChevronRight size={16} />
            </button>
          </div>

          {!data ? (
            <div className="loading-row">
              <LoaderCircle className="spin" size={20} /> Loading workspace meetings...
            </div>
          ) : data.upcoming_meetings.length ? (
            <div className="meeting-list">
              {data.upcoming_meetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} onCopy={copyInvite} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <CalendarPlus size={22} />
              <span>No upcoming meetings scheduled. Click &quot;Schedule&quot; to set one up.</span>
            </div>
          )}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <h2>Recent meetings</h2>
              <p>Quick access to previous video rooms.</p>
            </div>
          </div>
          {data && data.recent_meetings.length > 0 ? (
            <div className="meeting-list recent-list">
              {data.recent_meetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} recent onCopy={copyInvite} />
              ))}
            </div>
          ) : data ? (
            <div className="empty-state">
              <History size={20} />
              <span>No recent meeting history.</span>
            </div>
          ) : null}
        </section>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="loading-row">Loading your dashboard...</div>
        </AppShell>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
