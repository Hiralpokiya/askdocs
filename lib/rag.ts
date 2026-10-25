import { pool } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";

export type Chunk = { content: string; page: number; name: string; score: number };

export const SYSTEM_PROMPT =
  "Answer using only the sources provided. Cite sources inline like [1] or [2]. " +
  "Refer to people by name and don't assume gender. " +
  "If the answer is not in the sources, say you couldn't find it in the documents.";

export function chatModel() {
  return process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
}

// Embed the question and return the k closest chunks for this user
export async function retrieve(
  question: string,
  userId: string,
  documentId: number | null,
  k = 5
): Promise<Chunk[]> {
  const emb = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });
  const vector = JSON.stringify(emb.data[0].embedding);

  const { rows } = await pool.query(
    `SELECT c.content, c.page, d.name,
            1 - (c.embedding <=> $1::vector) AS score
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.user_id = $2
       AND ($3::int IS NULL OR d.id = $3)
     ORDER BY c.embedding <=> $1::vector
     LIMIT $4`,
    [vector, userId, documentId, k]
  );

  return rows.map((r) => ({
    content: r.content,
    page: r.page,
    name: r.name,
    score: Number(r.score),
  }));
}

// Number the chunks so the model can cite them
export function buildUserMessage(question: string, chunks: Chunk[]) {
  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.name}, page ${c.page})\n${c.content}`)
    .join("\n\n");
  return `Sources:\n${context}\n\nQuestion: ${question}`;
}
