import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT d.id, d.name,
            COUNT(c.id)::int AS chunks,
            COALESCE(MAX(c.page), 0)::int AS pages
     FROM documents d
     LEFT JOIN chunks c ON c.document_id = d.id
     WHERE d.user_id = $1
     GROUP BY d.id
     ORDER BY d.created_at DESC`,
    [userId]
  );
  return NextResponse.json(rows);
}