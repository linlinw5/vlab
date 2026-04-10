import { Router, Request, Response } from "express";
import {
  getAllGroups,
  getGroupById,
  getGroupByName,
  createGroup,
  updateGroup,
  deleteGroup,
  getClonedVmsByGroupId,
  deleteClonedVMByVmId,
  getAllUsersByGroup,
} from "../db/queries";
import { parsePage } from "../lib/pagination";
import { authenticate, requireAdmin } from "../middleware/auth";
import { createTag, getCategoryId, setPowerState, waitForPowerOff, deleteVM, deleteTag, updateTag } from "../services/vcenter";
import { asaClient } from "../services/asa/client";
import { logDebug, logError } from "../lib/logger";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/", async (req: Request, res: Response) => {
  const { page, pageSize, offset } = parsePage(req.query as Record<string, unknown>);
  logDebug("routes", "group_list", { page, pageSize });
  const result = await getAllGroups(pageSize, offset);
  logDebug("routes", "group_list", { message: "Done" });
  res.json(result);
});

router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const groupId = parseInt(req.params.id);
  logDebug("routes", "group_get", { groupId });
  const group = await getGroupById(groupId);
  if (!group) {
    logError("routes", "group_get", { groupId, message: "Group not found" });
    res.status(404).json({ message: "Group not found" });
    return;
  }
  logDebug("routes", "group_get", { groupId, message: "Done" });
  res.json(group);
});

router.post("/", async (req: Request, res: Response) => {
  const { name, description } = req.body as { name: string; description?: string };
  logDebug("routes", "group_create", { message: "Request received", name });

  // Check name uniqueness
  if (await getGroupByName(name)) {
    logError("routes", "group_create", { message: "Group name already exists", name });
    res.status(409).json({ message: `Group name "${name}" already exists` });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  try {
    logDebug("routes", "group_create", { message: "Creating vCenter tag...", name });
    emit("Creating vCenter tag...");
    const categoryId = getCategoryId();
    const vmwareTagId = await createTag(categoryId, name);

    logDebug("routes", "group_create", { message: "Saving to database...", name, vmwareTagId });
    emit("Saving to database...");
    await createGroup(name, description ?? "", vmwareTagId);

    logDebug("routes", "group_create", { message: "Done", done: true, name });
    emit("Done", true);
  } catch (err) {
    logError("routes", "group_create", {
      name,
      message: err instanceof Error ? err.message : String(err),
    });
    emit(`Error: ${(err as Error).message}`, true, true);
  }
  res.end();
});

router.put("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const groupId = parseInt(req.params.id);
  logDebug("routes", "group_update", { message: "Request received", groupId });

  if (groupId === 1) {
    logError("routes", "group_update", { groupId, message: "Cannot modify the default group" });
    res.status(403).json({ message: "Cannot modify the default group" });
    return;
  }

  const { name, description } = req.body as { name: string; description?: string };

  const existing = await getGroupById(groupId);
  if (!existing) {
    logError("routes", "group_update", { groupId, message: "Group not found" });
    res.status(404).json({ message: "Group not found" });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  try {
    if (existing.vmware_tag_id && existing.name !== name) {
      logDebug("routes", "group_update", { message: "Updating vCenter tag...", groupId, vmwareTagId: existing.vmware_tag_id });
      emit("Updating vCenter tag...");
      await updateTag(existing.vmware_tag_id, name, description);
    }

    logDebug("routes", "group_update", { message: "Saving to database...", groupId });
    emit("Saving to database...");
    await updateGroup(groupId, name, description ?? "");

    logDebug("routes", "group_update", { message: "Done", done: true, groupId });
    emit("Done", true);
  } catch (err) {
    logError("routes", "group_update", {
      groupId,
      message: err instanceof Error ? err.message : String(err),
    });
    emit(`Error: ${(err as Error).message}`, true, true);
  }
  res.end();
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const groupId = parseInt(req.params.id);
  logDebug("routes", "group_delete", { message: "Request received", groupId });

  if (groupId === 1) {
    logError("routes", "group_delete", { groupId, message: "Cannot delete the default group" });
    res.status(403).json({ message: "Cannot delete the default group" });
    return;
  }

  const group = await getGroupById(groupId);
  if (!group) {
    logError("routes", "group_delete", { groupId, message: "Group not found" });
    res.status(404).json({ message: "Group not found" });
    return;
  }

  // Stream progress via ndjson
  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  const clonedVMs = await getClonedVmsByGroupId(groupId);
  logDebug("routes", "group_delete", { message: `Found ${clonedVMs.length} VM(s) to clean up`, groupId, vmCount: clonedVMs.length });
  emit(`Found ${clonedVMs.length} VM(s) to clean up`);

  // Step 1: Power off + delete VMs
  for (const vm of clonedVMs) {
    try {
      logDebug("routes", "group_delete", { message: `Powering off ${vm.name}...`, groupId, vmId: vm.vm_id });
      emit(`Powering off ${vm.name}...`);
      await setPowerState(vm.vm_id, "stop");
      await waitForPowerOff(vm.vm_id);
    } catch {
      logDebug("routes", "group_delete", { message: `${vm.name} already off or unreachable, skipping`, groupId, vmId: vm.vm_id });
      emit(`${vm.name} already off or unreachable, skipping`);
    }

    try {
      logDebug("routes", "group_delete", { message: `Deleting ${vm.name} from vCenter...`, groupId, vmId: vm.vm_id });
      emit(`Deleting ${vm.name} from vCenter...`);
      await deleteVM(vm.vm_id);
    } catch (err) {
      logError("routes", "group_delete", {
        groupId,
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

  // Step 2: Remove VPN accounts from ASA for users in this group
  const groupUsers = await getAllUsersByGroup(groupId);
  const vpnUsers = groupUsers.filter((u) => u.vpn_enable);
  if (vpnUsers.length > 0) {
    logDebug("routes", "group_delete", {
      message: `Removing VPN for ${vpnUsers.length} user(s)...`,
      groupId,
      vpnUserCount: vpnUsers.length,
    });
    emit(`Removing VPN for ${vpnUsers.length} user(s)...`);
    try {
      await asaClient.batchDeleteUsers(vpnUsers.map((u) => u.email));
    } catch (err) {
      logError("routes", "group_delete", {
        groupId,
        message: err instanceof Error ? err.message : String(err),
      });
      emit(`Warning: failed to remove some VPN accounts: ${(err as Error).message}`, false, true);
    }
  }

  // Step 3: Delete vCenter tag
  if (group.vmware_tag_id) {
    logDebug("routes", "group_delete", { message: "Removing vCenter tag...", groupId, vmwareTagId: group.vmware_tag_id });
    emit("Removing vCenter tag...");
    await deleteTag(group.vmware_tag_id);
  }

  // Step 4: Delete group + users from DB
  logDebug("routes", "group_delete", { message: "Cleaning up database...", groupId });
  emit("Cleaning up database...");
  const result = await deleteGroup(groupId);

  logDebug("routes", "group_delete", { message: "Group deleted", groupId, done: true });
  res.end(JSON.stringify({ message: "Group deleted", done: true, ...result }) + "\n");
});

export default router;
