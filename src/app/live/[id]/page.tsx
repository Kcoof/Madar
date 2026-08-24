"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Room, RoomEvent, Track, type RemoteParticipant } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/shared/app-header";
import { apiFetch } from "@/lib/api-client";

type JoinInfo = {
  token: string;
  url: string | null;
  roomName: string | null;
  canPublish: boolean;
};

// Live room screen — connects to LiveKit with the server-issued token.
// Remote participants (including the teacher's RTMP/OBS stream) render as
// video tiles; users with canPublish can enable their microphone.
export default function LiveRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [remotes, setRemotes] = useState<RemoteParticipant[]>([]);
  const [tick, setTick] = useState(0); // forces tile re-attach when tracks change

  const leave = useCallback(() => {
    roomRef.current?.disconnect();
    router.push("/student");
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const join = await apiFetch<JoinInfo>(`/api/live-classes/${id}/join`, { method: "POST" });
        if (cancelled) return;
        if (!join.url) {
          throw new Error("خادم البث غير مهيأ");
        }
        setCanPublish(join.canPublish);

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const refresh = () => {
          if (cancelled) return;
          setRemotes([...room.remoteParticipants.values()]);
          setTick((t) => t + 1);
        };
        room
          .on(RoomEvent.ParticipantConnected, refresh)
          .on(RoomEvent.ParticipantDisconnected, refresh)
          .on(RoomEvent.TrackSubscribed, refresh)
          .on(RoomEvent.TrackUnsubscribed, refresh)
          .on(RoomEvent.Disconnected, () => !cancelled && setStatus("error") && setError("انقطع الاتصال بالغرفة"));

        await room.connect(join.url, join.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setStatus("connected");
        refresh();
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "فشل دخول الغرفة");
      }
    })();
    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
    };
  }, [id]);

  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
    } catch {
      setError("تعذر تشغيل المايك — تأكد من إذن المتصفح");
    }
  }

  async function toggleCam() {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamOn(next);
    } catch {
      setError("تعذر تشغيل الكاميرا — تتصل عبر HTTPS فقط على الجوال");
    }
  }

  // Attaches the participant's video track into the tile div.
  function bindTile(el: HTMLDivElement | null, participant: RemoteParticipant) {
    if (!el) return;
    el.innerHTML = "";
    const publication =
      participant.getTrackPublication(Track.Source.Camera) ??
      participant.getTrackPublication(Track.Source.ScreenShare);
    if (publication?.videoTrack) {
      const videoEl = publication.videoTrack.attach();
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
      videoEl.style.objectFit = "contain";
      videoEl.muted = true; // avoid echo; audio plays through the AudioContext
      el.appendChild(videoEl);
    }
  }

  return (
    <main className="min-h-screen">
      <AppHeader title="غرفة البث المباشر" />
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        {status === "connecting" && <p className="text-gray-500">جارٍ الاتصال بالغرفة...</p>}

        {status === "error" && (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-700">{error ?? "تعذر الدخول"}</p>
            <Link href="/student">
              <Button variant="outline">العودة</Button>
            </Link>
          </div>
        )}

        {status === "connected" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={canPublish ? "default" : "secondary"}>
                {canPublish ? "لديك إذن التحدث" : "مشاهدة فقط"}
              </Badge>
              <div className="flex gap-2">
                {canPublish && (
                  <>
                    <Button variant={camOn ? "destructive" : "outline"} onClick={toggleCam}>
                      {camOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}
                    </Button>
                    <Button variant={micOn ? "destructive" : "outline"} onClick={toggleMic}>
                      {micOn ? "إيقاف المايك" : "تشغيل المايك"}
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={leave}>
                  مغادرة الغرفة
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {remotes.map((p) => (
                <div key={p.identity} className="overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16/9" }}>
                  <div
                    className="h-full w-full"
                    ref={(el) => bindTile(el, p)}
                    data-tick={tick}
                  />
                  <p className="bg-black/70 px-2 py-1 text-xs text-white" dir="ltr">
                    {p.identity}
                  </p>
                </div>
              ))}
            </div>
            {remotes.length === 0 && (
              <p className="text-center text-gray-500">
                لا يوجد بث في الغرفة بعد — ابدأ البث من OBS / تطبيق البث وستظهر الصورة هنا تلقائياً
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
