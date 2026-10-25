import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { question, documentId } = await req.json();
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "Please ask a question" }, { status: 400 });
  }

  // 1. Embed the question
  const emb = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });
  const vector = JSON.stringify(emb.data[0].embedding);

  // 2. Find the 5 closest chunks for this user
  const { rows } = await pool.query(
    `SELECT c.content, c.page, d.name,
            1 - (c.embedding <=> $1::vector) AS score
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.user_id = $2
       AND ($3::int IS NULL OR d.id = $3)
     ORDER BY c.embedding <=> $1::vector
     LIMIT 5`,
    [vector, userId, documentId ?? null]
  );

  const sources = rows.map((r, i) => ({
    n: i + 1,
    document: r.name,
    page: r.page,
    score: Number(r.score).toFixed(2),
    preview: r.content.slice(0, 150),
  }));

  const encoder = new TextEncoder();
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" };

  // No documents: same format, no model call
  if (rows.length === 0) {
    return new Response(JSON.stringify([]) + "\nNo documents uploaded yet.", { headers });
  }

  const context = rows
    .map((r, i) => `[${i + 1}] (${r.name}, page ${r.page})\n${r.content}`)
    .join("\n\n");

  // 3. Ask the model with stream: true
  const completion = await getOpenAI().chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    temperature: 0,
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "Answer using only the sources provided. Cite sources inline like [1] or [2]. " +
          "Refer to people by name and don't assume gender. " +
          "If the answer is not in the sources, say you couldn't find it in the documents.",
      },
      { role: "user", content: `Sources:\n${context}\n\nQuestion: ${question}` },
    ],
  });

  // 4. Stream: first line = sources JSON, then the answer text as it arrives
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify(sources) + "\n"));
      try {
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        console.error(err);
        controller.enqueue(encoder.encode("\n\n[The answer was cut off. Please try again.]"));
      }
      controller.close();
    },
  });

  return new Response(body, { headers });
}
