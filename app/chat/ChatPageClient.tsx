"use client";

import { useSearchParams } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPageClient() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || undefined;
  const instructorId = searchParams.get("instructor") || undefined;
  const initialSessionId = searchParams.get("session") || undefined;

  return (
    <ChatInterface
      initialQuery={initialQuery}
      instructorId={instructorId}
      initialSessionId={initialSessionId}
    />
  );
}
