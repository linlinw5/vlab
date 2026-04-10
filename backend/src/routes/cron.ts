import { Router, Request, Response } from "express";
import { taskManager } from "../services/cron";
import { authenticate, requireAdmin } from "../middleware/auth";
import { logDebug } from "../lib/logger";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/tasks", async (_req: Request, res: Response) => {
  logDebug("routes", "cron_task_list", { message: "Request received" });
  const tasks = await taskManager.getAllTasks();
  logDebug("routes", "cron_task_list", { message: "Done", count: tasks.length });
  res.json(tasks);
});

router.post("/tasks/:id/toggle", async (req: Request<{ id: string }>, res: Response) => {
  logDebug("routes", "cron_task_toggle", { message: "Request received", taskId: req.params.id });
  const enabled = await taskManager.toggleTask(req.params.id);
  logDebug("routes", "cron_task_toggle", { message: "Done", taskId: req.params.id, enabled });
  res.json({ id: req.params.id, enabled });
});

export default router;
