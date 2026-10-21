import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import type { Room } from "livekit-client";
import { getCallToken } from "@/lib/call.functions";

// In-app voice call for one order. `ring` = this side is starting the call (notifies the other side).
export function VoiceCall({ orderId, ring, otherName, onEnd }: { orderId: string; ring: boolean; otherName: string; onEnd: () => void }) {
  const getToken = useServerFn(getCallToken);
  const room = useRef<Room | null>(null);
  const audioBox = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"connecting" | "ringing" | "live">("connecting");
  const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { url, token } = await getToken({ data: { orderId, ring } });
        const { Room, RoomEvent, Track } = await import("livekit-client");
        if (dead) return;
        const r = new Room({ adaptiveStream: true });
        room.current = r;
        const sync = () => setState(r.remoteParticipants.size > 0 ? "live" : "ringing");
        r.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) audioBox.current?.appendChild(track.attach());
        });
        r.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
        r.on(RoomEvent.ParticipantConnected, sync);
        r.on(RoomEvent.ParticipantDisconnected, () => { if (r.remoteParticipants.size === 0) { toast("Call ended"); onEnd(); } });
        r.on(RoomEvent.Disconnected, () => { if (!dead) onEnd(); });
        await r.connect(url, token);
        await r.localParticipant.setMicrophoneEnabled(true);
        if (dead) { r.disconnect(); return; }
        sync();
      } catch (e) {
        if (!dead) { toast.error(e instanceof Error && e.name === "NotAllowedError" ? "Allow microphone access to call" : e instanceof Error ? e.message : "Call failed"); onEnd(); }
      }
    })();
    return () => { dead = true; room.current?.disconnect(); room.current = null; };
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state !== "live") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const toggleMute = async () => { await room.current?.localParticipant.setMicrophoneEnabled(muted); setMuted(!muted); };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] border-t bg-card p-4 shadow-card">
      <div ref={audioBox} className="hidden" />
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{otherName}</p>
          <p className="text-sm text-muted-foreground">
            {state === "connecting" ? "Connecting…" : state === "ringing" ? (ring ? "Ringing…" : "Waiting…") : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}
          </p>
        </div>
        <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button onClick={onEnd} aria-label="End call" className="grid h-12 w-12 place-items-center rounded-full bg-destructive text-primary-foreground">
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// True when the other side started a call in the last 45 seconds.
export const isRinging = (callAt: string | null | undefined, callFrom: string | null | undefined, me: "customer" | "rider") =>
  !!callAt && callFrom !== me && Date.now() - new Date(callAt).getTime() < 45000;
