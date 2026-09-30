# Zoomly

A Zoom-style meeting app with sign-in, a hosted dashboard, instant and scheduled meetings, shareable invite links, a host waiting room, in-meeting chat, and live camera/microphone/screen-share over a WebRTC mesh.

## Stack

- Frontend: Next.js App Router, React, TypeScript, CSS, Lucide icons
- Backend: FastAPI, Pydantic, SQLAlchemy
- Database: SQLite
- Realtime: FastAPI WebSockets for signalling; browser WebRTC for media

## Architecture

`Next.js UI -> REST API + WebSocket -> FastAPI routers/services -> SQLAlchemy -> SQLite`

The frontend owns presentation and WebRTC. `frontend/lib/api.ts` and `frontend/lib/authApi.ts` are the browser API layers. FastAPI validates input, owns meeting lifecycle, and relays peer signalling. JWT auth is sent as `Authorization: Bearer` (with an httpOnly cookie fallback).

## Database Design

- `users`: registered accounts (name, email, password hash). A seeded default host remains for local demos.
- `meetings`: hosted by one user, with a unique 10-digit `meeting_id` and a unique `invite_token`. Stores type, schedule, lock/waiting-room flags, and status.
- `participants`: per-meeting join sessions (display name, host/participant role, media state, join/leave timestamps).
- Participant lifecycle is `waiting`, `active`, `left`, or `removed`. Hand-raise state is stored on the participant row.

`meetings.host_id -> users.id` and `participants.meeting_id -> meetings.id` are foreign keys.

## Features

- Register / login / logout, then create instant meetings or schedule them from the dashboard
- Join by meeting ID or invite link; guests wait until the host admits them
- Host controls: admit, admit all, mute, mute all, remove, lock, end meeting
- Guest controls: mute, camera, raise hand, leave, public and direct chat
- Local camera and microphone auto-start in the room (with permission fallbacks)
- **Screen share** uses a second WebRTC video track, separate from the camera:
  - Shared content plays on the large stage (`object-fit: contain`, not mirrored)
  - Participant cameras stay in the filmstrip tiles (`object-fit: cover`, mirrored)
  - Stopping share removes only the screen sender so the camera keeps working

## API

Auth:

- `POST /api/auth/register` - create an account
- `POST /api/auth/login` - sign in
- `GET /api/auth/me` - current user
- `POST /api/auth/logout` - clear session cookie

Meetings:

- `GET /api/dashboard` - current user, upcoming meetings, recent meetings
- `POST /api/meetings` - create an instant meeting
- `POST /api/meetings/schedule` - schedule a meeting
- `GET /api/meetings/{meeting_id}` - get a meeting
- `POST /api/meetings/{meeting_id}/join` - create a participant session
- `GET /api/meetings/{meeting_id}/participants` - participants by state
- `POST /api/meetings/{meeting_id}/participants/{participant_id}/mute`
- `PATCH /api/meetings/{meeting_id}/participants/{participant_id}/media`
- `POST /api/meetings/{meeting_id}/participants/{participant_id}/admit`
- `POST /api/meetings/{meeting_id}/participants/admit-all`
- `POST /api/meetings/{meeting_id}/participants/{participant_id}/remove`
- `POST /api/meetings/{meeting_id}/participants/{participant_id}/raise-hand`
- `POST /api/meetings/{meeting_id}/participants/{participant_id}/leave`
- `POST /api/meetings/{meeting_id}/mute-all`
- `POST /api/meetings/{meeting_id}/lock`
- `POST /api/meetings/{meeting_id}/end`
- `GET /api/meetings/{meeting_id}/messages`
- `POST /api/meetings/{meeting_id}/messages`
- `WS /api/ws/meetings/{meeting_id}` - presence, chat, WebRTC signals, `media_state`, and `screen_share`

## Run Locally

Start the API:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --env-file .env --reload
```

Copy `backend/.env.example` to `backend/.env` if needed. The database is created and seeded at startup.

Start the web app:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` for the API. Set `DATABASE_URL` and `FRONTEND_ORIGIN` on the API. `localhost` and `127.0.0.1` are allowed by default.

## Deployment

Deploy the FastAPI backend from `render.yaml` as a Render Blueprint. Set `FRONTEND_ORIGIN_REGEX` to the exact frontend origin. The free SQLite file is ephemeral unless you attach a disk or switch to PostgreSQL.

Deploy `frontend` on Vercel. Set `NEXT_PUBLIC_API_URL` to the HTTPS API URL and redeploy. HTTPS is required for phone media permissions.

## Assumptions and Limits

- Auth is JWT-based for dashboard and host actions. Guests can still join a meeting over the invite flow; media is a WebRTC mesh with WebSocket signalling (offers, answers, ICE, screen-share announcements).
- Camera and screen share are sent as separate video tracks. Receivers keep camera audio/video on participant tiles and the extra video-only stream on the share stage.
- The mesh is sized for a small demo. Production would keep this signalling model but add TURN and an SFU (LiveKit, mediasoup).
- SQLite is fine for the assessment. A multi-instance production app should use PostgreSQL.

## Verification

```bash
cd backend
pytest

cd ../frontend
npm run build
```
