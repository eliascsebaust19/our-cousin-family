import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PostComposer } from "@/components/feed/post-composer";

export const metadata: Metadata = { title: "Create post" };

export default function CreatePostPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/home"
          aria-label="Back to feed"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-semibold">New post</h1>
      </div>

      <PostComposer />
    </div>
  );
}
