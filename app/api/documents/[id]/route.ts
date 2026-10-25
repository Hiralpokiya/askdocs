import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { id } = await params;
  const docId = Number(id);
  if (!Number.isInteger(docId)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  // user_id check means you can only delete your own documents.
  // Chunks are removed automatically by ON DELETE CASCADE.
  const { rowCount } = await pool.query(
    "DELETE FROM documents WHERE id = $1 AND user_id = $2",
    [docId, userId]
  );

  if (rowCount === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: docId });
}
