/**
 * /api/vmware/*
 *
 * Route paths intentionally mirror VMware vCenter REST API paths 1:1.
 * Admin-only. All requests proxied to vCenter after token injection.
 *
 * vCenter API reference:
 *   https://<vcenter>/api/vcenter/...
 *   https://<vcenter>/api/cis/tagging/...
 */
import { Router, Request, Response } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as vcenter from "../services/vcenter";
import { config } from "../config";
import { logDebug, logError } from "../lib/logger";

const router = Router();
router.use(authenticate, requireAdmin);

// ── vcenter ──────────────────────────────────────────────────────────────────────────────
router.get("/vcenter/cluster", async (_req, res: Response) => {
  logDebug("routes", "vmware_cluster_list", { message: "Request received" });
  const result = await vcenter.getClusters();
  logDebug("routes", "vmware_cluster_list", { message: "Done" });
  res.json(result);
});

router.get("/vcenter/datacenter", async (_req, res: Response) => {
  logDebug("routes", "vmware_datacenter_list", { message: "Request received" });
  const result = await vcenter.getDatacenters();
  logDebug("routes", "vmware_datacenter_list", { message: "Done" });
  res.json(result);
});

router.get("/vcenter/datastore", async (_req, res: Response) => {
  logDebug("routes", "vmware_datastore_list", { message: "Request received" });
  const result = await vcenter.getDatastores();
  logDebug("routes", "vmware_datastore_list", { message: "Done" });
  res.json(result);
});

router.get("/vcenter/folder", async (req: Request, res: Response) => {
  const type = req.query.type as Parameters<typeof vcenter.getFolders>[0] | undefined;
  logDebug("routes", "vmware_folder_list", { message: "Request received", type: type ?? null });
  const result = await vcenter.getFolders(type);
  logDebug("routes", "vmware_folder_list", { message: "Done", type: type ?? null });
  res.json(result);
});

router.get("/vcenter/host", async (_req, res: Response) => {
  logDebug("routes", "vmware_host_list", { message: "Request received" });
  const result = await vcenter.getHosts();
  logDebug("routes", "vmware_host_list", { message: "Done" });
  res.json(result);
});

router.get("/vcenter/network", async (_req, res: Response) => {
  logDebug("routes", "vmware_network_list", { message: "Request received" });
  const result = await vcenter.getNetworks();
  logDebug("routes", "vmware_network_list", { message: "Done" });
  res.json(result);
});

router.get("/vcenter/resource-pool", async (_req, res: Response) => {
  logDebug("routes", "vmware_resource_pool_list", { message: "Request received" });
  const result = await vcenter.getResourcePools();
  logDebug("routes", "vmware_resource_pool_list", { message: "Done" });
  res.json(result);
});

// GET  /api/vmware/source-vms — list VMs in the configured source folder (for lab template selection)
router.get("/source-vms", async (_req: Request, res: Response) => {
  logDebug("routes", "vmware_source_vm_list", { message: "Request received", sourceFolder: config.vmFolder.source });
  const result = await vcenter.getVMList(config.vmFolder.source);
  logDebug("routes", "vmware_source_vm_list", { message: "Done" });
  res.json(result);
});

// ── vcenter/vm ─────────────────────────────────────────────────────────────────

// GET  /api/vmware/vcenter/vm[?folders=x]   — list VMs
router.get("/vcenter/vm", async (req: Request, res: Response) => {
  const folder = req.query.folders as string | undefined;
  logDebug("routes", "vmware_vm_list", { message: "Request received", folder: folder ?? null });
  const result = await vcenter.getVMList(folder);
  logDebug("routes", "vmware_vm_list", { message: "Done", folder: folder ?? null });
  res.json(result);
});

// POST /api/vmware/vcenter/vm?action=clone  — clone VM
router.post("/vcenter/vm", async (req: Request, res: Response) => {
  const action = req.query.action;
  logDebug("routes", "vmware_vm_create", { message: "Request received", action: action ?? null });
  if (action !== "clone") {
    logError("routes", "vmware_vm_create", { message: "Only ?action=clone is supported", action: action ?? null });
    res.status(400).json({ message: "Only ?action=clone is supported on this endpoint" });
    return;
  }
  const result = await vcenter.cloneVM(req.body);
  logDebug("routes", "vmware_vm_create", { message: "Done", action: "clone" });
  res.status(201).json(result);
});

// GET  /api/vmware/vcenter/vm/:vmId         — get VM details
router.get("/vcenter/vm/:vmId", async (req: Request<{ vmId: string }>, res: Response) => {
  logDebug("routes", "vmware_vm_get", { message: "Request received", vmId: req.params.vmId });
  const result = await vcenter.getVMDetails(req.params.vmId);
  logDebug("routes", "vmware_vm_get", { message: "Done", vmId: req.params.vmId });
  res.json(result);
});

// DELETE /api/vmware/vcenter/vm/:vmId       — delete VM
router.delete("/vcenter/vm/:vmId", async (req: Request<{ vmId: string }>, res: Response) => {
  logDebug("routes", "vmware_vm_delete", { message: "Request received", vmId: req.params.vmId });
  await vcenter.deleteVM(req.params.vmId);
  logDebug("routes", "vmware_vm_delete", { message: "Done", vmId: req.params.vmId });
  res.status(204).end();
});

// GET  /api/vmware/vcenter/vm/:vmId/power   — get power state
router.get("/vcenter/vm/:vmId/power", async (req: Request<{ vmId: string }>, res: Response) => {
  logDebug("routes", "vmware_vm_power_get", { message: "Request received", vmId: req.params.vmId });
  const result = await vcenter.getPowerState(req.params.vmId);
  logDebug("routes", "vmware_vm_power_get", { message: "Done", vmId: req.params.vmId });
  res.json(result);
});

// POST /api/vmware/vcenter/vm/:vmId/power?action=start|stop|reset  — power action
router.post("/vcenter/vm/:vmId/power", async (req: Request<{ vmId: string }>, res: Response) => {
  const action = (req.query.action ?? req.body?.action) as "start" | "stop" | "reset";
  logDebug("routes", "vmware_vm_power_set", { message: "Request received", vmId: req.params.vmId, action: action ?? null });
  if (!["start", "stop", "reset"].includes(action)) {
    logError("routes", "vmware_vm_power_set", {
      message: "action must be start | stop | reset",
      vmId: req.params.vmId,
      action: action ?? null,
    });
    res.status(400).json({ message: "action must be start | stop | reset" });
    return;
  }
  await vcenter.setPowerState(req.params.vmId, action);
  logDebug("routes", "vmware_vm_power_set", { message: "Done", vmId: req.params.vmId, action });
  res.status(204).end();
});

// POST /api/vmware/vcenter/vm/:vmId/console/tickets  — WMKS console ticket
router.post("/vcenter/vm/:vmId/console/tickets", async (req: Request<{ vmId: string }>, res: Response) => {
  logDebug("routes", "vmware_console_ticket", { message: "Request received", vmId: req.params.vmId });
  const result = await vcenter.getVMConsoleTicket(req.params.vmId);
  logDebug("routes", "vmware_console_ticket", { message: "Done", vmId: req.params.vmId, hasTicket: Boolean(result?.ticket) });
  res.json(result);
});

// ── cis/tagging/category ───────────────────────────────────────────────────────

// GET  /api/vmware/cis/tagging/category
router.get("/cis/tagging/category", async (_req, res: Response) => {
  logDebug("routes", "vmware_category_list", { message: "Request received" });
  const result = await vcenter.getAllCategories();
  logDebug("routes", "vmware_category_list", { message: "Done" });
  res.json(result);
});

// POST /api/vmware/cis/tagging/category
router.post("/cis/tagging/category", async (req: Request, res: Response) => {
  logDebug("routes", "vmware_category_create", { message: "Request received", name: req.body.name });
  const result = await vcenter.createCategory(req.body.name);
  logDebug("routes", "vmware_category_create", { message: "Done" });
  res.status(201).json(result);
});

// GET  /api/vmware/cis/tagging/category/:id
router.get("/cis/tagging/category/:id", async (req: Request<{ id: string }>, res: Response) => {
  logDebug("routes", "vmware_category_get", { message: "Request received", categoryId: req.params.id });
  const result = await vcenter.getCategoryById(req.params.id);
  logDebug("routes", "vmware_category_get", { message: "Done", categoryId: req.params.id });
  res.json(result);
});

// DELETE /api/vmware/cis/tagging/category/:id
router.delete("/cis/tagging/category/:id", async (req: Request<{ id: string }>, res: Response) => {
  logDebug("routes", "vmware_category_delete", { message: "Request received", categoryId: req.params.id });
  await vcenter.deleteCategory(req.params.id);
  logDebug("routes", "vmware_category_delete", { message: "Done", categoryId: req.params.id });
  res.json({ message: "Deleted" });
});

// ── cis/tagging/tag ────────────────────────────────────────────────────────────

// GET  /api/vmware/cis/tagging/tag
router.get("/cis/tagging/tag", async (_req, res: Response) => {
  logDebug("routes", "vmware_tag_list", { message: "Request received" });
  const result = await vcenter.getAllTags();
  logDebug("routes", "vmware_tag_list", { message: "Done" });
  res.json(result);
});

// POST /api/vmware/cis/tagging/tag
router.post("/cis/tagging/tag", async (req: Request, res: Response) => {
  const { category_id, name, description } = req.body;
  logDebug("routes", "vmware_tag_create", { message: "Request received", categoryId: category_id, name });
  const result = await vcenter.createTag(category_id, name, description);
  logDebug("routes", "vmware_tag_create", { message: "Done", categoryId: category_id, name });
  res.status(201).json(result);
});

// GET  /api/vmware/cis/tagging/tag/:id
router.get("/cis/tagging/tag/:id", async (req: Request<{ id: string }>, res: Response) => {
  logDebug("routes", "vmware_tag_get", { message: "Request received", tagId: req.params.id });
  const result = await vcenter.getTagById(req.params.id);
  logDebug("routes", "vmware_tag_get", { message: "Done", tagId: req.params.id });
  res.json(result);
});

// PATCH /api/vmware/cis/tagging/tag/:id
router.patch("/cis/tagging/tag/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { name, description } = req.body as { name: string; description?: string };
  logDebug("routes", "vmware_tag_update", { message: "Request received", tagId: req.params.id, name });
  await vcenter.updateTag(req.params.id, name, description);
  logDebug("routes", "vmware_tag_update", { message: "Done", tagId: req.params.id });
  res.json({ message: "Updated" });
});

// DELETE /api/vmware/cis/tagging/tag/:id
router.delete("/cis/tagging/tag/:id", async (req: Request<{ id: string }>, res: Response) => {
  logDebug("routes", "vmware_tag_delete", { message: "Request received", tagId: req.params.id });
  await vcenter.deleteTag(req.params.id);
  logDebug("routes", "vmware_tag_delete", { message: "Done", tagId: req.params.id });
  res.json({ message: "Deleted" });
});

// ── cis/tagging/tag-association ────────────────────────────────────────────────

// POST /api/vmware/cis/tagging/tag-association?action=attach
// POST /api/vmware/cis/tagging/tag-association?action=list-attached-objects-on-tags
router.post("/cis/tagging/tag-association", async (req: Request, res: Response) => {
  const action = req.query.action as string;
  logDebug("routes", "vmware_tag_association", { message: "Request received", action: action ?? null });

  if (action === "attach") {
    const { tag_id, object_id } = req.body as { tag_id: string; object_id: { id: string; type: string } };
    logDebug("routes", "vmware_tag_association", {
      message: "Attach tag",
      action,
      tagId: tag_id,
      objectId: object_id.id,
      objectType: object_id.type,
    });
    await vcenter.attachTagToVM(object_id.id, tag_id);
    logDebug("routes", "vmware_tag_association", { message: "Done", action });
    res.json({ message: "Tag attached" });
    return;
  }

  if (action === "list-attached-objects-on-tags") {
    const { tag_ids } = req.body as { tag_ids: string[] };
    logDebug("routes", "vmware_tag_association", { message: "List attached objects", action, tagCount: tag_ids.length });
    const results = await Promise.all(tag_ids.map((id) => vcenter.listAttachedObjectsOnTags(id)));
    logDebug("routes", "vmware_tag_association", { message: "Done", action, resultCount: results.flat().length });
    res.json(results.flat());
    return;
  }

  logError("routes", "vmware_tag_association", { message: "Unsupported action", action: action ?? null });
  res.status(400).json({ message: "Unsupported action. Use: attach | list-attached-objects-on-tags" });
});

export default router;
