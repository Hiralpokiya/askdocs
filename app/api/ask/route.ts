import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOpenAI } from "@/lib/openai";
import { retrieve, buildUserMessage, SYSTEM_PROMPT, chatModel } from "@/lib/rag";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { question, documentId } = await req.json();
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "Please ask a question" }, { status: 400 });
  }

  const chunks = await retrieve(question, userId, documentId ?? null);

  const sources = chunks.map((c, i) => ({
    n: i + 1,
    document: c.name,
    page: c.page,
    score: c.score.toFixed(2),
    preview: c.content.slice(0, 150),
  }));

  const encoder = new TextEncoder();
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" };

  if (chunks.length === 0) {
    return new Response(JSON.stringify([]) + "\nNo documents uploaded yet.", { headers });
  }

  const completion = await getOpenAI().chat.completions.create({
    model: chatModel(),
    temperature: 0,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(question, chunks) },
    ],
  });

  // First line = sources JSON, then the answer text as it streams
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
