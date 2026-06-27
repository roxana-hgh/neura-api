import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/get-session";

const router = Router();

// GET /api/tasks — all tasks + subtasks for the logged-in user
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { search, priorities, listId, unassigned } = req.query;

  const priorityList = priorities
    ? (priorities as string).split(",")
    : undefined;

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      ...(listId && { listId: listId as string }),
      ...(unassigned === "true" && { listId: null }),
      ...(search && {
        title: { contains: search as string, mode: "insensitive" },
      }),
      ...(priorityList?.length && {
        priority: { in: priorityList },
      }),
    },
    include: { subtasks: true },
    orderBy: { dueDate: { sort: "asc", nulls: "last" } },
  });

  res.json(tasks);
});

// POST /api/tasks — create a task
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { title, description, priority, due_date, list_id } = req.body;

  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? null,
      priority,
      dueDate: due_date ? new Date(due_date) : null,
      listId: list_id ?? null,
      userId,
    },
    include: { subtasks: true },
  });

  res.status(201).json(task);
});

router.get("/calendar", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);       // 1st of month
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // last day

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      dueDate: { gte: start, lte: end },
    },
    include: { subtasks: true },
    orderBy: { dueDate: "asc" },
  });

  res.json(tasks);
});

// GET /api/tasks/lists — all lists for the logged-in user
router.get("/lists", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const lists = await prisma.taskList.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  res.json(lists);
});

// POST /api/tasks/lists — create a list
router.post("/lists", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, color, description } = req.body;

  const list = await prisma.taskList.create({
    data: { name, color, description: description ?? null, userId },
  });

  res.status(201).json(list);
});

// GET /api/tasks/lists/:id
router.get("/lists/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const list = await prisma.taskList.findFirst({
    where: { id, userId }, // userId check prevents accessing other users' lists
  });

  if (!list) {
    res.status(404).json({ error: "List not found" });
    return;
  }

  res.json(list);
});

// GET /api/tasks/:id
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const task = await prisma.task.findFirst({
    where: { id, userId },
    include: { subtasks: true },
  });

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(task);
});

// PUT /api/tasks/:id
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const { title, description, priority, due_date, list_id } = req.body;

  const task = await prisma.task.update({
    where: { id, userId },
    data: {
      title,
      description: description ?? null,
      priority,
      dueDate: due_date ? new Date(due_date) : null,
      listId: list_id ?? null,
    },
    include: { subtasks: true },
  });

  res.json(task);
});

// PATCH /api/tasks/:id/toggle
router.patch("/:id/toggle", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const { completed } = req.body;

  const task = await prisma.task.update({
    where: { id, userId },
    data: { completed },
    include: { subtasks: true },
  });

  res.json(task);
});

// DELETE /api/tasks/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  await prisma.task.delete({
    where: { id, userId },
  });

  res.status(204).send();
});

// PUT /api/tasks/lists/:id
router.put("/lists/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const { name, color, description } = req.body;

  const updated = await prisma.taskList.update({
    where: { id, userId },
    data: { name, color, description: description ?? null },
  });

  res.json(updated);
});

// DELETE /api/tasks/lists/:id
router.delete("/lists/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  await prisma.taskList.delete({
    where: { id, userId },
  });

  res.status(204).send();
});

export default router;
