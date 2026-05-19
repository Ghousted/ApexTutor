"use client";

import { useSearchParams } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPageClient() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || undefined;

  return <ChatInterface initialQuery={initialQuery} />;
}
