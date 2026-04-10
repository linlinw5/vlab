import { Router, Request, Response } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import {
  getLabById,
  getGroupById,
  getAllUsersByGroup,
  getAllAssignments,
  getAssignmentsByGroupId,
  assignLabToGroup,
  deleteAssignment,
  getAssignmentByLabAndGroup,
  createClonedVM,
  getClonedVmsByGroupIdLabId,
  deleteClonedVMByVmId,
  getUserById,
} from "../db/queries";
import { getVMDetails, cloneVM, deleteVM, setPowerState, waitForPowerOff, attachTagToVM } from "../services/vcenter";
import { config } from "../config";
import { logDebug, logError } from "../lib/logger";

const router = Router();
router.use(authenticate, requireAdmin);

function randomChars(n = 4): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + n)
    .toUpperCase();
}

type Emit = (message: string, done?: boolean, error?: boolean) => void;

// 为单个用户克隆一个 lab 内的所有 VM（供 assign 和新增用户时复用）
export async function cloneLabForUser(
  labId: number,
  groupId: number,
  userId: number,
  userEmail: string,
  emit: Emit = () => {},
): Promise<void> {
  logDebug("routes", "assign_clone_user", { message: "Request received", labId, groupId, userId, userEmail });
  const [lab, group] = await Promise.all([getLabById(labId), getGroupById(groupId)]);
  if (!lab || !group) {
    logError("routes", "assign_clone_user", { message: `Lab ${labId} or Group ${groupId} not found`, labId, groupId, userId });
    emit(`Lab ${labId} or Group ${groupId} not found`, false, true);
    return;
  }

  const vmDetailsList = await Promise.all(lab.vm_ids.map((id) => getVMDetails(id)));
  const vmDetailsMap = new Map(vmDetailsList.map((d, i) => [lab.vm_ids[i], d]));

  for (const sourceVmId of lab.vm_ids) {
    const vmDetails = vmDetailsMap.get(sourceVmId)!;
    const cloneName = `${vmDetails.name}-L${labId}-G${groupId}-U${userId}-${randomChars()}`;
    try {
      logDebug("routes", "assign_clone_user", { message: `Cloning ${cloneName} for ${userEmail}...`, labId, groupId, userId, sourceVmId });
      emit(`Cloning ${cloneName} for ${userEmail}...`);
      const { clonedVmId } = await cloneVM({
        name: cloneName,
        source: sourceVmId,
        placement: { folder: config.vmFolder.target },
      });
      await createClonedVM(cloneName, clonedVmId, labId, userId, groupId, sourceVmId);
      if (group.vmware_tag_id) {
        await attachTagToVM(clonedVmId, group.vmware_tag_id);
      }
    } catch (err) {
      logError("routes", "assign_clone_user", {
        labId,
        groupId,
        userId,
        userEmail,
        sourceVmId,
        cloneName,
        message: err instanceof Error ? err.message : String(err),
      });
      emit(`Failed to clone ${cloneName} for ${userEmail}`, false, true);
    }
  }

  logDebug("routes", "assign_clone_user", { message: "Done", labId, groupId, userId });
}

async function cloneLabForGroup(labId: number, groupId: number, emit: Emit): Promise<void> {
  logDebug("routes", "assign_clone_group", { message: "Request received", labId, groupId });
  const [lab, group, users] = await Promise.all([getLabById(labId), getGroupById(groupId), getAllUsersByGroup(groupId)]);

  if (!lab || !group) {
    logError("routes", "assign_clone_group", { message: "Lab or Group not found", labId, groupId });
    emit("Lab or Group not found", true, true);
    return;
  }

  const total = users.length * lab.vm_ids.length;
  logDebug("routes", "assign_clone_group", {
    message: `Cloning ${lab.vm_ids.length} VM(s) for ${users.length} user(s) — ${total} total`,
    labId,
    groupId,
    userCount: users.length,
    vmCount: lab.vm_ids.length,
    total,
  });
  emit(`Cloning ${lab.vm_ids.length} VM(s) for ${users.length} user(s) — ${total} total`);

  for (const user of users) {
    await cloneLabForUser(labId, groupId, user.id, user.email, emit);
  }

  logDebug("routes", "assign_clone_group", { message: "Done", labId, groupId });
}

// POST /api/assign/user — assign a lab to a single user and stream clone progress
router.post("/user", async (req: Request, res: Response) => {
  const { labId, userId } = req.body as { labId: number; userId: number };
  logDebug("routes", "assign_user", { message: "Request received", labId, userId });

  const [lab, user] = await Promise.all([getLabById(labId), getUserById(userId)]);
  if (!lab) {
    res.status(404).json({ message: "Lab not found" });
    return;
  }
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  if (!user.group_id) {
    res.status(400).json({ message: "User does not belong to any group" });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  const emit: Emit = (message, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  await cloneLabForUser(labId, user.group_id, userId, user.email, emit);

  logDebug("routes", "assign_user", { message: "Done", labId, userId });
  res.end(JSON.stringify({ message: "Assignment complete", done: true }) + "\n");
});

// GET /api/assign — list all assignments
router.get("/", async (_req: Request, res: Response) => {
  logDebug("routes", "assign_list", { message: "Request received" });
  const result = await getAllAssignments();
  logDebug("routes", "assign_list", { message: "Done" });
  res.json(result);
});

// GET /api/assign/group/:groupId — assignments for a specific group
router.get("/group/:groupId", async (req: Request<{ groupId: string }>, res: Response) => {
  const groupId = parseInt(req.params.groupId);
  logDebug("routes", "assign_group_list", { message: "Request received", groupId });
  const result = await getAssignmentsByGroupId(groupId);
  logDebug("routes", "assign_group_list", { message: "Done", groupId });
  res.json(result);
});

// POST /api/assign — assign lab to group and stream clone progress
router.post("/", async (req: Request, res: Response) => {
  const { labId, groupId } = req.body as { labId: number; groupId: number };
  logDebug("routes", "assign_create", { message: "Request received", labId, groupId });

  const existing = await getAssignmentByLabAndGroup(labId, groupId);
  if (existing) {
    logError("routes", "assign_create", { message: "Assignment already exists", labId, groupId });
    res.status(409).json({ message: "Assignment already exists" });
    return;
  }

  const assignment = await assignLabToGroup(labId, groupId);

  res.setHeader("Content-Type", "application/x-ndjson");
  const emit: Emit = (message, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  logDebug("routes", "assign_create", {
    message: `Assignment created (id=${assignment.id}), starting clone...`,
    assignmentId: assignment.id,
    labId,
    groupId,
  });
  emit(`Assignment created (id=${assignment.id}), starting clone...`);

  await cloneLabForGroup(labId, groupId, emit);

  logDebug("routes", "assign_create", { message: "Cloning complete", done: true, assignmentId: assignment.id, labId, groupId });
  res.end(JSON.stringify({ message: "Cloning complete", done: true }) + "\n");
});

// DELETE /api/assign/:id — delete assignment and clean up VMs
router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const assignmentId = parseInt(req.params.id);
  logDebug("routes", "assign_delete", { message: "Request received", assignmentId });

  const assignment = await deleteAssignment(assignmentId);
  if (!assignment) {
    logError("routes", "assign_delete", { message: "Assignment not found", assignmentId });
    res.status(404).json({ message: "Assignment not found" });
    return;
  }

  const clonedVMs = await getClonedVmsByGroupIdLabId(assignment.group_id, assignment.lab_id);

  // Stream progress via ndjson
  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  logDebug("routes", "assign_delete", { message: `Found ${clonedVMs.length} VM(s) to clean up`, assignmentId, vmCount: clonedVMs.length });
  emit(`Found ${clonedVMs.length} VM(s) to clean up`);

  for (const vm of clonedVMs) {
    try {
      logDebug("routes", "assign_delete", { message: `Powering off ${vm.name}...`, assignmentId, vmId: vm.vm_id });
      emit(`Powering off ${vm.name}...`);
      await setPowerState(vm.vm_id, "stop");
      await waitForPowerOff(vm.vm_id);
    } catch {
      logDebug("routes", "assign_delete", { message: `${vm.name} already off or unreachable, skipping`, assignmentId, vmId: vm.vm_id });
      emit(`${vm.name} already off or unreachable, skipping`);
    }

    try {
      logDebug("routes", "assign_delete", { message: `Deleting ${vm.name} from vCenter...`, assignmentId, vmId: vm.vm_id });
      emit(`Deleting ${vm.name} from vCenter...`);
      await deleteVM(vm.vm_id);
    } catch (err) {
      logError("routes", "assign_delete", {
        assignmentId,
        vmId: vm.vm_id,
        vmName: vm.name,
        message: err instanceof Error ? err.message : String(err),
      });
      res.end(
        JSON.stringify({ message: `Failed to delete ${vm.name} from vCenter: ${(err as Error).message}`, done: true, error: true }) + "\n",
      );
      return;
    }
    await deleteClonedVMByVmId(vm.vm_id);
  }

  logDebug("routes", "assign_delete", { message: "Assignment deleted", done: true, assignmentId });
  res.end(JSON.stringify({ message: "Assignment deleted", done: true }) + "\n");
});

export default router;
