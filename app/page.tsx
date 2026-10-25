"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import SignInLoader from "./sign-in-loader";
import UserMenu from "./user-menu";
import Image from "next/image";

type Source = { n: number; document: string; page: number; score: string; preview: string };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[] };
type Doc = { id: number; name: string; pages: number; chunks: number };

export default function Home() {
  const { data: session, status } = useSession();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setSigningIn(false); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load this user's saved documents after sign-in
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/documents")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDocs);
  }, [status]);

  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const doc = { id: data.documentId, name: file.name, pages: data.pages, chunks: data.chunks };
      setDocs((d) => [doc, ...d]);
      setSelected(doc.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Update the last message (the assistant reply being streamed)
  function updateLast(fn: (m: Message) => Message) {
    setMessages((all) => {
      const copy = [...all];
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || asking) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setAsking(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, documentId: selected }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong");
      }

      // Empty assistant bubble that fills in as text arrives
      setMessages((m) => [...m, { role: "assistant", content: "", sources: [] }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotSources = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // First line is the sources JSON
        if (!gotSources) {
          const newline = buffer.indexOf("\n");
          if (newline === -1) continue;
          const sources: Source[] = JSON.parse(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          gotSources = true;
          updateLast((m) => ({ ...m, sources }));
        }

        // Everything after it is the answer so far
        const answer = buffer;
        updateLast((m) => ({ ...m, content: answer }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setAsking(false);
    }
  }

  // ---------- Loading ----------
  if (status === "loading") {
    return <SignInLoader label="Loading AskDocs" />;
  }

  // ---------- Signed out: landing page ----------
  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        {signingIn && <SignInLoader />}
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          <div>
            <div className="mb-6 flex items-center gap-2"><Image src="/logo.svg" alt="" width={36} height={36} /><span className="text-xl font-semibold">AskDocs</span></div>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              RAG · Next.js · pgvector
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              Ask your PDFs.
              <br />
              Get answers with sources.
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Upload a document and ask questions in plain English. Every answer cites the page it
              came from, so you can check it yourself.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-slate-700">
              <li>✓ Page-level citations on every answer</li>
              <li>✓ Says “not found” instead of guessing</li>
              <li>✓ Your documents stay private to your account</li>
            </ul>

            <button
              onClick={() => { setSigningIn(true); signIn("github"); }}
              disabled={signingIn}
              className="mt-8 rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
            >
              Sign in with GitHub to try it
            </button>
            <p className="mt-3 text-xs text-slate-500">
              We only read your public GitHub profile. Max file size 4 MB.
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              employee_handbook.pdf · 12 pages
            </div>
            <div className="flex justify-end">
              <div className="rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white">
                How many vacation days do new hires get?
              </div>
            </div>
            <div className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm leading-relaxed">
              New hires get 15 vacation days per year, rising to 20 after three years [1]. Unused
              days can roll over up to a maximum of 5 [2].
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div>[1] employee_handbook.pdf · page 7</div>
                <div>[2] employee_handbook.pdf · page 8</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 text-sm md:grid-cols-3">
            <div>
              <p className="font-semibold">1. Upload</p>
              <p className="mt-1 text-slate-600">
                Your PDF is split into chunks and stored as embeddings in PostgreSQL.
              </p>
            </div>
            <div>
              <p className="font-semibold">2. Ask</p>
              <p className="mt-1 text-slate-600">
                Your question is matched to the most relevant chunks with vector search.
              </p>
            </div>
            <div>
              <p className="font-semibold">3. Get a cited answer</p>
              <p className="mt-1 text-slate-600">
                The model answers only from those chunks and shows where each fact came from.
              </p>
            </div>
          </div>
        </div>

        <footer className="py-6 text-center text-xs text-slate-500">
          Built by Hiral Pokiya ·{" "}
          <a href="https://github.com/Hiralpokiya/askdocs" className="underline hover:text-slate-700">
            Source on GitHub
          </a>
        </footer>
      </main>
    );
  }

  const lastIsUser = messages[messages.length - 1]?.role === "user";

  // ---------- Signed in: app ----------
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <div className="flex items-center gap-2"><Image src="/logo.svg" alt="" width={28} height={28} /><h1 className="text-xl font-semibold">AskDocs</h1></div>
          <p className="text-sm text-slate-500">
            Upload a PDF and ask questions. Answers cite their sources.
          </p>
        </div>
        <UserMenu />
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-6 md:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:border-blue-500">
            <span className="text-sm font-medium">
              {uploading ? "Processing PDF..." : "Upload a PDF"}
            </span>
            <span className="mt-1 text-xs text-slate-500">Max 4 MB</span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>

          <div className="rounded-xl bg-white p-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase text-slate-500">Search in</p>
            <button
              onClick={() => setSelected(null)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                selected === null ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-slate-100"
              }`}
            >
              All documents
            </button>
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d.id)}
                className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-sm ${
                  selected === d.id ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-slate-100"
                }`}
              >
                <div className="truncate">{d.name}</div>
                <div className="text-xs text-slate-500">
                  {d.pages} pages · {d.chunks} chunks
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex h-[75vh] min-w-0 flex-col rounded-xl bg-white">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <p className="mt-20 text-center text-sm text-slate-400">
                Upload a PDF, then ask something like “Summarize this document.”
              </p>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">
                    {m.content}
                    {asking && i === messages.length - 1 && m.role === "assistant" && (
                      <span className="ml-0.5 inline-block animate-pulse">▍</span>
                    )}
                  </p>
                  {m.role === "assistant" && !(asking && i === messages.length - 1) && m.sources && m.sources.length > 0 && (() => {
                    const refused = /couldn['’]t find|could not find|not (in|found in) the (provided )?(documents|sources)/i.test(m.content);
                    if (refused) {
                      return (
                        <span className="mt-3 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Not found in your documents
                        </span>
                      );
                    }
                    const best = Math.max(...m.sources.map((src) => Number(src.score)));
                    const [label, style] =
                      best >= 0.4
                        ? ["High match", "bg-green-100 text-green-700"]
                        : best >= 0.3
                          ? ["Medium match", "bg-amber-100 text-amber-700"]
                          : ["Low match · answer may be unreliable", "bg-red-100 text-red-700"];
                    return (
                      <span
                        title={`Best source match score: ${best.toFixed(2)}`}
                        className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
                      >
                        {label}
                      </span>
                    );
                  })()}
                  {m.sources && m.sources.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-slate-600">
                        Sources ({m.sources.length})
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {m.sources.map((s) => (
                          <li key={s.n} className="rounded-lg bg-white p-2 text-xs">
                            <div className="font-medium">
                              [{s.n}] {s.document} · page {s.page} · match {s.score}
                            </div>
                            <div className="mt-1 text-slate-500">{s.preview}…</div>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {asking && lastIsUser && <p className="text-sm text-slate-400">Searching your documents...</p>}
          </div>

          {error && <p className="border-t bg-red-50 px-5 py-2 text-sm text-red-600">{error}</p>}

          <form onSubmit={ask} className="flex gap-2 border-t p-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="flex-1 rounded-lg border px-4 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              disabled={asking || !input.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}