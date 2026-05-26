"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Upload,
  Loader2,
  Trash2,
  FileText,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser, getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { INSTRUCTORS } from "@/lib/instructors";
import { extractPdfText, type ExtractionProgress } from "@/lib/pdfExtract";
import { cn } from "@/lib/utils";

interface Source {
  id: string;
  filename: string;
  uploadedAt: string;
  totalChunks: number;
  totalPages: number;
  status: "ready" | "processing" | "failed";
}

type UploadPhase =
  | { kind: "idle" }
  | { kind: "extracting"; progress: ExtractionProgress; filename: string }
  | { kind: "uploading"; filename: string; pages: number }
  | { kind: "embedding"; filename: string; chunks?: number }
  | { kind: "done"; chunkCount: number; pageCount: number; embedMs: number }
  | { kind: "error"; message: string };

export default function AdminTextbooksClient() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [instructorId, setInstructorId] = useState<string>(INSTRUCTORS[0].id);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const reloadSources = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch(
        `/api/admin/textbooks/list?instructorId=${encodeURIComponent(instructorId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = (await res.json()) as { sources?: Source[]; error?: string };
      if (res.ok && data.sources) setSources(data.sources);
      else setSources([]);
    } catch (e) {
      console.error("Failed to list sources:", e);
      setSources([]);
    } finally {
      setLoadingList(false);
    }
  }, [user, instructorId]);

  useEffect(() => {
    reloadSources();
  }, [reloadSources]);

  const handleFile = async (file: File) => {
    if (!user) {
      setPhase({ kind: "error", message: "Sign in required." });
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setPhase({ kind: "error", message: "Please upload a PDF file." });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setPhase({
        kind: "error",
        message: "PDF is over 100MB — too large to process in-browser. Try a smaller / split file.",
      });
      return;
    }

    try {
      // 1. Extract text in the browser.
      setPhase({
        kind: "extracting",
        progress: { pagesDone: 0, totalPages: 0 },
        filename: file.name,
      });
      const pages = await extractPdfText(file, (progress) =>
        setPhase({ kind: "extracting", progress, filename: file.name })
      );

      // 2. Upload to server for chunking + embedding.
      setPhase({ kind: "uploading", filename: file.name, pages: pages.length });
      const token = await getIdToken(user);
      const res = await fetch("/api/admin/textbooks/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          instructorId,
          filename: file.name,
          pages,
        }),
      });

      // 3. Server is embedding now — the request stays open until done.
      // We can't get incremental progress from the server with a regular
      // fetch, but the spinner state tells the user something is happening.
      setPhase({ kind: "embedding", filename: file.name });

      const data = (await res.json()) as {
        ok?: boolean;
        chunkCount?: number;
        pageCount?: number;
        embedMs?: number;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Ingestion failed (HTTP ${res.status})`);
      }

      setPhase({
        kind: "done",
        chunkCount: data.chunkCount ?? 0,
        pageCount: data.pageCount ?? 0,
        embedMs: data.embedMs ?? 0,
      });
      reloadSources();
    } catch (e) {
      console.error("Upload failed:", e);
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Upload failed",
      });
    }
  };

  const handleDelete = async (sourceId: string, filename: string) => {
    if (!user) return;
    if (!confirm(`Delete "${filename}" and all its embeddings? This can't be undone.`)) return;
    try {
      const token = await getIdToken(user);
      const res = await fetch(
        `/api/admin/textbooks/source?instructorId=${encodeURIComponent(
          instructorId
        )}&sourceId=${encodeURIComponent(sourceId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Delete failed");
      }
      reloadSources();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-canvas-white">Textbooks</h1>
          <p className="text-sm text-ash-gray mt-1">
            Upload PDFs per instructor. The chat will ground answers in your
            content and cite page numbers.
          </p>
        </div>
        <select
          value={instructorId}
          onChange={(e) => setInstructorId(e.target.value)}
          className="px-3 py-2 bg-coal border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-canvas-white"
        >
          {INSTRUCTORS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} — {i.subject}
            </option>
          ))}
        </select>
      </header>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-[14px] border-2 border-dashed p-8 text-center transition-colors mb-4",
          dragOver
            ? "border-[var(--border-strong)] bg-iron"
            : "border-[var(--border-subtle)] bg-coal hover:border-slate-300"
        )}
      >
        {phase.kind === "idle" && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-iron text-canvas-white flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-canvas-white mb-1">
              Drag &amp; drop a PDF here
            </p>
            <p className="text-xs text-ash-gray mb-4">
              Or click to browse · Max 100MB · Text-based PDFs only
            </p>
            <label className="inline-block px-4 py-2 bg-canvas-white hover:opacity-90 text-void-black text-sm rounded-full cursor-pointer transition-colors">
              Choose file
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        )}

        {phase.kind === "extracting" && (
          <PhaseStatus
            spinner
            title={`Extracting text from ${phase.filename}`}
            subtitle={`Page ${phase.progress.pagesDone} of ${phase.progress.totalPages || "?"}`}
          />
        )}

        {phase.kind === "uploading" && (
          <PhaseStatus
            spinner
            title={`Uploading ${phase.filename}`}
            subtitle={`Sending ${phase.pages} pages of text to the server...`}
          />
        )}

        {phase.kind === "embedding" && (
          <PhaseStatus
            spinner
            title={`Embedding ${phase.filename}`}
            subtitle="Generating vectors with BGE-small. This is the slow part — usually 30 to 120 seconds depending on size."
          />
        )}

        {phase.kind === "done" && (
          <div>
            <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-canvas-white text-void-black flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-canvas-white mb-1">
              Indexed {phase.chunkCount} chunks across {phase.pageCount} pages
            </p>
            <p className="text-xs text-ash-gray mb-4">
              Embedding took {Math.round(phase.embedMs / 100) / 10}s. Your
              instructor can now cite this textbook in chat.
            </p>
            <button
              onClick={() => setPhase({ kind: "idle" })}
              className="text-xs font-medium text-canvas-white hover:underline"
            >
              Upload another
            </button>
          </div>
        )}

        {phase.kind === "error" && (
          <div>
            <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-iron text-canvas-white flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-canvas-white mb-1">Upload failed</p>
            <p className="text-xs text-ash-gray mb-4 max-w-md mx-auto">
              {phase.message}
            </p>
            <button
              onClick={() => setPhase({ kind: "idle" })}
              className="text-xs font-medium text-canvas-white hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Source list */}
      <section className="bg-coal border border-[var(--border-subtle)] rounded-[14px] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-ash-gray" />
          <h2 className="text-sm font-semibold text-canvas-white">Indexed textbooks</h2>
          {loadingList && (
            <Loader2 className="w-3 h-3 ml-auto animate-spin text-slate-300" />
          )}
        </header>

        {sources.length === 0 && !loadingList ? (
          <p className="text-sm text-ash-gray text-center py-8">
            No textbooks indexed yet for this instructor.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {sources.map((s) => (
              <li
                key={s.id}
                className="px-5 py-3 flex items-center gap-3 hover:bg-coal"
              >
                <FileText className="w-4 h-4 text-ash-gray shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-canvas-white truncate">
                    {s.filename}
                  </p>
                  <p className="text-xs text-ash-gray">
                    {s.totalChunks} chunks · {s.totalPages} pages ·{" "}
                    {new Date(s.uploadedAt).toLocaleDateString()} ·{" "}
                    <StatusBadge status={s.status} />
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(s.id, s.filename)}
                  className="p-2 text-ash-gray hover:text-canvas-white hover:bg-coal rounded-lg transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PhaseStatus({
  spinner,
  title,
  subtitle,
}: {
  spinner?: boolean;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-iron text-canvas-white flex items-center justify-center">
        {spinner ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Upload className="w-6 h-6" />
        )}
      </div>
      <p className="text-sm font-semibold text-canvas-white mb-1">{title}</p>
      <p className="text-xs text-ash-gray max-w-md mx-auto leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Source["status"] }) {
  if (status === "ready") return <span className="text-canvas-white">ready</span>;
  if (status === "processing")
    return <span className="text-amber-600">processing</span>;
  return <span className="text-canvas-white">failed</span>;
}
