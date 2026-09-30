"use client";

import Link from "next/link";
import { CalendarClock, Clock, Sparkles, Video } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import type { Meeting } from "@/lib/types";

function formatDate(date: string | null) {
  if (!date) return "Started recently";
  const isoStr = date.endsWith("Z") || date.includes("+") ? date : date + "Z";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(isoStr));
}

interface MeetingCardProps {
  meeting: Meeting;
  recent?: boolean;
  /** Pass true when the card is shown to the meeting's own host (e.g. in Upcoming list). */
  asHost?: boolean;
  onCopy: (meeting: Meeting) => void;
}

export function MeetingCard({ meeting, recent = false, asHost = false, onCopy }: MeetingCardProps) {
  const { user } = useAuth();

  // asHost is set by the parent when it already knows the meeting belongs to the
  // logged-in user (e.g. upcoming list filtered server-side by host_id).
  // We also do a runtime check as fallback.
  const isHost = asHost || (!!user && meeting.host_id === user.id);
  const href = isHost
    ? `/meeting/${meeting.meeting_id}?host=1&name=${encodeURIComponent(user?.name ?? meeting.host_name)}`
    : `/join/${meeting.meeting_id}?token=${meeting.invite_token}`;

  const label = isHost ? (recent ? "Rejoin" : "Start") : (recent ? "Rejoin" : "Join");

  return (
    <article className="meeting-card">
      <div className={`meeting-icon ${recent ? "recent-icon" : ""}`}>
        {recent ? <Sparkles size={20} /> : <CalendarClock size={20} />}
      </div>
      <div className="meeting-body">
        <div className="meeting-heading">
          <h3>{meeting.title}</h3>
        </div>
        <div className="meeting-meta">
          <span className="meta-time">
            <Clock size={12} />
            {meeting.scheduled_at ? formatDate(meeting.scheduled_at) : "Instant session"}
          </span>
          <span className="dot">•</span>
          <span className="meeting-id">ID: {meeting.meeting_id}</span>
        </div>
      </div>
      <Link href={href} className="join-link">
        <span>{label}</span>
        <Video size={16} />
      </Link>
    </article>
  );
}
