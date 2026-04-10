import { Router, Request, Response } from "express";
import {
  getAllLabs,
  getLabById,
  getLabsByGroupId,
  createLab,
  updateLab,
  deleteLab,
  getAssignmentsByLabId,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../db/queries";
import { authenticate, requireAdmin } from "../middleware/auth";
import { config } from "../config";
import { logDebug, logError } from "../lib/logger";

const router = Router();
router.use(authenticate);

// GET /api/labs — admins see all; regular users see only their group's labs
router.get("/", async (req: Request, res: Response) => {
  const user = req.user!;
  logDebug("routes", "lab_list", { message: "Request received", userId: user.userId, roleId: user.roleId, groupId: user.groupId ?? null });
  if (user.roleId === config.roles.admin || user.roleId === config.roles.advanced) {
    const result = await getAllLabs();
    logDebug("routes", "lab_list", { message: "Done", scope: "all" });
    res.json(result);
  } else {
    const groupId = user.groupId;
    if (!groupId) {
      logDebug("routes", "lab_list", { message: "Done", scope: "group", groupId: null, count: 0 });
      res.json([]);
      return;
    }
    const result = await getLabsByGroupId(groupId);
    logDebug("routes", "lab_list", { message: "Done", scope: "group", groupId });
    res.json(result);
  }
});

// --- Categories --- (must be before /:id)
router.get("/categories", async (_req: Request, res: Response) => {
  logDebug("routes", "lab_category_list", { message: "Request received" });
  const result = await getAllCategories();
  logDebug("routes", "lab_category_list", { message: "Done" });
  res.json(result);
});

router.post("/categories", requireAdmin, async (req: Request, res: Response) => {
  logDebug("routes", "lab_category_create", { message: "Request received", name: req.body.name });
  const cat = await createCategory(req.body.name);
  logDebug("routes", "lab_category_create", { message: "Done", categoryId: cat.id, name: cat.name });
  res.status(201).json(cat);
});

router.put("/categories/:id", requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const categoryId = parseInt(req.params.id);
  logDebug("routes", "lab_category_update", { message: "Request received", categoryId, name: req.body.name });
  const cat = await updateCategory(categoryId, req.body.name);
  if (!cat) {
    logError("routes", "lab_category_update", { message: "Category not found", categoryId });
    res.status(404).json({ message: "Category not found" });
    return;
  }
  logDebug("routes", "lab_category_update", { message: "Done", categoryId });
  res.json(cat);
});

router.delete("/categories/:id", requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const categoryId = parseInt(req.params.id);
  logDebug("routes", "lab_category_delete", { message: "Request received", categoryId });
  const cat = await deleteCategory(categoryId);
  if (!cat) {
    logError("routes", "lab_category_delete", { message: "Category not found", categoryId });
    res.status(404).json({ message: "Category not found" });
    return;
  }
  logDebug("routes", "lab_category_delete", { message: "Done", categoryId });
  res.json(cat);
});

// --- Labs CRUD --- (dynamic /:id routes last)
router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const labId = parseInt(req.params.id);
  logDebug("routes", "lab_get", { message: "Request received", labId });
  const lab = await getLabById(labId);
  if (!lab) {
    logError("routes", "lab_get", { message: "Lab not found", labId });
    res.status(404).json({ message: "Lab not found" });
    return;
  }
  logDebug("routes", "lab_get", { message: "Done", labId });
  res.json(lab);
});

router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { title, description, link, categoryId, vmIds } = req.body;
  logDebug("routes", "lab_create", { message: "Request received", title, categoryId: categoryId ?? null, vmCount: vmIds?.length ?? 0 });
  const lab = await createLab(title, description ?? "", link ?? "", categoryId ?? null, vmIds ?? []);
  logDebug("routes", "lab_create", { message: "Done", labId: lab.id, title: lab.title });
  res.status(201).json(lab);
});

router.put("/:id", requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const labId = parseInt(req.params.id);
  const { title, description, link, categoryId, vmIds } = req.body;
  logDebug("routes", "lab_update", {
    message: "Request received",
    labId,
    title,
    categoryId: categoryId ?? null,
    vmCount: vmIds?.length ?? 0,
  });
  const lab = await updateLab(labId, title, description ?? "", link ?? "", categoryId ?? null, vmIds ?? []);
  if (!lab) {
    logError("routes", "lab_update", { message: "Lab not found", labId });
    res.status(404).json({ message: "Lab not found" });
    return;
  }
  logDebug("routes", "lab_update", { message: "Done", labId });
  res.json(lab);
});

router.delete("/:id", requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const labId = parseInt(req.params.id);
  logDebug("routes", "lab_delete", { message: "Request received", labId });

  const assignments = await getAssignmentsByLabId(labId);
  if (assignments.length > 0) {
    logError("routes", "lab_delete", { message: "Cannot delete lab with active assignments", labId, assignmentCount: assignments.length });
    res.status(409).json({
      message: `Cannot delete lab: ${assignments.length} active assignment(s) exist. Remove all assignments first.`,
      assignments,
    });
    return;
  }

  const lab = await deleteLab(labId);
  if (!lab) {
    logError("routes", "lab_delete", { message: "Lab not found", labId });
    res.status(404).json({ message: "Lab not found" });
    return;
  }
  logDebug("routes", "lab_delete", { message: "Done", labId });
  res.json(lab);
});

export default router;
