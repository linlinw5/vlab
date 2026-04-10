import cron, { ScheduledTask } from "node-cron";
import pool from "../../db/client";
import { logDebug, logError } from "../../lib/logger";

interface TaskDef {
  id: string;
  expression: string;
  fn: () => Promise<void>;
  description: string;
  job: ScheduledTask;
}

interface RegisterTaskOptions {
  timezone?: string;
  enabled?: boolean;
}

// Derive a stable 32-bit integer key from a task id string for advisory lock
function stableKey(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

class CronTaskManager {
  private tasks: Record<string, TaskDef> = {};

  registerTask(id: string, expression: string, fn: () => Promise<void>, description: string, options: RegisterTaskOptions = {}): void {
    const lockKey = stableKey(id);
    logDebug("cron", "cron_task_register", { message: "Registering task", id, expression, timezone: options.timezone ?? null });

    const wrapped = async () => {
      logDebug("cron", "cron_task_run", { message: "Triggered", id });
      // Check if task is enabled (shared state via DB, visible to all processes)
      const { rows: statusRows } = await pool.query("SELECT enabled FROM cron_tasks WHERE id = $1", [id]);
      if (!statusRows[0]?.enabled) {
        logDebug("cron", "cron_task_run", { message: "Skipped because disabled", id });
        return;
      }

      // Try to acquire advisory lock — only one process proceeds
      const { rows: lockRows } = await pool.query("SELECT pg_try_advisory_lock($1) AS acquired", [lockKey]);
      if (!lockRows[0].acquired) {
        logDebug("cron", "cron_task_run", { message: "Skipped because advisory lock not acquired", id, lockKey });
        return;
      }

      try {
        logDebug("cron", "cron_task_run", { message: "Running task", id });
        await fn();
        logDebug("cron", "cron_task_run", { message: "Done", id });
      } catch (err) {
        logError("cron", "cron_task_run", {
          id,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        await pool.query("SELECT pg_advisory_unlock($1)", [lockKey]);
        logDebug("cron", "cron_task_run", { message: "Advisory lock released", id, lockKey });
      }
    };

    // Upsert task record; preserve existing enabled state on restart
    const taskEnabled = options.enabled !== false; // default to true
    pool
      .query(
        `INSERT INTO cron_tasks (id, description, expression, enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
        [id, description, expression, taskEnabled],
      )
      .catch((err) =>
        logError("cron", "cron_task_register", {
          id,
          message: err instanceof Error ? err.message : String(err),
        }),
      );

    const job = cron.schedule(expression, wrapped, options.timezone ? { timezone: options.timezone } : undefined);
    this.tasks[id] = { id, expression, fn: wrapped, description, job };
    logDebug("cron", "cron_task_register", { message: "Registered task", id, expression, timezone: options.timezone ?? null });
  }

  async toggleTask(id: string): Promise<boolean> {
    const { rows } = await pool.query("UPDATE cron_tasks SET enabled = NOT enabled WHERE id = $1 RETURNING enabled", [id]);
    return rows[0]?.enabled ?? false;
  }

  async getAllTasks(): Promise<object[]> {
    const { rows } = await pool.query("SELECT id, enabled FROM cron_tasks");
    const statusMap = Object.fromEntries(rows.map((r: { id: string; enabled: boolean }) => [r.id, r.enabled]));
    return Object.values(this.tasks).map((t) => ({
      id: t.id,
      description: t.description,
      expression: t.expression,
      enabled: statusMap[t.id] ?? false,
    }));
  }
}

export default CronTaskManager;
