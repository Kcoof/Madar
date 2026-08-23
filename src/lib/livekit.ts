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
    const { RoomServiceClient, IngressAPI } = await import("livekit-server-sdk");
    const client = new RoomServiceClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_SECRET!
    );
    await client.createRoom({ name: roomName });

    const ingress = await client.createIngress({
      name: `ingress-${roomName}`,
      roomName,
      inputType: IngressAPI.IngressInput.RTMP_INPUT,
    });
    // LiveKit returns the combined rtmp ingest URL + key
    return {
      roomName,
      rtmpUrl: ingress.url ?? "",
      streamKey: ingress.streamKey ?? streamKey,
    };
  }

  return {
    roomName,
    rtmpUrl: "rtmp://livekit-not-configured/madar",
    streamKey,
  };
}

// Mints a join token. canPublish is decided SERVER-SIDE: students join in
// view-only mode unless the teacher granted them the mic via grant-mic.
export function mintJoinToken(
  identity: string,
  roomName: string,
  canPublish: boolean
): string {
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

// Pushes a participant permission update to the live room (cloud mode).
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
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_SECRET!
  );
  await client.updateParticipant(roomName, identity, undefined, {
    canPublish,
    canSubscribe: true,
  });
}
