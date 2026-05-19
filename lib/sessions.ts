// Firestore CRUD for chat sessions + messages.
//
// Data model:
//   users/{uid}/sessions/{sessionId}                — session metadata
//   users/{uid}/sessions/{sessionId}/messages/{mid} — individual messages
//
// Each user/assistant turn is one message doc, ordered by createdAt asc.

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit as fbLimit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";

export interface SessionDoc {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  language?: string;
  subject?: string;
  instructorId?: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

function sessionsCol(uid: string) {
  return collection(db, "users", uid, "sessions");
}

function messagesCol(uid: string, sessionId: string) {
  return collection(db, "users", uid, "sessions", sessionId, "messages");
}

function deriveTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New chat";
  return cleaned.length > 60 ? cleaned.slice(0, 57) + "..." : cleaned;
}

/** Create a new chat session. Returns the new session ID. */
export async function createSession(
  uid: string,
  opts: {
    title?: string;
    language?: string;
    subject?: string;
    instructorId?: string;
  } = {}
): Promise<string> {
  const ref = await addDoc(sessionsCol(uid), {
    title: opts.title || "New chat",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    messageCount: 0,
    language: opts.language ?? null,
    subject: opts.subject ?? null,
    instructorId: opts.instructorId ?? null,
  });
  return ref.id;
}

/** Append a message to a session and bump messageCount + updatedAt. */
export async function saveMessage(
  uid: string,
  sessionId: string,
  message: { role: "user" | "assistant"; content: string }
) {
  await addDoc(messagesCol(uid, sessionId), {
    role: message.role,
    content: message.content,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", uid, "sessions", sessionId), {
    updatedAt: serverTimestamp(),
    messageCount: increment(1),
  });
}

/** Update session metadata (title, language, subject, instructorId). */
export async function updateSessionMeta(
  uid: string,
  sessionId: string,
  patch: Partial<{
    title: string;
    language: string;
    subject: string;
    instructorId: string;
  }>
) {
  await setDoc(
    doc(db, "users", uid, "sessions", sessionId),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** If a session has no real title yet, derive one from the first user message. */
export async function ensureSessionTitleFromFirstMessage(
  uid: string,
  sessionId: string,
  firstUserMessage: string
) {
  const title = deriveTitle(firstUserMessage);
  await updateSessionMeta(uid, sessionId, { title });
}

/** List the user's sessions, newest first. */
export async function listSessions(
  uid: string,
  max: number = 50
): Promise<SessionDoc[]> {
  const q = query(sessionsCol(uid), orderBy("updatedAt", "desc"), fbLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title || "Untitled",
      createdAt: tsToDate(data.createdAt),
      updatedAt: tsToDate(data.updatedAt),
      messageCount: data.messageCount ?? 0,
      language: data.language ?? undefined,
      subject: data.subject ?? undefined,
      instructorId: data.instructorId ?? undefined,
    };
  });
}

/** Get all messages in a session, in order. */
export async function getSessionMessages(
  uid: string,
  sessionId: string
): Promise<StoredMessage[]> {
  const q = query(messagesCol(uid, sessionId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      role: data.role,
      content: data.content,
      createdAt: tsToDate(data.createdAt),
    };
  });
}

/** Delete a session and all its messages. */
export async function deleteSession(uid: string, sessionId: string) {
  // Delete all messages in a batch (chunked to stay under 500 ops/batch).
  const msgSnap = await getDocs(messagesCol(uid, sessionId));
  const docs = msgSnap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "users", uid, "sessions", sessionId));
}

function tsToDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}
