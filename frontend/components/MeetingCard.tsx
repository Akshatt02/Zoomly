import Link from "next/link";
import { ArrowUpRight, CalendarClock, Clock, Copy, Sparkles, Video } from "lucide-react";
import type { Meeting } from "@/lib/types";

function formatDate(date: string | null) {
  if (!date) return "Started recently";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function MeetingCard({ meeting, recent = false, onCopy }: { meeting: Meeting; recent?: boolean; onCopy: (meeting: Meeting) => void }) {
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
            {recent ? "Instant session" : formatDate(meeting.scheduled_at)}
          </span>
          <span className="dot">•</span>
          <span className="meeting-id">ID: {meeting.meeting_id}</span>
        </div>
      </div>
      <Link href={`/join/${meeting.meeting_id}?token=${meeting.invite_token}`} className="join-link">
        <span>{recent ? "Join" : "Details"}</span>
        {recent ? <Video size={16} /> : <ArrowUpRight size={16} />}
      </Link>
    </article>
  );
}

