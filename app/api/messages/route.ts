import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

// Last 50 messages, oldest first
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT role, content, sources FROM (
       SELECT id, role, content, sources FROM messages
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 50
     ) recent
     ORDER BY id ASC`,
    [userId]
  );

  return NextResponse.json(
    rows.map((r) => ({ role: r.role, content: r.content, sources: r.sources ?? undefined }))
  );
}

// Clear all chat history for this user (documents are not touched)
export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  await pool.query("DELETE FROM messages WHERE user_id = $1", [userId]);
  return NextResponse.json({ cleared: true });
}
