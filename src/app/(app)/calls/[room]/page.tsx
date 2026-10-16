import type { Metadata } from "next";
import Link from "next/link";
import { CallRoom } from "@/components/calls/call-room";
import { Button } from "@/components/ui/button";
import { slugToRoom } from "@/lib/call-rooms";

export const metadata: Metadata = { title: "Call" };

/**
 * The route takes a URL-safe slug (`family-<uuid>` / `dm-<uuid>`) because a
 * colon cannot travel comfortably in a segment. `slugToRoom` validates the
 * shape before the room name is rebuilt, so a hand-typed URL can never reach
 * the Edge Function with something unexpected — and the function validates it
 * again anyway.
 */
export default async function CallRoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  const roomName = slugToRoom(decodeURIComponent(room));

  if (!roomName) {
    return (
      <div className="space-y-3 rounded-3xl border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          This call link is not valid.
        </p>
        <Button asChild variant="outline" className="h-11 rounded-full">
          <Link href="/calls">Back to calls</Link>
        </Button>
      </div>
    );
  }

  return <CallRoom room={roomName} />;
}
