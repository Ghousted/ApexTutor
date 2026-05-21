"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Paperclip,
  Image as ImageIcon,
  X,
  Loader2,
  Flame,
  Volume2,
  Square,
  ArrowUp,
  LogOut,
  Menu,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import {
  createSession,
  saveMessage,
  getSessionMessages,
  ensureSessionTitleFromFirstMessage,
  updateSessionMeta,
} from "@/lib/sessions";
import Logo from "./Logo";
import AuthModal from "./AuthModal";
import SessionsSidebar from "./SessionsSidebar";
import { synthesizeStream, pcmToWavBlob, isModelLoaded, type TtsLang } from "@/lib/tts";
import { getInstructor, defaultInstructor, type Instructor } from "@/lib/instructors";
import MessageContent from "./MessageContent";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
  // Inline interactive picker rendered inside a bot bubble.
  picker?: "subject";
}

interface Attachment {
  name: string;
  type: "image" | "pdf";
  url: string;
}

const SUGGESTED_QUESTIONS = [
  {
    text: "What does it mean when you square a binomial expression?",
    popular: true,
  },
  { text: "What is the axiomatic approach to probability?", popular: false },
  { text: "What is the structure of phosphorus pentachloride?", popular: false },
  { text: "What makes a matrix Hermitian?", popular: false },
  {
    text: "What term describes a situation in geometry where two sides and the angle formed between them are given?",
    popular: false,
  },
];

const FREE_MESSAGE_LIMIT = 3;

const LANGUAGES = ["English", "Taglish", "Tagalog"] as const;
type Language = (typeof LANGUAGES)[number];

let __msgIdCounter = 0;
const newId = () => `m_${Date.now()}_${++__msgIdCounter}`;

export default function ChatInterface({
  initialQuery,
  instructorId,
  initialSessionId,
}: {
  initialQuery?: string;
  instructorId?: string;
  initialSessionId?: string;
}) {
  const router = useRouter();
  // Resolve the active instructor. Falls back to Maria (Math) if the URL had
  // no instructor param or an unknown id — keeps the landing-page free-chat
  // flow working without breaking.
  const instructor: Instructor =
    getInstructor(instructorId) ?? defaultInstructor();
  const [messages, setMessages] = useState<Message[]>(() =>
    initialQuery
      ? []
      : [
          {
            id: "welcome-1",
            role: "assistant",
            content: `Hi! I'm ${instructor.name}, your ${instructor.subject} tutor. What would you like to learn today?`,
            timestamp: new Date(),
          },
        ]
  );
  const [input, setInput] = useState(initialQuery || "");
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const isAuthenticated = !!user;
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string>("");
  const [voiceMode] = useState(false);
  const [language, setLanguage] = useState<Language>("English");
  const [replySuggestions, setReplySuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSessionsSidebar, setShowSessionsSidebar] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Session persistence (Firestore) — only used when user is signed in.
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [loadingSessionMessages, setLoadingSessionMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialQuerySentRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null); // mirror for async closures
  const firstUserMessageSentRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // When user signs out, drop current session (chat memory persists in
      // local state but won't be saved anywhere).
      if (!u) {
        setCurrentSessionId(null);
        currentSessionIdRef.current = null;
      } else {
        // When user signs in, force-refresh sessions sidebar.
        setSessionsRefreshKey((k) => k + 1);
      }
    });
    return () => unsub();
  }, []);

  // Keep ref in sync so async callbacks see the latest session id.
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const handleSend = useCallback(
    async (overrideInput?: string) => {
      const text = (overrideInput ?? input).trim();
      if (!text && attachments.length === 0) return;
      if (isLoading) return;

      if (!isAuthenticated && messageCount >= FREE_MESSAGE_LIMIT) {
        setAuthModalReason(
          "To continue with your free chat, sign in or create an account. Your chat history will be saved automatically."
        );
        setAuthModalOpen(true);
        return;
      }

      const userMessage: Message = {
        id: newId(),
        role: "user",
        content: text,
        timestamp: new Date(),
        attachments: attachments.length > 0 ? [...attachments] : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setAttachments([]);
      setIsLoading(true);
      setMessageCount((c) => c + 1);
      setReplySuggestions([]);

      const assistantId = newId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      // Persist the user message to Firestore (fire-and-forget). Lazily create
      // the session on the user's very first message in this thread.
      let sessionIdForSave = currentSessionIdRef.current;
      if (user) {
        try {
          if (!sessionIdForSave) {
            sessionIdForSave = await createSession(user.uid, {
              title: text.slice(0, 60) || "New chat",
              language,
              subject: instructor.subject,
              instructorId: instructor.id,
            });
            setCurrentSessionId(sessionIdForSave);
            currentSessionIdRef.current = sessionIdForSave;
            firstUserMessageSentRef.current = true;
          }
          await saveMessage(user.uid, sessionIdForSave, {
            role: "user",
            content: text,
          });
        } catch (e) {
          console.error("Failed to save user message:", e);
        }
      }

      try {
        const history = [...messages, userMessage]
          .filter((m) => m.content && !m.picker)
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            subject: instructor.subject,
            voiceMode,
            language,
            instructorId: instructor.id,
          }),
        });

        if (!res.ok) throw new Error("Failed to get response");

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
            );
          }
        }

        // Persist assistant response.
        if (fullText && user && sessionIdForSave) {
          try {
            await saveMessage(user.uid, sessionIdForSave, {
              role: "assistant",
              content: fullText,
            });
            await updateSessionMeta(user.uid, sessionIdForSave, {
              language,
              subject: instructor.subject,
              instructorId: instructor.id,
            });
            setSessionsRefreshKey((k) => k + 1);
          } catch (e) {
            console.error("Failed to save assistant message:", e);
          }
        }

        if (fullText) {
          fetchSuggestions([...history, { role: "assistant", content: fullText }]);
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Sorry, may problema sa aking sagot. Please try again!",
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      attachments,
      isLoading,
      isAuthenticated,
      messageCount,
      messages,
      voiceMode,
      language,
      user,
      instructor,
    ]
  );

  const fetchSuggestions = useCallback(
    async (history: { role: "user" | "assistant"; content: string }[]) => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch("/api/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, language }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: string[] };
        if (Array.isArray(data.suggestions)) {
          setReplySuggestions(data.suggestions);
        }
      } catch {
        // silently ignore — suggestions are non-essential
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [language]
  );

  useEffect(() => {
    if (initialQuery && !initialQuerySentRef.current) {
      initialQuerySentRef.current = true;
      handleSend(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If we arrived with ?session=ID (e.g., cross-instructor session jump),
  // load that session as soon as auth is known.
  const initialSessionLoadedRef = useRef(false);
  useEffect(() => {
    if (!user || !initialSessionId || initialSessionLoadedRef.current) return;
    initialSessionLoadedRef.current = true;
    handleSelectSession(initialSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initialSessionId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const type = file.type.startsWith("image/") ? "image" : "pdf";
      const url = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, { name: file.name, type, url }]);
    });
    e.target.value = "";
  };

  const handleSubjectPick = (chosen: string) => {
    if (subject) return;
    setSubject(chosen);
    handleSend(chosen);
  };

  const handleNewChat = useCallback(() => {
    setMessages([
      {
        id: "welcome-1",
        role: "assistant",
        content: `Hi! I'm ${instructor.name}, your ${instructor.subject} tutor. What would you like to learn today?`,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setAttachments([]);
    setSubject("");
    setReplySuggestions([]);
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    firstUserMessageSentRef.current = false;
  }, [instructor]);

  const handleSelectSession = useCallback(
    async (sessionId: string, sessionInstructorId?: string) => {
      if (!user) return;
      if (sessionId === currentSessionIdRef.current) return;

      // If the session was started with a different instructor, route to the
      // chat page for that instructor — this remounts the chat with the right
      // persona/voice and the session loads inside that context.
      if (
        sessionInstructorId &&
        sessionInstructorId !== instructor.id &&
        getInstructor(sessionInstructorId)
      ) {
        router.push(`/chat?instructor=${sessionInstructorId}&session=${sessionId}`);
        return;
      }

      setLoadingSessionMessages(true);
      setReplySuggestions([]);
      try {
        const stored = await getSessionMessages(user.uid, sessionId);
        const restored: Message[] = stored.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        }));
        setMessages(
          restored.length > 0
            ? restored
            : [
                {
                  id: "empty",
                  role: "assistant",
                  content: "Welcome back. Continue your conversation below.",
                  timestamp: new Date(),
                },
              ]
        );
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
        firstUserMessageSentRef.current = restored.some(
          (m) => m.role === "user"
        );
      } catch (e) {
        console.error("Failed to load session:", e);
        alert("Couldn't load that conversation. Try again.");
      } finally {
        setLoadingSessionMessages(false);
      }
    },
    [user, instructor, router]
  );

  const handleSignOut = useCallback(async () => {
    setUserMenuOpen(false);
    try {
      await signOut();
      handleNewChat();
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  }, [handleNewChat]);

  // After sign-in, if user had been chatting anonymously, kick off session
  // creation by reusing existing in-memory messages as the start of a session.
  useEffect(() => {
    if (!user) return;
    if (currentSessionIdRef.current) return;
    const hasUserMessage = messages.some((m) => m.role === "user" && m.content);
    if (!hasUserMessage) return;

    (async () => {
      try {
        const firstUser = messages.find(
          (m) => m.role === "user" && m.content
        );
        const sid = await createSession(user.uid, {
          title: firstUser?.content?.slice(0, 60) || "New chat",
          language,
          subject: subject || undefined,
        });
        currentSessionIdRef.current = sid;
        setCurrentSessionId(sid);
        // Persist all existing messages so the session has full context.
        for (const m of messages) {
          if (!m.content || m.picker) continue;
          await saveMessage(user.uid, sid, {
            role: m.role,
            content: m.content,
          });
        }
        if (firstUser) {
          await ensureSessionTitleFromFirstMessage(
            user.uid,
            sid,
            firstUser.content
          );
        }
        setSessionsRefreshKey((k) => k + 1);
      } catch (e) {
        console.error("Failed to back-fill session after sign-in:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const userInitial = (
    user?.displayName?.trim()?.[0] ||
    user?.email?.trim()?.[0] ||
    "?"
  ).toUpperCase();

  return (
    <div className="h-screen overflow-hidden bg-white flex">
      {/* Sessions Sidebar (signed-in only, toggleable on mobile) */}
      {user && (
        <div
          className={cn(
            "h-full transition-all overflow-hidden",
            showSessionsSidebar ? "w-64" : "w-0 md:w-64"
          )}
        >
          <SessionsSidebar
            uid={user.uid}
            currentSessionId={currentSessionId}
            onSelectSession={(sid, sinstr) => {
              handleSelectSession(sid, sinstr);
              setShowSessionsSidebar(false);
            }}
            onNewChat={() => {
              handleNewChat();
              setShowSessionsSidebar(false);
            }}
            refreshKey={sessionsRefreshKey}
            filterByInstructorId={instructor.id}
          />
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="px-4 md:px-10 py-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {user && (
              <button
                onClick={() => setShowSessionsSidebar((v) => !v)}
                className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                aria-label="Toggle chat history"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className="hover:opacity-80 transition-opacity shrink-0"
              aria-label="Apex Tutor home"
            >
              <Logo size="md" />
            </button>

            {/* Active instructor pill */}
            <button
              onClick={() => router.push("/instructors")}
              className="hidden md:flex items-center gap-2 ml-2 pl-1.5 pr-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors group"
              title="Switch professor"
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: instructor.accentColor }}
              >
                {instructor.avatarInitial}
              </span>
              <span className="text-sm font-medium text-ink">
                {instructor.name}
              </span>
              <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                · {instructor.subject}
              </span>
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors ml-1" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    "px-3 md:px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                    language === lang
                      ? "bg-white text-ink shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-semibold flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden"
                  aria-label="Account menu"
                >
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    userInitial
                  )}
                </button>
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-12 z-50 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-sm font-medium text-ink truncate">
                          {user.displayName || "Apex Tutor user"}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {user.email}
                        </p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthModalReason("");
                  setAuthModalOpen(true);
                }}
                className="px-4 py-2 bg-ink hover:bg-slate-800 text-white rounded-full text-xs font-medium transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </header>

      {/* Main layout: chat column + suggested questions sidebar */}
      <div className="flex-1 flex gap-6 px-4 md:px-10 pb-6 max-w-[1400px] mx-auto w-full min-h-0">
        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages container with border (matches wireframe card) */}
          <div className="flex-1 rounded-3xl border border-slate-200 bg-white overflow-y-auto p-5 md:p-8 mb-4 min-h-0">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isLoading && msg.id === messages[messages.length - 1]?.id
                  }
                  onSubjectPick={handleSubjectPick}
                  subject={subject}
                  ttsLang={language}
                  ttsVoiceId={instructor.voiceId}
                />
              ))}
              {isLoading && messages[messages.length - 1]?.content === "" && (
                <div className="flex items-center gap-2 text-slate-400 text-sm pl-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Apex Tutor is thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Loading indicator while restoring a session */}
          {loadingSessionMessages && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading conversation...
            </div>
          )}

          {/* Reply Suggestions */}
          {(replySuggestions.length > 0 || loadingSuggestions) && !isLoading && (
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {loadingSuggestions && replySuggestions.length === 0 ? (
                <>
                  <SuggestionSkeleton />
                  <SuggestionSkeleton />
                  <SuggestionSkeleton />
                </>
              ) : (
                replySuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setReplySuggestions([]);
                      handleSend(s);
                    }}
                    className="px-3 py-1.5 rounded-full border border-indigo-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 text-slate-700 text-xs transition-all active:scale-95"
                  >
                    {s}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="flex gap-2 px-2 pb-2 flex-wrap">
              {attachments.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs"
                >
                  {a.type === "image" ? (
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                  )}
                  {a.name}
                  <button
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-700" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input pill */}
          <div className="flex items-center gap-3 bg-white border-2 border-indigo-400/70 rounded-full pl-1.5 pr-3 py-1.5 focus-within:border-indigo-500 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 shrink-0 bg-indigo-500 hover:bg-indigo-600 rounded-full flex items-center justify-center transition-colors"
              title="Attach file or photo"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (e.target.value && replySuggestions.length > 0) {
                  setReplySuggestions([]);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="How can Apex Tutor help?"
              rows={1}
              className="flex-1 bg-transparent text-ink placeholder-slate-400 outline-none resize-none text-sm leading-relaxed max-h-32 overflow-y-auto py-2"
              style={{ minHeight: "24px" }}
            />

            <button
              onClick={() => handleSend()}
              disabled={isLoading || (!input.trim() && attachments.length === 0)}
              className="w-9 h-9 shrink-0 text-slate-400 hover:text-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </button>
          </div>

          {!isAuthenticated && messageCount > 0 && (
            <p className="text-center text-slate-400 text-xs mt-3">
              Free messages remaining: {Math.max(0, FREE_MESSAGE_LIMIT - messageCount)}/
              {FREE_MESSAGE_LIMIT}
            </p>
          )}
        </div>

        {/* Suggested Questions sidebar */}
        <aside className="hidden lg:flex w-[340px] shrink-0 flex-col min-h-0">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <span aria-hidden className="text-lg">🦉</span>
              <h2 className="font-semibold text-ink text-sm">Suggested Questions</h2>
            </div>

            <div className="flex flex-col gap-2.5">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q.text)}
                  className={cn(
                    "text-left rounded-xl p-3 text-xs leading-relaxed transition-all hover:shadow-sm",
                    q.popular
                      ? "bg-[#fef0e1] border border-orange-200/60"
                      : "bg-[#f0f7f1] border border-emerald-100/60 text-slate-700"
                  )}
                >
                  {q.popular && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                      <span className="text-[10px] font-bold text-orange-600 tracking-wider">
                        POPULAR
                      </span>
                    </div>
                  )}
                  <span className={q.popular ? "text-slate-800 font-medium" : ""}>
                    {q.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
      </div>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode="signup"
        reason={authModalReason}
      />
    </div>
  );
}

function SuggestionSkeleton() {
  return (
    <div className="px-3 py-1.5 rounded-full bg-slate-100 animate-pulse h-7 w-32" />
  );
}

function MessageBubble({
  message,
  isStreaming,
  onSubjectPick,
  subject,
  ttsLang,
  ttsVoiceId,
}: {
  message: Message;
  isStreaming?: boolean;
  onSubjectPick?: (s: string) => void;
  subject?: string;
  ttsLang?: TtsLang;
  ttsVoiceId?: string;
}) {
  const isUser = message.role === "user";
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing">("idle");
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const objectUrlsRef = useRef<string[]>([]);
  const cancelRef = useRef(false);
  const PLAYBACK_RATE = 1.1; // slight speed-up for a livelier tutoring pace

  const stopAudio = useCallback(() => {
    cancelRef.current = true;
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      } catch {
        // ignore
      }
      currentAudioRef.current = null;
    }
    // Tear down the queue.
    audioQueueRef.current.forEach((a) => {
      try {
        a.pause();
        a.src = "";
      } catch {
        // ignore
      }
    });
    audioQueueRef.current = [];
    // Revoke all object URLs.
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  // Stop any in-flight audio when the bubble unmounts.
  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const handleSpeak = async () => {
    // Toggle stop if anything is in progress.
    if (audioState === "playing" || audioState === "loading") {
      stopAudio();
      setAudioState("idle");
      return;
    }
    if (!message.content) return;

    const lang: TtsLang = ttsLang ?? "English";
    const cleaned = message.content
      .replace(/[*_`#>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);

    setAudioState("loading");
    cancelRef.current = false;
    audioQueueRef.current = [];
    objectUrlsRef.current = [];

    let chunkIdx = 0;
    let generationDone = false;
    let started = false;
    // Tracks whether the playback loop is actively cycling. When the queue
    // drains mid-stream (sentence audio shorter than next sentence's
    // synthesis time), we need to know whether a new chunk should kick off
    // playback or just sit in the queue waiting.
    let isPlaying = false;

    // Chain playback: when one element finishes, kick off the next from the
    // queue. If the queue runs dry while generation is still in flight, we
    // mark isPlaying=false and the next chunk arriving will re-prime playback.
    const playNext = () => {
      if (cancelRef.current) return;
      const next = audioQueueRef.current.shift();
      if (!next) {
        isPlaying = false;
        if (generationDone) {
          currentAudioRef.current = null;
          setAudioState("idle");
        }
        // Otherwise: idle and waiting — for-await loop will re-prime us.
        return;
      }
      isPlaying = true;
      currentAudioRef.current = next;
      next.playbackRate = PLAYBACK_RATE;

      // Safety watchdog: HTMLAudioElement.onended doesn't always fire reliably
      // (especially on Safari for very short clips). Force-advance after the
      // expected duration + 500ms buffer if onended hasn't fired by then.
      let advanced = false;
      const advance = () => {
        if (advanced) return;
        advanced = true;
        playNext();
      };
      const onceLoaded = () => {
        const expectedMs = ((next.duration || 0) * 1000) / PLAYBACK_RATE + 500;
        if (expectedMs > 0 && isFinite(expectedMs)) {
          setTimeout(advance, expectedMs);
        }
      };
      if (next.readyState >= 1) {
        onceLoaded();
      } else {
        next.addEventListener("loadedmetadata", onceLoaded, { once: true });
      }

      next.onended = () => {
        console.log(
          `[TTS] chunk played, queue size now ${audioQueueRef.current.length}`
        );
        advance();
      };
      next.onerror = (e) => {
        console.error("[TTS] audio playback error:", e);
        advance();
      };
      next.play().catch((err) => {
        console.error("[TTS] play() rejected:", err);
        advance();
      });
    };

    try {
      for await (const chunk of synthesizeStream(cleaned, lang, ttsVoiceId)) {
        if (cancelRef.current) {
          console.log("[TTS] cancelled, breaking stream loop");
          break;
        }
        if (!chunk?.audio || chunk.audio.length === 0) {
          console.warn(`[TTS] skipping empty chunk ${chunkIdx}`);
          chunkIdx++;
          continue;
        }

        const wav = pcmToWavBlob(chunk.audio, chunk.samplingRate);
        const url = URL.createObjectURL(wav);
        objectUrlsRef.current.push(url);

        const el = new Audio(url);
        audioQueueRef.current.push(el);

        console.log(
          `[TTS] chunk ${chunkIdx} ready (${chunk.audio.length} samples, ~${(chunk.audio.length / chunk.samplingRate).toFixed(2)}s), queue size ${audioQueueRef.current.length}, isPlaying=${isPlaying}`
        );

        if (!started) {
          started = true;
          setAudioState("playing");
          playNext();
        } else if (!isPlaying) {
          // Queue drained while we were still generating — restart playback
          // with the new chunk. This is the fix for "sometimes stops".
          playNext();
        }
        chunkIdx++;
      }

      generationDone = true;
      console.log(`[TTS] generation complete: ${chunkIdx} chunks total`);

      if (chunkIdx === 0) {
        console.warn("[TTS] stream yielded zero chunks");
        setAudioState("idle");
      } else if (!isPlaying && audioQueueRef.current.length === 0) {
        // Edge case: generation finished after the player went idle.
        setAudioState("idle");
      }
    } catch (e) {
      console.error("[TTS] stream failed:", e);
      stopAudio();
      setAudioState("idle");
    }
  };

  const showFirstTimeHint = audioState === "loading" && !isModelLoaded(ttsLang ?? "English");

  if (isUser) {
    return (
      <div className="flex justify-end group">
        <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[80%]">
          {message.attachments?.map((a, i) => (
            <div key={i} className="mb-1 flex items-center gap-1.5 text-xs opacity-70">
              {a.type === "image" ? (
                <ImageIcon className="w-3 h-3" />
              ) : (
                <Paperclip className="w-3 h-3" />
              )}
              {a.name}
            </div>
          ))}
          {message.content && <MessageContent text={message.content} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex group">
      <div className="bg-[#fef0e1] text-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%] flex flex-col gap-2">
        {message.content && <MessageContent text={message.content} />}

        {message.picker === "subject" && onSubjectPick && (
          <div className="flex flex-col gap-2 mt-1">
            {["Math", "Science"].map((s) => {
              const checked = subject === s;
              return (
                <button
                  key={s}
                  onClick={() => onSubjectPick(s)}
                  disabled={!!subject}
                  className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                      checked
                        ? "border-indigo-500 bg-white"
                        : "border-slate-400 bg-white"
                    )}
                  >
                    {checked && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                  </span>
                  <span className="text-sm text-slate-700">{s}</span>
                </button>
              );
            })}
          </div>
        )}

        {!message.content && !message.picker && (
          <span className="flex gap-1 items-center text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
          </span>
        )}

        {message.content && !isStreaming && !message.picker && (
          <button
            onClick={handleSpeak}
            disabled={audioState === "loading"}
            className={cn(
              "self-start flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-all -mb-1",
              audioState === "playing"
                ? "text-indigo-600 bg-indigo-100"
                : audioState === "loading"
                  ? "text-indigo-500 bg-indigo-50"
                  : "text-slate-500 hover:text-indigo-600 opacity-0 group-hover:opacity-100"
            )}
          >
            {audioState === "loading" ? (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {showFirstTimeHint ? "Loading voice model..." : "Generating..."}
              </>
            ) : audioState === "playing" ? (
              <>
                <Square className="w-2.5 h-2.5 fill-current" />
                Stop
              </>
            ) : (
              <>
                <Volume2 className="w-2.5 h-2.5" />
                Read aloud
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
