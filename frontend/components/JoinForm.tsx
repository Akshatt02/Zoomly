"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Video, VideoOff } from "lucide-react";
import { api } from "@/lib/api";

function PreviewVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay muted playsInline />;
}

export function JoinForm({ initialMeetingId = "" }: { initialMeetingId?: string }) {
  const router = useRouter();
  const [meetingId, setMeetingId] = useState(initialMeetingId);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => setMeetingId(initialMeetingId), [initialMeetingId]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  async function togglePreview() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      return;
    }

    if (!window.isSecureContext) {
      setPreviewError("Camera access requires HTTPS or localhost.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPreviewError("This browser does not support camera access.");
      return;
    }

    try {
      setPreviewError("");
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
    } catch (err) {
      const errName = err instanceof DOMException ? err.name : "";
      if (errName === "NotReadableError") {
        setPreviewError("Your camera is being used by another app or tab.");
      } else if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setPreviewError("Camera access was blocked by your browser.");
      } else {
        setPreviewError("Could not access camera device.");
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setJoining(true);

    try {
      await api.meeting(meetingId.trim());
      const participant = await api.join(meetingId.trim(), displayName);
      stream?.getTracks().forEach((track) => track.stop());
      router.push(
        `/meeting/${meetingId.trim()}?name=${encodeURIComponent(displayName)}&participant=${
          participant.id
        }&waiting=${participant.status === "waiting" ? "1" : "0"}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the meeting.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <form className="form-card join-form" onSubmit={submit}>
      {stream && (
        <div className="prejoin-preview">
          <PreviewVideo stream={stream} />
          <span>Camera & microphone active</span>
        </div>
      )}

      <button type="button" className="preview-toggle" onClick={togglePreview}>
        {stream ? <VideoOff size={17} /> : <Camera size={17} />}
        {stream ? "Turn off preview" : "Test camera & mic preview"}
      </button>

      <label>
        Meeting ID
        <input
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
          placeholder="e.g. 10-digit meeting ID"
          required
        />
      </label>

      <label>
        Your display name
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter your display name"
          required
          minLength={2}
        />
      </label>

      {(error || previewError) && <p className="form-error">{error || previewError}</p>}

      <button className="primary-button form-submit" disabled={joining}>
        {joining ? <LoaderCircle className="spin" size={18} /> : <Video size={18} />}
        {joining ? "Joining Room..." : "Join Meeting"}
      </button>
    </form>
  );
}
