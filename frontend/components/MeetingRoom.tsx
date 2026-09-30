"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Hand, Lock, LockKeyholeOpen, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Send, ShieldCheck, Users, Video, VideoOff, Volume2, X } from "lucide-react";
import { api, wsUrl } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import type { Meeting, Participant } from "@/lib/types";

type Signal = { type: "offer" | "answer" | "candidate"; sdp?: string; candidate?: RTCIceCandidateInit };
type RoomMessage = { id: number; sender: string; senderId: string; recipientId: string | null; recipientName: string | null; body: string; sentAt: string };
const colors = ["#2954d1", "#1d7868", "#9b4b1e", "#7849a7", "#a02c6b"];
const initials = (name: string) => name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
const participantKey = (participant: Participant) => participant.id === 0 ? "host" : `participant-${participant.id}`;

function StreamVideo({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [stream]);
  return <video ref={ref} className={className} autoPlay muted={muted} playsInline />;
}

export function MeetingRoom({ meeting: initialMeeting, attendeeName, participantId, isHost, startsWaiting }: { meeting: Meeting; attendeeName: string; participantId: number; isHost: boolean; startsWaiting: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const clientId = isHost ? "host" : `participant-${participantId}`;
  const [meeting, setMeeting] = useState(initialMeeting);
  const hostDisplayName = isHost
    ? (user?.name ?? attendeeName)
    : (meeting.host_name || initialMeeting.host_name || "Host");
  const host: Participant = { id: 0, display_name: hostDisplayName, role: "host", is_muted: false, is_video_on: true, status: "active", is_hand_raised: false, joined_at: new Date().toISOString() };
  const [active, setActive] = useState<Participant[]>([]);
  const [waiting, setWaiting] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [panel, setPanel] = useState<"participants" | "chat" | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shareStream, setShareStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const screenStreamIds = useRef(new Map<string, string>());
  const shareStreamRef = useRef<MediaStream | null>(null);
  const sharedByRef = useRef<string | null>(null);
  const remoteTracks = useRef(new Map<string, { track: MediaStreamTrack; streamId: string; hasAudio: boolean }[]>());
  const ingestRemoteTrackRef = useRef<(peerId: string, track: MediaStreamTrack, incomingStream?: MediaStream) => void>(() => undefined);
  const publishRemoteMediaRef = useRef<(peerId: string) => void>(() => undefined);
  const [remoteMediaStates, setRemoteMediaStates] = useState<Record<string, { is_muted: boolean; is_video_on: boolean }>>({});
  const [sharedBy, setSharedBy] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatRecipient, setChatRecipient] = useState("everyone");
  const [inputLevel, setInputLevel] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const streamRef = useRef<MediaStream | null>(null);
  const announced = useRef(false);
  const currentParticipant = active.find((person) => person.id === participantId);
  const isWaiting = !isHost && (startsWaiting || currentParticipant?.status === "waiting") && !currentParticipant;
  const send = (payload: object) => socket.current?.readyState === WebSocket.OPEN && socket.current.send(JSON.stringify(payload));

  async function refresh() {
    try {
      const [meetingData, activePeople, waitingPeople] = await Promise.all([
        api.meeting(initialMeeting.meeting_id),
        api.participants(initialMeeting.meeting_id),
        api.participants(initialMeeting.meeting_id, "waiting"),
      ]);
      if (meetingData.status === "ended") {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        shareStream?.getTracks().forEach((track) => track.stop());
        router.push("/?ended=1");
        return;
      }
      setMeeting(meetingData);
      setActive(activePeople);
      setWaiting(waitingPeople);

      if (!isHost && participantId > 0 && !startsWaiting) {
        const me = activePeople.find((person) => person.id === participantId);
        if (!me) {
          const isStillWaiting = waitingPeople.some((person) => person.id === participantId);
          if (!isStillWaiting) {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            shareStream?.getTracks().forEach((track) => track.stop());
            router.push("/?removed=1");
          }
        }
      }
    } catch {
      // Ignore transient errors
    }
  }

  function formatMessage(message: { id: number; sender: string; sender_id: string; recipient_id: string | null; recipient_name: string | null; body: string; created_at: string }): RoomMessage {
    return { id: message.id, sender: message.sender, senderId: message.sender_id, recipientId: message.recipient_id, recipientName: message.recipient_name, body: message.body, sentAt: new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
  }

  function appendMessage(message: { id: number; sender: string; sender_id: string; recipient_id: string | null; recipient_name: string | null; body: string; created_at: string }) {
    const next = formatMessage(message);
    setMessages((items) => items.some((item) => item.id === next.id) ? items : [...items, next]);
  }

  function refreshMessages() {
    return api.messages(initialMeeting.meeting_id, clientId).then((items) => setMessages(items.map(formatMessage)));
  }

  function screenTrack() {
    return shareStreamRef.current?.getVideoTracks()[0] ?? null;
  }

  function isScreenSender(sender: RTCRtpSender) {
    const currentScreen = screenTrack();
    return Boolean(currentScreen && sender.track === currentScreen);
  }

  function attachLocalTracks(peer: RTCPeerConnection) {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => {
      const senders = peer.getSenders();
      const existingSender = senders.find((item) => {
        if (isScreenSender(item)) return false;
        return item.track === track || item.track?.kind === track.kind || (!item.track && track.kind === "video");
      });
      if (!existingSender) {
        peer.addTrack(track, streamRef.current!);
      } else if (existingSender.track !== track) {
        void existingSender.replaceTrack(track);
      }
    });
  }

  function attachScreenShare(peer: RTCPeerConnection) {
    const display = shareStreamRef.current;
    const displayTrack = display?.getVideoTracks()[0];
    if (!display || !displayTrack || displayTrack.readyState === "ended") return false;
    if (peer.getSenders().some((sender) => sender.track === displayTrack)) return false;
    peer.addTrack(displayTrack, display);
    return true;
  }

  function removeScreenShare(peer: RTCPeerConnection, displayTrack?: MediaStreamTrack | null) {
    const track = displayTrack ?? screenTrack();
    peer.getSenders().forEach((sender) => {
      if (sender.track && sender.track === track) {
        try { peer.removeTrack(sender); } catch { /* already removed */ }
      }
    });
  }

  function publishRemoteMedia(peerId: string) {
    const list = remoteTracks.current.get(peerId) ?? [];
    const live = list.filter((item) => item.track.readyState !== "ended");
    remoteTracks.current.set(peerId, live);

    if (!live.length) {
      setRemoteScreenStreams((items) => {
        if (!items[peerId]) return items;
        const next = { ...items };
        delete next[peerId];
        return next;
      });
      return;
    }

    const screenId = screenStreamIds.current.get(peerId);
    const sharing = sharedByRef.current === peerId;
    const videoItems = live.filter((item) => item.track.kind === "video");
    const audioItems = live.filter((item) => item.track.kind === "audio");
    const cameraStreamId = audioItems[0]?.streamId
      ?? videoItems.find((item) => item.hasAudio)?.streamId
      ?? videoItems.find((item) => !screenId || item.streamId !== screenId)?.streamId;

    let screenItem = videoItems.find((item) => Boolean(screenId && item.streamId === screenId));
    if (!screenItem && sharing) {
      screenItem = videoItems.find((item) => item.streamId !== cameraStreamId);
    }

    const cameraTracks = [
      ...audioItems.map((item) => item.track),
      ...videoItems.filter((item) => item !== screenItem).map((item) => item.track),
    ].filter((track, index, tracks) => tracks.findIndex((item) => item.id === track.id) === index);

    setRemoteStreams((items) => ({ ...items, [peerId]: new MediaStream(cameraTracks) }));
    setRemoteScreenStreams((items) => {
      const next = { ...items };
      if (screenItem) next[peerId] = new MediaStream([screenItem.track]);
      else delete next[peerId];
      return next;
    });
  }

  function ingestRemoteTrack(peerId: string, track: MediaStreamTrack, incomingStream?: MediaStream) {
    const streamId = incomingStream?.id ?? `track-${track.id}`;
    const hasAudio = Boolean(incomingStream?.getAudioTracks().length);
    const list = remoteTracks.current.get(peerId) ?? [];
    if (!list.some((item) => item.track.id === track.id)) {
      list.push({ track, streamId, hasAudio });
      remoteTracks.current.set(peerId, list);
      track.addEventListener("ended", () => publishRemoteMediaRef.current(peerId));
    }
    publishRemoteMedia(peerId);
  }

  ingestRemoteTrackRef.current = ingestRemoteTrack;
  publishRemoteMediaRef.current = publishRemoteMedia;

  function getPeer(peerId: string) {
    const existing = peers.current.get(peerId);
    if (existing) return existing;
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) send({ type: "signal", target_id: peerId, signal: { type: "candidate", candidate: event.candidate.toJSON() } });
    };

    peer.ontrack = (event) => {
      ingestRemoteTrackRef.current(peerId, event.track, event.streams[0]);
    };

    peer.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(peer.connectionState)) {
        peers.current.delete(peerId);
        setRemoteStreams((items) => {
          const next = { ...items };
          delete next[peerId];
          return next;
        });
        setRemoteScreenStreams((items) => {
          const next = { ...items };
          delete next[peerId];
          return next;
        });
        remoteTracks.current.delete(peerId);
        screenStreamIds.current.delete(peerId);
      }
    };

    peers.current.set(peerId, peer);
    attachLocalTracks(peer);
    attachScreenShare(peer);
    return peer;
  }

  async function offerPeer(peerId: string, attempt = 0) {
    if (peerId === clientId || isWaiting) return;
    const peer = getPeer(peerId);
    if (peer.signalingState !== "stable") {
      if (attempt < 8) window.setTimeout(() => { void offerPeer(peerId, attempt + 1); }, 250);
      return;
    }
    const offer = await peer.createOffer();
    if (peer.signalingState !== "stable") {
      if (attempt < 8) window.setTimeout(() => { void offerPeer(peerId, attempt + 1); }, 250);
      return;
    }
    await peer.setLocalDescription(offer);
    send({ type: "signal", target_id: peerId, signal: { type: "offer", sdp: offer.sdp } });
  }

  async function handleSignal(peerId: string, signal: Signal) {
    const peer = getPeer(peerId);
    if (signal.type === "candidate" && signal.candidate) {
      await peer.addIceCandidate(signal.candidate).catch(() => undefined);
      return;
    }
    if (signal.type === "offer" && signal.sdp) {
      await peer.setRemoteDescription({ type: "offer", sdp: signal.sdp });
      attachLocalTracks(peer);
      attachScreenShare(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      send({ type: "signal", target_id: peerId, signal: { type: "answer", sdp: answer.sdp } });
    }
    if (signal.type === "answer" && signal.sdp) {
      await peer.setRemoteDescription({ type: "answer", sdp: signal.sdp });
    }
  }

  useEffect(() => {
    streamRef.current = stream;
    peers.current.forEach((peer, peerId) => {
      attachLocalTracks(peer);
      offerPeer(peerId).catch(() => undefined);
    });
  }, [stream]);

  useEffect(() => {
    refresh().catch(() => undefined);
    const ws = new WebSocket(`${wsUrl()}/api/ws/meetings/${initialMeeting.meeting_id}?client_id=${encodeURIComponent(clientId)}`);
    socket.current = ws;
    ws.onopen = () => { if (!isWaiting) { announced.current = true; send({ type: "ready" }); } };
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "chat" && payload.message) appendMessage(payload.message);
      else if (payload.type === "peer_joined") offerPeer(payload.client_id).catch(() => undefined);
      else if (payload.type === "peer_left") {
        peers.current.get(payload.client_id)?.close();
        peers.current.delete(payload.client_id);
        remoteTracks.current.delete(payload.client_id);
        screenStreamIds.current.delete(payload.client_id);
        setRemoteStreams((items) => { const next = { ...items }; delete next[payload.client_id]; return next; });
        setRemoteScreenStreams((items) => { const next = { ...items }; delete next[payload.client_id]; return next; });
      }
      else if (payload.type === "signal") handleSignal(payload.sender_id, payload.signal).catch(() => undefined);
      else if (payload.type === "screen_share") {
        if (payload.sharing) {
          sharedByRef.current = payload.client_id;
          setSharedBy(payload.client_id);
          if (payload.stream_id) {
            screenStreamIds.current.set(payload.client_id, payload.stream_id);
          }
          publishRemoteMediaRef.current(payload.client_id);
        } else {
          sharedByRef.current = null;
          setSharedBy(null);
          screenStreamIds.current.delete(payload.client_id);
          publishRemoteMediaRef.current(payload.client_id);
        }
      } else if (payload.type === "media_state") {
        setRemoteMediaStates((prev) => ({
          ...prev,
          [payload.client_id]: { is_muted: payload.is_muted, is_video_on: payload.is_video_on },
        }));
      } else if (payload.type === "meeting_ended") {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        shareStream?.getTracks().forEach((track) => track.stop());
        router.push("/?ended=1");
      } else if (payload.type === "participant_removed") {
        if (payload.participant_id === participantId) {
          streamRef.current?.getTracks().forEach((track) => track.stop());
          shareStream?.getTracks().forEach((track) => track.stop());
          router.push("/?removed=1");
        } else {
          refresh().catch(() => undefined);
        }
      } else refresh().catch(() => undefined);
    };
    return () => { ws.close(); peers.current.forEach((peer) => peer.close()); peers.current.clear(); streamRef.current?.getTracks().forEach((track) => track.stop()); shareStream?.getTracks().forEach((track) => track.stop()); };
  }, []);

  // Auto-acquire local media (mic & camera) when entering meeting room
  useEffect(() => {
    if (isWaiting) return;
    let mounted = true;
    async function initMedia() {
      try {
        const incoming = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (!mounted) { incoming.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = incoming;
        setStream(incoming);
        setMuted(false);
        setVideoOn(true);
        send({ type: "media_state", is_muted: false, is_video_on: true });
      } catch {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!mounted) { audioOnly.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = audioOnly;
          setStream(audioOnly);
          setMuted(false);
          setVideoOn(false);
          send({ type: "media_state", is_muted: false, is_video_on: false });
        } catch {
          // Keep stream null if no permissions or media devices
        }
      }
    }
    void initMedia();
    return () => { mounted = false; };
  }, [isWaiting]);

  // WebSockets deliver room changes immediately. Polling keeps host controls,
  // waiting rooms, and persisted chat accurate if a mobile browser drops a notification.
  useEffect(() => {
    refreshMessages().catch(() => undefined);
    const interval = window.setInterval(() => { refresh().catch(() => undefined); refreshMessages().catch(() => undefined); }, 2000);
    return () => window.clearInterval(interval);
  }, [initialMeeting.meeting_id]);

  useEffect(() => { if (!isWaiting && socket.current?.readyState === WebSocket.OPEN && !announced.current) { announced.current = true; send({ type: "ready" }); } }, [isWaiting]);
  useEffect(() => { const track = stream?.getAudioTracks()[0]; if (!track || muted) { setInputLevel(0); return; } const context = new AudioContext(); const analyser = context.createAnalyser(); analyser.fftSize = 256; context.createMediaStreamSource(new MediaStream([track])).connect(analyser); const samples = new Uint8Array(analyser.frequencyBinCount); let frame = 0; const measure = () => { analyser.getByteTimeDomainData(samples); const average = samples.reduce((total, sample) => total + Math.abs(sample - 128), 0) / samples.length; setInputLevel(Math.min(1, average / 32)); frame = requestAnimationFrame(measure); }; measure(); return () => { cancelAnimationFrame(frame); context.close(); }; }, [stream, muted]);

  function mediaMessage(error: unknown, device: string) { const name = error instanceof DOMException ? error.name : "Unknown error"; if (error instanceof DOMException && error.name === "NotFoundError") return `No ${device} device was found (${name}).`; if (error instanceof DOMException && error.name === "NotReadableError") return `Your ${device} is busy in another app or browser tab (${name}).`; if (error instanceof DOMException && error.name === "NotAllowedError") return `${device[0].toUpperCase()}${device.slice(1)} access is blocked. Check this browser site permission and macOS Privacy & Security (${name}).`; return `Could not start your ${device} (${name}).`; }
  async function requestTracks(constraints: MediaStreamConstraints, device: string) { if (!window.isSecureContext) { setMediaError(`${device[0].toUpperCase()}${device.slice(1)} access requires HTTPS when this meeting is opened through a Wi-Fi IP address. Use localhost on this Mac, or the deployed HTTPS URL on a phone.`); return false; } if (!navigator.mediaDevices?.getUserMedia) { setMediaError("This browser does not expose microphone or camera access."); return false; } try { setMediaError(""); const incoming = await navigator.mediaDevices.getUserMedia(constraints); const next = streamRef.current ?? new MediaStream(); incoming.getTracks().forEach((track) => { next.getTracks().filter((existing) => existing.kind === track.kind).forEach((existing) => { next.removeTrack(existing); existing.stop(); }); next.addTrack(track); }); streamRef.current = next; setStream(next); peers.current.forEach((_, peerId) => offerPeer(peerId).catch(() => undefined)); return true; } catch (error) { setMediaError(mediaMessage(error, device)); return false; } }
  function enableRemoteAudio() { document.querySelectorAll<HTMLVideoElement>("video.camera-video, video.shared-video").forEach((video) => { if (!video.muted) void video.play().catch(() => undefined); }); }
  async function toggleMute() { enableRemoteAudio(); if (!stream?.getAudioTracks().length) { const started = await requestTracks({ audio: true }, "microphone"); if (!started) return; setMuted(false); send({ type: "media_state", is_muted: false, is_video_on: videoOn }); if (participantId > 0) await api.updateMedia(meeting.meeting_id, participantId, { is_muted: false }).catch(() => undefined); return; } const nextMuted = !muted; stream.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; }); setMuted(nextMuted); send({ type: "media_state", is_muted: nextMuted, is_video_on: videoOn }); if (participantId > 0) await api.updateMedia(meeting.meeting_id, participantId, { is_muted: nextMuted }).catch(() => undefined); }
  async function toggleVideo() { enableRemoteAudio(); if (!stream?.getVideoTracks().length) { const started = await requestTracks({ video: true }, "camera"); if (!started) return; setVideoOn(true); send({ type: "media_state", is_muted: muted, is_video_on: true }); if (participantId > 0) await api.updateMedia(meeting.meeting_id, participantId, { is_video_on: true }).catch(() => undefined); return; } const nextVideoOn = !videoOn; stream.getVideoTracks().forEach((track) => { track.enabled = nextVideoOn; }); setVideoOn(nextVideoOn); send({ type: "media_state", is_muted: muted, is_video_on: nextVideoOn }); if (participantId > 0) await api.updateMedia(meeting.meeting_id, participantId, { is_video_on: nextVideoOn }).catch(() => undefined); }
  async function toggleShare() {
    enableRemoteAudio();
    if (shareStream) {
      const displayTrack = shareStream.getVideoTracks()[0];
      shareStream.getTracks().forEach((track) => track.stop());
      peers.current.forEach((peer, peerId) => {
        removeScreenShare(peer, displayTrack);
        void offerPeer(peerId);
      });
      shareStreamRef.current = null;
      sharedByRef.current = null;
      setShareStream(null);
      setSharedBy(null);
      send({ type: "screen_share", sharing: false });
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const displayTrack = display.getVideoTracks()[0];
      if (displayTrack) {
        displayTrack.contentHint = "detail";
      }
      shareStreamRef.current = display;
      sharedByRef.current = clientId;
      peers.current.forEach((peer, peerId) => {
        attachScreenShare(peer);
        void offerPeer(peerId);
      });
      setShareStream(display);
      setSharedBy(clientId);
      send({ type: "screen_share", sharing: true, stream_id: display.id, sender_name: isHost ? (user?.name ?? attendeeName) : attendeeName });
      displayTrack?.addEventListener("ended", () => {
        peers.current.forEach((peer, peerId) => {
          removeScreenShare(peer, displayTrack);
          void offerPeer(peerId);
        });
        shareStreamRef.current = null;
        sharedByRef.current = null;
        setShareStream(null);
        setSharedBy(null);
        send({ type: "screen_share", sharing: false });
      });
    } catch {
      setMediaError("Screen sharing was cancelled or unavailable.");
    }
  }
  function testSpeaker() { try { enableRemoteAudio(); const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 660; gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.24); window.setTimeout(() => context.close(), 320); } catch { setMediaError("Could not play the speaker test. Check your system output device."); } }
  async function copyInvite() {
    const inviteLink = `${window.location.origin}${meeting.invite_url}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(inviteLink);
      else {
        const field = document.createElement("textarea");
        field.value = inviteLink;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copiedWithFallback = document.execCommand("copy");
        document.body.removeChild(field);
        if (!copiedWithFallback) throw new Error("Copy command was rejected");
      }
      setShowInviteLink(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setShowInviteLink(true);
    }
  }
  async function leave() {
    if (isHost) {
      await api.endMeeting(meeting.meeting_id).catch(() => undefined);
    } else if (participantId) {
      await api.leave(meeting.meeting_id, participantId).catch(() => undefined);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    shareStream?.getTracks().forEach((track) => track.stop());
    router.push(isHost ? "/?ended=1" : "/?left=1");
  }
  async function sendChat(event: React.FormEvent) { event.preventDefault(); const body = draft.trim(); if (!body) return; const recipient = chatRecipient === "everyone" ? null : tiles.find((person) => participantKey(person) === chatRecipient) ?? null; const senderName = isHost ? (user?.name ?? attendeeName) : attendeeName; try { appendMessage(await api.sendMessage(meeting.meeting_id, { sender: senderName, sender_id: clientId, recipient_id: recipient ? participantKey(recipient) : null, recipient_name: recipient?.display_name ?? null, body })); setDraft(""); } catch { setMediaError("Your chat message could not be sent. Please try again."); } }
  const tiles = [host, ...active];
  const hasAudio = Boolean(stream?.getAudioTracks().length);
  const audioLabel = hasAudio ? (muted ? "Unmute" : "Mute") : "Join Audio";

  if (isWaiting) return <div className="waiting-screen"><div className="waiting-card"><span className="waiting-shield"><ShieldCheck size={28} /></span><p className="eyebrow">Waiting room</p><h1>You&apos;re in the waiting room</h1><p>The host will let you in soon. Keep this page open while you wait.</p><div className="waiting-person"><span className="mini-avatar">{initials(attendeeName)}</span>{attendeeName}</div><button className="subtle-leave" onClick={leave}>Leave waiting room</button></div></div>;

  return (
    <div className="room">
      <header className="room-header">
        <div>
          <strong>{meeting.title}</strong>
          <span>
            ID: {meeting.meeting_id} {meeting.is_locked && <b className="locked-label"><Lock size={11} /> Locked</b>}
          </span>
        </div>
        <div className="invite-actions">
          <button className="room-invite" onClick={copyInvite} title="Copy invite link">
            <Copy size={15} />
            {copied ? "Copied" : "Copy invite"}
          </button>
          {showInviteLink && (
            <input
              className="invite-link-field"
              value={`${window.location.origin}${meeting.invite_url}`}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Meeting invite link"
            />
          )}
        </div>
      </header>

      <section className="video-area">
        <div className="stage-wrap">
          {shareStream ? (
            <div className="screen-stage">
              <StreamVideo key={`local-share-${shareStream.id}`} stream={shareStream} muted className="shared-video" />
              <span>Sharing your screen</span>
            </div>
          ) : (sharedBy && sharedBy !== clientId && remoteScreenStreams[sharedBy]) ? (
            <div className="screen-stage">
              <StreamVideo key={`remote-share-${remoteScreenStreams[sharedBy].id}`} stream={remoteScreenStreams[sharedBy]} muted={false} className="shared-video" />
              <span>{tiles.find((p) => participantKey(p) === sharedBy)?.display_name ?? "Someone"}&apos;s screen</span>
            </div>
          ) : null}
          <div className={`tile-grid ${shareStream || (sharedBy && sharedBy !== clientId && remoteScreenStreams[sharedBy]) ? "with-share" : ""}`}>
            {tiles.map((participant, index) => {
              const key = participantKey(participant);
              const self = key === clientId;
              const videoStream = self ? stream : remoteStreams[key] ?? null;
              const mediaState = self
                ? { is_muted: muted, is_video_on: videoOn }
                : (remoteMediaStates[key] ?? { is_muted: participant.is_muted, is_video_on: participant.is_video_on });
              return (
                <div key={`tile-${key}-${index}`} className={`video-tile ${index === 0 ? "active-speaker" : ""}`}>
                  {videoStream && (self ? videoOn : mediaState.is_video_on) ? (
                    <StreamVideo key={`camera-${key}-${videoStream.id}`} stream={videoStream} muted={self} className="camera-video" />
                  ) : (
                    <div className="tile-avatar" style={{ background: colors[index % colors.length] }}>
                      {initials(participant.display_name)}
                    </div>
                  )}
                  <div className="tile-footer">
                    <span>
                      {participant.display_name}
                      {participant.role === "host" && <em>Host</em>}
                      {participant.is_hand_raised && <Hand className="hand-indicator" size={15} />}
                    </span>
                    {mediaState.is_muted ? <MicOff size={16} /> : <Mic size={16} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Backdrop for Side Panels */}
        {panel && <div className="panel-backdrop" onClick={() => setPanel(null)} aria-hidden="true" />}

        {panel === "participants" && (
          <aside className="room-panel participants-panel">
            <div className="panel-header">
              <div>
                <strong>Participants</strong>
                <span>{tiles.length} in meeting</span>
              </div>
              <button onClick={() => setPanel(null)} aria-label="Close participants">
                <X size={20} />
              </button>
            </div>
            {isHost && (
              <div className="host-toolbar">
                <button onClick={() => api.muteAll(meeting.meeting_id)}>Mute all</button>
                <button onClick={async () => setMeeting(await api.lock(meeting.meeting_id))}>
                  {meeting.is_locked ? <LockKeyholeOpen size={14} /> : <Lock size={14} />}
                  {meeting.is_locked ? "Unlock" : "Lock"}
                </button>
              </div>
            )}
            {isHost && waiting.length > 0 && (
              <section className="waiting-list">
                <div className="waiting-list-title">
                  <span>Waiting room ({waiting.length})</span>
                  <button onClick={() => api.admitAll(meeting.meeting_id)}>Admit all</button>
                </div>
                {waiting.map((person, index) => (
                  <div className="participant-row" key={`waiting-${person.id}-${index}`}>
                    <span className="mini-avatar">{initials(person.display_name)}</span>
                    <span className="participant-name">{person.display_name}</span>
                    <button className="admit-button" onClick={() => api.admit(meeting.meeting_id, person.id)}>
                      Admit
                    </button>
                    <button className="remove-button" title="Remove" onClick={() => api.remove(meeting.meeting_id, person.id)}>
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </section>
            )}
            <div className="participant-list">
              {tiles.map((person, index) => (
                <div className="participant-row" key={`participant-${participantKey(person)}-${index}`}>
                  <span className="mini-avatar">{initials(person.display_name)}</span>
                  <span className="participant-name">
                    {person.display_name}
                    {person.role === "host" && <small>Host</small>}
                  </span>
                  {person.is_hand_raised && <Hand size={15} />}
                  {person.id > 0 && isHost && (
                    <div className="host-actions">
                      <button onClick={() => api.mute(meeting.meeting_id, person.id)} title="Mute participant">
                        <Volume2 size={15} />
                      </button>
                      <button onClick={() => api.remove(meeting.meeting_id, person.id)} title="Remove participant">
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {panel === "chat" && (
          <aside className="room-panel chat-panel">
            <div className="panel-header">
              <div>
                <strong>Meeting chat</strong>
                <span>Public and direct messages</span>
              </div>
              <button onClick={() => setPanel(null)} aria-label="Close chat">
                <X size={20} />
              </button>
            </div>
            <div className="chat-list">
              {messages.length ? (
                messages.map((message, index) => (
                  <div className="chat-message" key={`message-${message.id ?? "legacy"}-${index}`}>
                    <div>
                      <strong>{message.sender}</strong>
                      <time>{message.sentAt}</time>
                    </div>
                    {message.recipientName && (
                      <small className="private-message">
                        Private {message.senderId === clientId ? `to ${message.recipientName}` : "message"}
                      </small>
                    )}
                    <span>{message.body}</span>
                  </div>
                ))
              ) : (
                <div className="chat-empty">No messages yet.</div>
              )}
            </div>
            <form className="chat-compose" onSubmit={sendChat}>
              <label className="chat-recipient">
                To:{" "}
                <select value={chatRecipient} onChange={(event) => setChatRecipient(event.target.value)} aria-label="Chat recipient">
                  <option value="everyone">Everyone</option>
                  {tiles
                    .filter((person) => participantKey(person) !== clientId)
                    .map((person, index) => (
                      <option key={`recipient-${participantKey(person)}-${index}`} value={participantKey(person)}>
                        {person.display_name} (Direct)
                      </option>
                    ))}
                </select>
              </label>
              <div>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={chatRecipient === "everyone" ? "Message everyone" : "Send a private message"}
                  maxLength={500}
                />
                <button aria-label="Send message">
                  <Send size={17} />
                </button>
              </div>
            </form>
          </aside>
        )}
      </section>

      {mediaError && (
        <div className="media-notice">
          {mediaError}
          <button onClick={() => setMediaError("")}>
            <X size={15} />
          </button>
        </div>
      )}

      <footer className="controlbar">
        <div className="control-group">
          <button className="control" aria-label={`${audioLabel} microphone`} onClick={toggleMute}>
            {hasAudio && muted ? <MicOff size={20} /> : <Mic size={20} />}
            <span>{audioLabel}</span>
          </button>
          <span className="audio-meter" aria-label={!hasAudio ? "Microphone not connected" : muted ? "Microphone muted" : "Microphone input level"}>
            <i style={{ transform: `scaleY(${0.2 + inputLevel * 0.8})` }} />
            <i style={{ transform: `scaleY(${0.16 + inputLevel * 0.66})` }} />
            <i style={{ transform: `scaleY(${0.12 + inputLevel * 0.5})` }} />
          </span>
          <button className="control-arrow" aria-label="Microphone options">
            <ChevronDown size={15} />
          </button>
          <button className="control" aria-label="Test speaker" onClick={testSpeaker}>
            <Volume2 size={20} />
            <span>Speaker</span>
          </button>
          <button className="control" aria-label={videoOn ? "Stop video" : "Start video"} onClick={toggleVideo}>
            {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
            <span>{videoOn ? "Stop Video" : "Start Video"}</span>
          </button>
        </div>

        <div className="control-group centered">
          <button className={`control ${panel === "participants" ? "selected" : ""}`} aria-label="Participants" onClick={() => setPanel(panel === "participants" ? null : "participants")}>
            <div className="control-icon-wrap">
              <Users size={20} />
              <span className="badge-count">{tiles.length}</span>
            </div>
            <span>Participants</span>
          </button>
          <button className={`control ${shareStream ? "selected" : ""}`} aria-label="Share screen" onClick={toggleShare}>
            <MonitorUp size={20} />
            <span>{shareStream ? "Stop Share" : "Share"}</span>
          </button>
          <button className={`control ${panel === "chat" ? "selected" : ""}`} aria-label="Open chat" onClick={() => setPanel(panel === "chat" ? null : "chat")}>
            <div className="control-icon-wrap">
              <MessageSquare size={20} />
              {messages.length > 0 && <span className="badge-count">{messages.length}</span>}
            </div>
            <span>Chat</span>
          </button>
          {!isHost && participantId > 0 && (
            <button
              className="control"
              aria-label={currentParticipant?.is_hand_raised ? "Lower hand" : "Raise hand"}
              onClick={async () => {
                await api.raiseHand(meeting.meeting_id, participantId);
                refresh();
              }}
            >
              <Hand size={20} />
              <span>{currentParticipant?.is_hand_raised ? "Lower" : "Raise"}</span>
            </button>
          )}
        </div>

        <button className={`leave-button ${isHost ? "end-button" : ""}`} onClick={leave}>
          <span>{isHost ? "End Meeting" : "Leave"}</span>
          <PhoneOff size={16} />
        </button>
      </footer>
    </div>
  );
}

