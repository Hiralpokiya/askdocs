"use client";

import { useRef, useState,useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

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
  const fileRef = useRef<HTMLInputElement>(null);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessages((m) => [...m, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setAsking(false);
    }
  }
  if (status === "loading") {
  return <main className="p-10 text-center text-slate-500">Loading...</main>;
}

if (!session) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <h1 className="text-3xl font-semibold">AskDocs</h1>
      <p className="text-slate-500">Upload PDFs and ask questions with cited answers.</p>
      <button
        onClick={() => signIn("github")}
        className="rounded-lg bg-slate-900 px-5 py-2 text-white"
      >
        Sign in with GitHub
      </button>
    </main>
  );
}

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
  <div>
    <h1 className="text-xl font-semibold">AskDocs</h1>
    <p className="text-sm text-slate-500">Upload a PDF and ask questions. Answers cite their sources.</p>
  </div>
  <div className="flex items-center gap-3 text-sm">
    <span className="text-slate-600">{session.user?.name}</span>
    <button onClick={() => signOut()} className="rounded-lg border px-3 py-1 hover:bg-slate-100">
      Sign out
    </button>
  </div>
</header>
      <div className="mx-auto grid max-w-6xl gap-6 p-6 md:grid-cols-[280px_1fr]">
        {/* Sidebar: upload + documents */}
        <aside className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:border-blue-500">
            <span className="text-sm font-medium">{uploading ? "Processing PDF..." : "Upload a PDF"}</span>
            <span className="mt-1 text-xs text-slate-500">Max 10 MB</span>
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
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected === null ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-slate-100"}`}
            >
              All documents
            </button>
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d.id)}
                className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-sm ${selected === d.id ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-slate-100"}`}
              >
                <div className="truncate">{d.name}</div>
                <div className="text-xs text-slate-500">{d.pages} pages · {d.chunks} chunks</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat */}
        <section className="flex h-[75vh] flex-col rounded-xl bg-white">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <p className="mt-20 text-center text-sm text-slate-400">
                Upload a PDF, then ask something like “Summarize this document.”
              </p>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>

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

            {asking && <p className="text-sm text-slate-400">Thinking...</p>}
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