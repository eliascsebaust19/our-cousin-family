import type { Metadata } from "next";
import { ChatList } from "@/components/chat/chat-list";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return <ChatList />;
}
