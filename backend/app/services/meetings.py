import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Meeting, User

DEFAULT_USER_EMAIL = "akshat.jaipuriar@zoom.local"
LEGACY_DEFAULT_USER_EMAIL = "alex.morgan@zoom.local"


def meeting_out(meeting: Meeting) -> dict:
    return {
        "id": meeting.id,
        "meeting_id": meeting.meeting_id,
        "host_id": meeting.host_id,
        "host_name": meeting.host.name if meeting.host else "Host",
        "title": meeting.title,
        "description": meeting.description,
        "meeting_type": meeting.meeting_type,
        "scheduled_at": meeting.scheduled_at,
        "duration": meeting.duration,
        "status": meeting.status,
        "waiting_room_enabled": meeting.waiting_room_enabled,
        "is_locked": meeting.is_locked,
        "invite_token": meeting.invite_token,
        "invite_url": f"/join/{meeting.meeting_id}?token={meeting.invite_token}",
        "created_at": meeting.created_at,
    }


def create_unique_meeting_id(db: Session) -> str:
    while True:
        candidate = "".join(str(secrets.randbelow(10)) for _ in range(10))
        if not db.scalar(select(Meeting.id).where(Meeting.meeting_id == candidate)):
            return candidate


def get_default_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if not user:
        raise RuntimeError("Default user is not initialized")
    return user


def create_meeting(
    db: Session,
    title: str,
    meeting_type: str,
    description: str = "",
    scheduled_at: datetime | None = None,
    duration: int = 40,
    host_id: int | None = None,
) -> Meeting:
    if host_id is None:
        host_id = get_default_user(db).id
    meeting = Meeting(
        meeting_id=create_unique_meeting_id(db),
        host_id=host_id,
        title=title,
        description=description,
        meeting_type=meeting_type,
        scheduled_at=scheduled_at,
        duration=duration,
        status="live" if meeting_type == "instant" else "scheduled",
        invite_token=secrets.token_urlsafe(24),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def get_meeting_or_404(db: Session, meeting_id: str) -> Meeting:
    meeting = db.scalar(select(Meeting).where(Meeting.meeting_id == meeting_id))
    if not meeting:
        raise HTTPException(status_code=404, detail="That meeting could not be found")
    return meeting


def list_upcoming(db: Session, host_id: int | None = None) -> list[Meeting]:
    """Return scheduled meetings whose window (start + duration) hasn't ended yet."""
    now = datetime.utcnow()  # naive UTC — matches how SQLite stores datetimes
    # Fetch any scheduled meeting from up to MAX_DURATION minutes ago so we can
    # filter in Python using the actual end time (scheduled_at + duration).
    MAX_DURATION_MINUTES = 480
    window_cutoff = now - timedelta(minutes=MAX_DURATION_MINUTES)
    query = select(Meeting).where(
        Meeting.meeting_type == "scheduled",
        Meeting.scheduled_at.is_not(None),
        Meeting.scheduled_at >= window_cutoff,
    )
    if host_id is not None:
        query = query.where(Meeting.host_id == host_id)
    meetings = list(db.scalars(query.order_by(Meeting.scheduled_at)).all())
    # Keep only meetings whose end time (start + duration) is still in the future.
    return [m for m in meetings if m.scheduled_at + timedelta(minutes=m.duration) >= now]


def list_recent(db: Session, host_id: int | None = None) -> list[Meeting]:
    """Return recent instant meetings + past scheduled meetings that have ended."""
    now = datetime.utcnow()  # naive UTC — matches how SQLite stores datetimes

    # Instant meetings (always show in recent)
    q_instant = select(Meeting).where(Meeting.meeting_type == "instant")
    if host_id is not None:
        q_instant = q_instant.where(Meeting.host_id == host_id)
    instant = list(db.scalars(q_instant.order_by(Meeting.created_at.desc()).limit(20)).all())

    # Scheduled meetings from last 30 days
    since = now - timedelta(days=30)
    q_sched = select(Meeting).where(
        Meeting.meeting_type == "scheduled",
        Meeting.scheduled_at.is_not(None),
        Meeting.scheduled_at >= since,
    )
    if host_id is not None:
        q_sched = q_sched.where(Meeting.host_id == host_id)
    scheduled_all = list(db.scalars(q_sched.order_by(Meeting.scheduled_at.desc()).limit(40)).all())
    # Only include scheduled meetings whose window has fully ended
    past_scheduled = [m for m in scheduled_all if m.scheduled_at + timedelta(minutes=m.duration) < now]

    # Merge, sort by most-recent first, cap at 8
    combined = sorted(instant + past_scheduled, key=lambda m: m.scheduled_at or m.created_at, reverse=True)
    return combined[:8]


def seed_database(db: Session) -> None:
    """Ensure the legacy seeded user exists (migrated to new email), but create NO meetings."""
    legacy_user = db.scalar(select(User).where(User.email == LEGACY_DEFAULT_USER_EMAIL))
    if legacy_user:
        legacy_user.name = "Akshat Jaipuriar"
        legacy_user.email = DEFAULT_USER_EMAIL
        db.commit()
        return

    # Create the fallback system user only if no users exist at all
    if not db.scalar(select(User.id).where(User.email == DEFAULT_USER_EMAIL)):
        user = User(name="Akshat Jaipuriar", email=DEFAULT_USER_EMAIL, avatar=None)
        db.add(user)
        db.commit()
