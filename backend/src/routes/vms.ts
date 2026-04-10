import { Router, Request, Response } from "express";
import { getPowerState, setPowerState, waitForPowerOff, deleteVM, cloneVM, getVMConsoleTicket } from "../services/vcenter/vm-operations";
import {
  getClonedVmsByUserId,
  getClonedVmsByLabId,
  getClonedVmsByGroupIdLabId,
  getPaginatedClonedVmsByUserId,
  getPaginatedClonedVms,
  createClonedVM,
  deleteClonedVMByVmId,
  getClonedVMByVmId,
  getUserById,
} from "../db/queries";
import { parsePage } from "../lib/pagination";
import { authenticate, requireAdmin } from "../middleware/auth";
import { config } from "../config";
import { logDebug, logError } from "../lib/logger";

const router = Router();
router.use(authenticate);

// GET /api/vms/my?page=1&pageSize=20 — current user's cloned VMs
router.get("/my", async (req: Request, res: Response) => {
  const { pageSize, offset } = parsePage(req.query as Record<string, unknown>);
  logDebug("routes", "vm_my_list", { message: "Request received", userId: req.user!.userId, pageSize, offset });
  const result = await getPaginatedClonedVmsByUserId(req.user!.userId, pageSize, offset);
  logDebug("routes", "vm_my_list", { message: "Done", userId: req.user!.userId });
  res.json(result);
});

// GET /api/vms/cloned?userId=x&groupId=x&labId=x&page=1&pageSize=20  (admin)
router.get("/cloned", requireAdmin, async (req: Request, res: Response) => {
  const { userId, groupId, labId } = req.query;
  logDebug("routes", "vm_cloned_list", {
    message: "Request received",
    userId: userId ? parseInt(userId as string) : null,
    groupId: groupId ? parseInt(groupId as string) : null,
    labId: labId ? parseInt(labId as string) : null,
  });
  if (!userId && !groupId && !labId) {
    logError("routes", "vm_cloned_list", { message: "Provide userId, groupId, or labId" });
    res.status(400).json({ message: "Provide userId, groupId, or labId" });
    return;
  }
  const { pageSize, offset } = parsePage(req.query as Record<string, unknown>);
  const result = await getPaginatedClonedVms(
    {
      userId: userId ? parseInt(userId as string) : undefined,
      groupId: groupId ? parseInt(groupId as string) : undefined,
      labId: labId ? parseInt(labId as string) : undefined,
    },
    pageSize,
    offset,
  );
  logDebug("routes", "vm_cloned_list", { message: "Done" });
  res.json(result);
});

// GET /api/vms/:vmId/power
router.get("/:vmId/power", async (req: Request<{ vmId: string }>, res: Response) => {
  logDebug("routes", "vm_power_get", { message: "Request received", vmId: req.params.vmId, userId: req.user!.userId });
  // Non-admin can only check their own VMs
  if (req.user!.roleId !== config.roles.admin) {
    const record = await getClonedVMByVmId(req.params.vmId);
    if (!record || record.user_id !== req.user!.userId) {
      logError("routes", "vm_power_get", { message: "Access denied", vmId: req.params.vmId, userId: req.user!.userId });
      res.status(403).json({ message: "Access denied" });
      return;
    }
  }
  const state = await getPowerState(req.params.vmId);
  logDebug("routes", "vm_power_get", { message: "Done", vmId: req.params.vmId });
  res.json(state);
});

// POST /api/vms/:vmId/power  body: { action: 'start'|'stop'|'reset' }
router.post("/:vmId/power", async (req: Request<{ vmId: string }>, res: Response) => {
  const { action } = req.body as { action: "start" | "stop" | "reset" };
  logDebug("routes", "vm_power_set", { message: "Request received", vmId: req.params.vmId, action, userId: req.user!.userId });
  if (req.user!.roleId !== config.roles.admin) {
    const record = await getClonedVMByVmId(req.params.vmId);
    if (!record || record.user_id !== req.user!.userId) {
      logError("routes", "vm_power_set", { message: "Access denied", vmId: req.params.vmId, userId: req.user!.userId, action });
      res.status(403).json({ message: "Access denied" });
      return;
    }
  }
  await setPowerState(req.params.vmId, action);
  logDebug("routes", "vm_power_set", { message: "Done", vmId: req.params.vmId, action });
  res.status(202).json({ message: "Power command sent" });
});

// GET /api/vms/:vmId/console-ticket
router.get("/:vmId/console-ticket", async (req: Request<{ vmId: string }>, res: Response) => {
  logDebug("routes", "vm_console_ticket", { message: "Request received", vmId: req.params.vmId, userId: req.user!.userId });
  if (req.user!.roleId !== config.roles.admin) {
    const record = await getClonedVMByVmId(req.params.vmId);
    if (!record || record.user_id !== req.user!.userId) {
      logError("routes", "vm_console_ticket", { message: "Access denied", vmId: req.params.vmId, userId: req.user!.userId });
      res.status(403).json({ message: "Access denied" });
      return;
    }
  }
  const ticket = await getVMConsoleTicket(req.params.vmId);
  logDebug("routes", "vm_console_ticket", {
    message: "Done",
    vmId: req.params.vmId,
    hasTicket: Boolean(ticket?.ticket),
  });
  res.json(ticket);
});

// POST /api/vms/clone  (admin)
router.post("/clone", requireAdmin, async (req: Request, res: Response) => {
  const { sourceVmId, targetName, labId, userId, groupId, datastoreId, folderId, resourcePoolId } = req.body;
  logDebug("routes", "vm_clone", {
    message: "Request received",
    sourceVmId,
    targetName,
    labId,
    userId,
    groupId: groupId ?? null,
  });

  const user = await getUserById(userId);
  if (!user) {
    logError("routes", "vm_clone", { message: "Target user not found", userId, sourceVmId, targetName });
    res.status(404).json({ message: "Target user not found" });
    return;
  }

  const cloneSpec = {
    name: targetName,
    placement: {
      datastore: datastoreId,
      folder: folderId,
      resource_pool: resourcePoolId,
    },
    source: sourceVmId,
  };

  const { clonedVmId } = await cloneVM(cloneSpec);
  const record = await createClonedVM(targetName, clonedVmId, labId, userId, groupId ?? null, sourceVmId);
  logDebug("routes", "vm_clone", { message: "Done", clonedVmId, targetName, userId, labId });
  res.status(201).json(record);
});

// DELETE /api/vms/:vmId  (admin) — streams progress via ndjson
router.delete("/:vmId", requireAdmin, async (req: Request<{ vmId: string }>, res: Response) => {
  const { vmId } = req.params;
  logDebug("routes", "vm_delete", { message: "Request received", vmId });
  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  try {
    logDebug("routes", "vm_delete", { message: "Powering off VM...", vmId });
    emit("Powering off VM...");
    await setPowerState(vmId, "stop");
    await waitForPowerOff(vmId);
  } catch {
    logDebug("routes", "vm_delete", { message: "VM already off or unreachable, skipping", vmId });
    emit("VM already off or unreachable, skipping");
  }

  try {
    logDebug("routes", "vm_delete", { message: "Deleting from vCenter...", vmId });
    emit("Deleting from vCenter...");
    await deleteVM(vmId);
  } catch (err) {
    logError("routes", "vm_delete", { vmId, message: err instanceof Error ? err.message : String(err) });
    res.end(JSON.stringify({ message: `Failed: ${(err as Error).message}`, done: true, error: true }) + "\n");
    return;
  }

  await deleteClonedVMByVmId(vmId);
  logDebug("routes", "vm_delete", { message: "VM deleted successfully", vmId, done: true });
  res.end(JSON.stringify({ message: "VM deleted successfully", done: true }) + "\n");
});

export default router;
