/**
 * /api/vmware-soap/*
 *
 * SOAP-based vCenter operations not available in the REST API:
 *   snapshots (create / revert / delete / list) and linked clone.
 *
 * Admin-only.
 */
import { Router, Request, Response } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as vcenter from "../services/vcenter";
import { logDebug } from "../lib/logger";

const router = Router();
router.use(authenticate, requireAdmin);

// GET  /api/vmware-soap/vcenter/vm/:vmId/snapshots        — list snapshots
router.get("/vcenter/vm/:vmId/snapshots", async (req: Request<{ vmId: string }>, res: Response) => {
  const { vmId } = req.params;
  logDebug("vmware", "soap_snapshot_list", { vmId });
  const result = await vcenter.listSnapshots(vmId);
  res.json(result);
});

// POST /api/vmware-soap/vcenter/vm/:vmId/snapshots        — create snapshot
// body: { name: string, description?: string }
router.post("/vcenter/vm/:vmId/snapshots", async (req: Request<{ vmId: string }>, res: Response) => {
  const { vmId } = req.params;
  const { name, description } = req.body as { name: string; description?: string };
  if (!name) {
    res.status(400).json({ message: "name is required" });
    return;
  }
  logDebug("vmware", "soap_snapshot_create", { vmId, name });
  await vcenter.createSnapshot(vmId, name, description);
  res.status(201).json({ message: "Snapshot created" });
});

// POST /api/vmware-soap/vcenter/vm/:vmId/snapshots/revert — revert to current snapshot
router.post("/vcenter/vm/:vmId/snapshots/revert", async (req: Request<{ vmId: string }>, res: Response) => {
  const { vmId } = req.params;
  logDebug("vmware", "soap_snapshot_revert", { vmId });
  await vcenter.revertToCurrentSnapshot(vmId);
  res.json({ message: "Reverted to current snapshot" });
});

// DELETE /api/vmware-soap/vcenter/vm/:vmId/snapshots      — remove all snapshots
router.delete("/vcenter/vm/:vmId/snapshots", async (req: Request<{ vmId: string }>, res: Response) => {
  const { vmId } = req.params;
  logDebug("vmware", "soap_snapshot_remove_all", { vmId });
  await vcenter.removeAllSnapshots(vmId);
  res.json({ message: "All snapshots removed" });
});

// POST /api/vmware-soap/vcenter/vm/:vmId/clone            — linked clone
// body: { name: string, folderId: string }
router.post("/vcenter/vm/:vmId/clone", async (req: Request<{ vmId: string }>, res: Response) => {
  const { vmId } = req.params;
  const { name, folderId } = req.body as { name: string; folderId: string };
  if (!name || !folderId) {
    res.status(400).json({ message: "name and folderId are required" });
    return;
  }
  logDebug("vmware", "soap_linked_clone", { vmId, name, folderId });
  const newVmId = await vcenter.linkedCloneVM(vmId, name, folderId);
  res.status(201).json({ vmId: newVmId });
});

export default router;
