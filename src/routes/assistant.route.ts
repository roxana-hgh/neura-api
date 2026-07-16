import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { buildTaskContext } from "../services/assistant-context.service";

import { runAssistantTurn } from "../lib/gemini";
import { executeTaskTool, TASK_TOOLS } from "../services/task-tools.service";

const router = Router();

const SYSTEM_PROMPT = `You are Neura's assistant, embedded in a chat panel inside a task app. Keep every reply short and scannable, like a text message — not a document.

Formatting rules:
- No headers (no #, ##, or bolded section titles as headers).
- Max 1-2 short sentences of lead-in, then a plain "-" bullet list if listing tasks.
- Bold only the task title, nothing else. Example: "- **Finish API docs** — high, due today"
- Never restate the date/day unless the user asked about a specific day.
- If there's nothing to report (empty list), say so in one short sentence.

Capabilities:
- You can look up tasks (list_tasks), create tasks (create_task), edit or complete tasks (update_task), and delete tasks (delete_task).
- Always call list_tasks first if you need a task's id to edit, complete, or delete it — never guess an id.
- When the user's request is clear, take the action directly — don't ask for confirmation first. Confirm briefly afterward instead (e.g. "Done — added 'Buy groceries', due Friday." or "Deleted 'Old task'.").
- If a request is ambiguous (e.g. it could match more than one task), ask which one before acting instead of guessing.
- Only act on tasks; if asked about something unrelated, say briefly that you can only help with tasks.`;

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      mode,
      question,
      history = [],
    }: { mode: string; question?: string; history?: HistoryTurn[] } = req.body;

    const quickInstructions: Record<string, string> = {
      today: "Summarize today's tasks, ordered by priority.",
      week: "Summarize what's coming up in the next 7 days, grouped by day.",
      overdue: "List any overdue, incomplete tasks.",
    };

    const instruction = quickInstructions[mode] ?? question ?? "Summarize the user's tasks.";

    // Give the model a starting snapshot so simple summaries don't need a tool round-trip
    const snapshot = await buildTaskContext(userId);

    const conversation = history
      .slice(-8)
      .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
      .join("\n");

    const userPrompt = `
Current task snapshot (JSON, may be slightly stale — call list_tasks if you need exact ids or fresh data):
${JSON.stringify(snapshot)}

${conversation ? `Conversation so far:\n${conversation}\n` : ""}
Request: ${instruction}
    `.trim();

    const { reply, actions } = await runAssistantTurn({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      tools: TASK_TOOLS,
      executeTool: (name, args) => executeTaskTool(name, args, userId),
    });

    // Only tell the frontend about actions that actually changed data (not list_tasks reads)
    const mutations = actions.filter(
      (a) => a.name === "create_task" || a.name === "update_task" || a.name === "delete_task"
    );

    res.json({ reply, actions: mutations });
  } catch (err) {
    console.error("Assistant error:", err);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

export default router;