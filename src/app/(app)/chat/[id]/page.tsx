import type { Metadata } from "next";
import { ChatWindow } from "@/components/chat/chat-window";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        This conversation link is invalid.
      </p>
    );
  }

  return (
    <div className="-mb-16">
      <ChatWindow conversationId={id} />
    </div>
  );
}
