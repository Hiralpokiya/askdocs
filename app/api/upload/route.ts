import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";
import { chunkText } from "@/lib/chunk";


export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Please upload a PDF" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Max file size is 10 MB" }, { status: 400 });
  }

  // 1. Extract text page by page
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { text: pages } = await extractText(pdf, { mergePages: false });

  // 2. Chunk each page, keeping the page number for citations
  const pieces = pages.flatMap((t, i) =>
    chunkText(t).map((content) => ({ page: i + 1, content }))
  );
  if (pieces.length === 0) {
    return NextResponse.json({ error: "No text found (is it a scanned PDF?)" }, { status: 400 });
  }

  // 3. Embed in batches of 100 (before opening a DB transaction)
  const embeddings: number[][] = [];
  for (let i = 0; i < pieces.length; i += 100) {
    const res = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: pieces.slice(i, i + 100).map((p) => p.content),
    });
    embeddings.push(...res.data.map((d) => d.embedding));
  }

  // 4. Save everything in one transaction: all or nothing
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "INSERT INTO documents (user_id, name) VALUES ($1, $2) RETURNING id",
      [userId, file.name] // replaced with the real user in the auth step
    );
    const docId = rows[0].id;

    for (let i = 0; i < pieces.length; i++) {
      await client.query(
        "INSERT INTO chunks (document_id, page, content, embedding) VALUES ($1, $2, $3, $4::vector)",
        [docId, pieces[i].page, pieces[i].content, JSON.stringify(embeddings[i])]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ documentId: docId, pages: pages.length, chunks: pieces.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  } finally {
    client.release();
  }
}