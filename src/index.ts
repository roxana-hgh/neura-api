import express from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.route";
import tasksRouter from "./routes/tasks.route";
import notesRouter from "./routes/notes.route";
import focusSessionRouter from "./routes/focusSession.route";
import userRouter from "./routes/user.route";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.options("/{*path}", cors());

app.use(express.json());


app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);

app.use("/api/tasks", tasksRouter);
app.use("/api/notes", notesRouter);
app.use("/api/focus-sessions", focusSessionRouter);
app.use("/api/users", userRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;