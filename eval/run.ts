import fs from "fs";
import { pool } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";
import { retrieve, buildUserMessage, SYSTEM_PROMPT, chatModel } from "@/lib/rag";

type Case = {
  question: string;
  expected?: string[]; // words/phrases that must appear in a correct answer
  page?: number; // page that contains the answer (checks retrieval)
  answerable?: boolean; // false = the answer is NOT in the document
};

const REFUSAL = /couldn['’]t find|could not find|not (in|found in) the (documents|sources)/i;

async function main() {
  const userId = process.env.EVAL_USER_ID;
  const documentId = process.env.EVAL_DOCUMENT_ID ? Number(process.env.EVAL_DOCUMENT_ID) : null;
  if (!userId) throw new Error("Set EVAL_USER_ID in .env.local");

  const cases: Case[] = JSON.parse(fs.readFileSync("eval/questions.json", "utf8"));
  const results = [];

  for (const [i, c] of cases.entries()) {
    const start = Date.now();
    const chunks = await retrieve(c.question, userId, documentId);
    const res = await getOpenAI().chat.completions.create({
      model: chatModel(),
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(c.question, chunks) },
      ],
    });
    const answer = res.choices[0].message.content ?? "";
    const seconds = (Date.now() - start) / 1000;

    const answerable = c.answerable !== false;
    const correct = answerable
      ? (c.expected ?? []).every((k) => answer.toLowerCase().includes(k.toLowerCase())) &&
        !REFUSAL.test(answer)
      : REFUSAL.test(answer);
    const cited = answerable ? /\[\d+\]/.test(answer) : null;
    const retrievalHit = c.page == null ? null : chunks.some((ch) => ch.page === c.page);

    results.push({ ...c, answerable, answer, correct, cited, retrievalHit, seconds });
    console.log(`${correct ? "✓" : "✗"} ${i + 1}. ${c.question}`);
    if (!correct) console.log(`    got: ${answer.slice(0, 160).replace(/\n/g, " ")}`);
  }

  const pct = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : "n/a");
  const answerables = results.filter((r) => r.answerable);
  const unanswerables = results.filter((r) => !r.answerable);
  const withPage = results.filter((r) => r.retrievalHit !== null);

  console.log("\n===== AskDocs evaluation =====");
  console.log("Overall accuracy:   ", pct(results.filter((r) => r.correct).length, results.length));
  console.log("Answerable correct: ", pct(answerables.filter((r) => r.correct).length, answerables.length));
  console.log("Correct refusals:   ", pct(unanswerables.filter((r) => r.correct).length, unanswerables.length));
  console.log("Citation rate:      ", pct(answerables.filter((r) => r.cited).length, answerables.length));
  console.log("Retrieval hit rate: ", pct(withPage.filter((r) => r.retrievalHit).length, withPage.length));
  console.log(
    "Avg latency:        ",
    (results.reduce((s, r) => s + r.seconds, 0) / results.length).toFixed(2) + "s"
  );

  fs.writeFileSync("eval/results.json", JSON.stringify(results, null, 2));
  console.log("\nFull results saved to eval/results.json");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
