import secrets
from datetime import datetime, timezone

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
    now = datetime.now(timezone.utc)
    query = select(Meeting).where(Meeting.scheduled_at.is_not(None), Meeting.scheduled_at >= now)
    if host_id is not None:
        query = query.where(Meeting.host_id == host_id)
    return list(db.scalars(query.order_by(Meeting.scheduled_at)).all())


def list_recent(db: Session, host_id: int | None = None) -> list[Meeting]:
    query = select(Meeting).where(Meeting.meeting_type == "instant")
    if host_id is not None:
        query = query.where(Meeting.host_id == host_id)
    return list(db.scalars(query.order_by(Meeting.created_at.desc()).limit(8)).all())


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
