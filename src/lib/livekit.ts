import { randomBytes } from "crypto";
import { AccessToken } from "livekit-server-sdk";

// LiveKit integration. When LIVEKIT_* env vars are configured the real
// RoomService/Ingress APIs are used; otherwise placeholder values are
// generated locally so the whole flow works in development. Join tokens are
// ALWAYS real (minting an AccessToken is offline — it only needs the keys).

export const livekitConfigured = Boolean(
  process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_SECRET
);

export function livekitWsUrl(): string | null {
  return process.env.LIVEKIT_URL ?? null;
}

// Service clients talk HTTP (Twirp); the env var holds the ws:// URL the
// browser client uses — convert the scheme.
function httpApiUrl(): string {
  return process.env.LIVEKIT_URL!.replace(/^ws/, "http");
}

// Provisions a room + RTMP ingress for a scheduled class. In local mode the
// rtmpUrl/streamKey are placeholders the teacher copies into OBS later.
export async function provisionLiveClass(): Promise<{
  roomName: string;
  rtmpUrl: string;
  streamKey: string;
}> {
  const roomName = `madar-class-${randomBytes(6).toString("hex")}`;
  const streamKey = randomBytes(16).toString("hex");

  if (livekitConfigured) {
    const { RoomServiceClient, IngressClient, IngressInput } = await import("livekit-server-sdk");
    const url = httpApiUrl();
    const keys = {
      apiKey: process.env.LIVEKIT_API_KEY!,
      secret: process.env.LIVEKIT_SECRET!,
    } as const;

    const roomClient = new RoomServiceClient(url, keys.apiKey, keys.secret);
    await roomClient.createRoom({ name: roomName });

    try {
      const ingressClient = new IngressClient(url, keys.apiKey, keys.secret);
      const ingress = await ingressClient.createIngress(IngressInput.RTMP_INPUT, {
        name: `ingress-${roomName}`,
        roomName,
        participantIdentity: "teacher-stream",
        participantName: "بث المعلم",
        enableTranscoding: true,
      });
      return {
        roomName,
        rtmpUrl: ingress.url ?? "",
        streamKey: ingress.streamKey ?? streamKey,
      };
    } catch (err) {
      // RTMP ingress needs the livekit-ingress service + Redis (available on
      // LiveKit Cloud, not the single local dev server). Fall back to
      // placeholders — WHIP ingest still works for camera streaming.
      console.warn("[livekit] RTMP ingress unavailable, using WHIP-only mode:", err);
    }
  }

  return {
    roomName,
    rtmpUrl: "rtmp://livekit-not-configured/madar",
    streamKey,
  };
}

// Mints a join token. canPublish is decided SERVER-SIDE: students join in
// view-only mode unless the teacher granted them the mic via grant-mic.
export async function mintJoinToken(
  identity: string,
  roomName: string,
  canPublish: boolean
): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
  const secret = process.env.LIVEKIT_SECRET || "madar-local-dev-secret";
  const token = new AccessToken(apiKey, secret, { identity, ttl: "2h" });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
  });
  return token.toJwt();
}

// WHIP ingest URL — publish a camera (OBS 30+, Larix Broadcaster on iPhone)
// straight into the room with an access token; works on the local dev server.
export function whipUrl(roomName: string, token: string): string {
  const base = (process.env.LIVEKIT_URL ?? "").replace(/^ws/, "http");
  return `${base}/whip/${roomName}?access_token=${token}`;
}
// Local mode has no server — the micGrants array in the DB is the source of
// truth and the next join token reflects it.
export async function updateParticipantPublish(
  roomName: string,
  identity: string,
  canPublish: boolean
): Promise<void> {
  if (!livekitConfigured) return;
  const { RoomServiceClient } = await import("livekit-server-sdk");
  const client = new RoomServiceClient(
    httpApiUrl(),
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_SECRET!
  );
  await client.updateParticipant(roomName, identity, undefined, {
    canPublish,
    canSubscribe: true,
  });
}
