import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { buildTaskContext } from "../services/assistant-context.service";
import { askGemini } from "../lib/gemini";

const router = Router();

const SYSTEM_PROMPT = `You are a concise productivity assistant inside a task app called Neura.
You will receive the user's tasks as JSON context, and possibly prior conversation turns.
Answer only using that data. Be brief, use bullet points, and mention priority/due dates where relevant.
If the user asks something unrelated to their tasks, gently redirect them.`;

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

const QUICK_INSTRUCTIONS: Record<string, string> = {
  today: "Summarize today's tasks, ordered by priority.",
  week: "Summarize what's coming up in the next 7 days, grouped by day.",
  overdue: "List any overdue, incomplete tasks and suggest what to tackle first.",
};

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!; // set by requireAuth
    const {
      mode,
      question,
      history = [],
    }: { mode: string; question?: string; history?: HistoryTurn[] } = req.body;

    const context = await buildTaskContext(userId);

    const instruction = QUICK_INSTRUCTIONS[mode] ?? question ?? "Summarize the user's tasks.";

    const conversation = history
      .slice(-8) // keep the prompt small; last few turns are enough for continuity
      .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
      .join("\n");

    const userPrompt = `
Task context (JSON):
${JSON.stringify(context)}

${conversation ? `Conversation so far:\n${conversation}\n` : ""}
Request: ${instruction}
    `.trim();

    const reply = await askGemini(SYSTEM_PROMPT, userPrompt);
    res.json({ reply });
  } catch (err) {
    console.error("Assistant error:", err);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

export default router;