import { pool } from "@/lib/db";

export const LIMITS = {
  ask: Number(process.env.ASK_DAILY_LIMIT ?? 30),
  upload: Number(process.env.UPLOAD_DAILY_LIMIT ?? 10),
} as const;

type Kind = keyof typeof LIMITS;

// Atomically add 1 to today's count, but only if it's still under the limit.
// No row returned means the limit was already reached.
export async function consume(userId: string, kind: Kind) {
  const limit = LIMITS[kind];
  const { rows } = await pool.query(
    `INSERT INTO usage (user_id, day, kind, count)
     VALUES ($1, CURRENT_DATE, $2, 1)
     ON CONFLICT (user_id, day, kind)
     DO UPDATE SET count = usage.count + 1
     WHERE usage.count < $3
     RETURNING count`,
    [userId, kind, limit]
  );
  return { ok: rows.length > 0, limit };
}

export function limitMessage(kind: Kind, limit: number) {
  const what = kind === "ask" ? "questions" : "uploads";
  return `Daily limit reached (${limit} ${what} per day). It resets at midnight UTC.`;
}
