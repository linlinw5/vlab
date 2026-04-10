import { Router, Request, Response } from "express";
import {
  getAllUsersByGroup,
  getPaginatedUsersByGroup,
  getUserById,
  createUser,
  updateUserInfo,
  deleteUsers,
  resetUserPasswords,
  enableVPN,
  disableVPN,
  getAllGroups,
  getClonedVmsByUserId,
  deleteClonedVMByVmId,
  getGroupById,
  getAssignmentsByGroupId,
} from "../db/queries";
import { parsePage } from "../lib/pagination";
import { authenticate, requireAdmin } from "../middleware/auth";
import { asaClient } from "../services/asa/client";
import { setPowerState, waitForPowerOff, deleteVM } from "../services/vcenter";
import pool from "../db/client";
import { cloneLabForUser } from "./assign";
import { logDebug, logError } from "../lib/logger";

const router = Router();
router.use(authenticate);

type Emit = (message: string, done?: boolean, error?: boolean) => void;

async function cloneAssignedLabsForNewUser(userId: number, groupId: number, userEmail: string, emit: Emit = () => {}): Promise<void> {
  const assignments = await getAssignmentsByGroupId(groupId);
  logDebug("routes", "clone_assigned_labs", {
    userId,
    groupId,
    userEmail,
    message: "Assignments loaded",
    assignmentCount: assignments.length,
  });
  if (assignments.length === 0) return;

  for (const assignment of assignments) {
    try {
      await cloneLabForUser(assignment.lab_id, groupId, userId, userEmail, emit);
    } catch (err) {
      logError("routes", "clone_lab_failed", {
        userId,
        groupId,
        userEmail,
        labId: assignment.lab_id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logDebug("routes", "clone_assigned_labs", {
    userId,
    groupId,
    userEmail,
    message: "Done",
  });
}

// GET /api/users?groupId=x&page=1&pageSize=20
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  const { page, pageSize, offset } = parsePage(req.query as Record<string, unknown>);
  const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
  logDebug("routes", "user_list", { message: "Request received", page, pageSize, groupId: groupId ?? null });
  if (groupId) {
    const result = await getPaginatedUsersByGroup(groupId, pageSize, offset);
    logDebug("routes", "user_list", { message: "Done", groupId });
    res.json(result);
  } else {
    const result = await getAllGroups(pageSize, offset);
    logDebug("routes", "user_list", { message: "Done", groupId: null });
    res.json(result);
  }
});

// GET /api/users/:id
router.get("/:id", requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const userId = parseInt(req.params.id);
  logDebug("routes", "user_get", { message: "Request received", userId });
  const user = await getUserById(userId);
  if (!user) {
    logError("routes", "user_get", { userId, message: "User not found" });
    res.status(404).json({ message: "User not found" });
    return;
  }
  logDebug("routes", "user_get", { userId, message: "Done" });
  res.json(user);
});

// POST /api/users — create single user
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { username, password, email, roleId, groupId } = req.body;
  logDebug("routes", "user_create", { message: "Request received", username, email, roleId, groupId: groupId ?? null });
  const user = await createUser(username, password, email, roleId, groupId ?? null);
  logDebug("routes", "user_create", { userId: user.id, message: "Done" });
  res.status(201).json(user);
});

// POST /api/users/quick — 快速创建单个用户，email 自动生成为 username@groupName.local（流式）
router.post("/quick", requireAdmin, async (req: Request, res: Response) => {
  const { username, password, groupId } = req.body as { username: string; password: string; groupId: number };
  logDebug("routes", "quick_create", { message: "Request received", username, groupId });
  if (!username || !password || !groupId) {
    logError("routes", "quick_create", { message: "Missing required fields", username, groupId });
    res.status(400).json({ message: "username, password and groupId are required" });
    return;
  }
  const group = await getGroupById(groupId);
  if (!group) {
    logError("routes", "quick_create", { message: "Group not found", groupId });
    res.status(404).json({ message: "Group not found" });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  const email = `${username}@${group.name}.local`;
  const user = await createUser(username, password, email, 3, groupId);
  logDebug("routes", "quick_create", { message: "User created", userId: user.id, username, email, groupId });
  logDebug("routes", "quick_create", { message: `User ${username} created` });
  emit(`User ${username} created`);

  await cloneAssignedLabsForNewUser(user.id, groupId, email, emit);

  logDebug("routes", "quick_create", { message: "Done", done: true });
  res.end(JSON.stringify({ message: "Done", done: true }) + "\n");
});

// POST /api/users/batch — 批量创建用户，用户名为 prefixSS~prefixEE，最多 60 个（流式）
router.post("/batch", requireAdmin, async (req: Request, res: Response) => {
  const {
    prefix,
    password,
    groupId,
    count,
    start = 1,
  } = req.body as { prefix: string; password: string; groupId: number; count: number; start?: number };
  if (!prefix || !password || !groupId || !count) {
    logError("routes", "batch_create", { message: "Missing required fields", prefix, groupId, count });
    res.status(400).json({ message: "prefix, password, groupId and count are required" });
    return;
  }
  const group = await getGroupById(groupId);
  if (!group) {
    logError("routes", "batch_create", { message: "Group not found", groupId });
    res.status(404).json({ message: "Group not found" });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  const total = Math.min(parseInt(String(count)), 60);
  const from = parseInt(String(start));
  logDebug("routes", "batch_create", { message: "Request received", prefix, groupId, requestedCount: count, total, from });

  logDebug("routes", "batch_create", { message: `Creating ${total} users...` });
  emit(`Creating ${total} users...`);
  const created: { id: number; email: string }[] = [];
  for (let i = 0; i < total; i++) {
    const num = (from + i).toString().padStart(2, "0");
    const username = `${prefix}${num}`;
    const email = `${username}@${group.name}.local`;
    const user = await createUser(username, password, email, 3, groupId);
    created.push(user);
  }
  logDebug("routes", "batch_create", { message: "Users created", groupId, createdCount: created.length });
  logDebug("routes", "batch_create", { message: `${created.length} users created, cloning VMs...` });
  emit(`${created.length} users created, cloning VMs...`);

  for (const user of created) {
    await cloneAssignedLabsForNewUser(user.id, groupId, user.email, emit);
  }

  logDebug("routes", "batch_create", { message: `Done — ${created.length} users created`, done: true });
  res.end(JSON.stringify({ message: `Done — ${created.length} users created`, done: true }) + "\n");
});

// PUT /api/users/:id
router.put("/:id", requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const { username, roleId, groupId } = req.body;
  const userId = parseInt(req.params.id);
  logDebug("routes", "user_update", { userId, username, roleId, groupId: groupId ?? null });
  await updateUserInfo(userId, username, roleId, groupId ?? null);
  logDebug("routes", "user_update", { userId, message: "Done" });
  res.json({ message: "Updated" });
});

// DELETE /api/users  body: { userIds: number[] }
router.delete("/", requireAdmin, async (req: Request, res: Response) => {
  const { userIds } = req.body as { userIds: number[] };
  logDebug("routes", "user_delete", { message: "Request received", userCount: userIds?.length ?? 0 });

  // Stream progress via ndjson
  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  for (const userId of userIds) {
    const user = await getUserById(userId);
    if (!user) {
      logError("routes", "user_delete", { message: `User ${userId} not found, skipping`, userId });
      emit(`User ${userId} not found, skipping`, false, true);
      continue;
    }

    // Step 1: Power off + delete cloned VMs
    const clonedVMs = await getClonedVmsByUserId(userId);
    logDebug("routes", "user_delete", { message: "Loaded user VMs", userId, vmCount: clonedVMs.length });
    for (const vm of clonedVMs) {
      try {
        logDebug("routes", "user_delete", { message: `Powering off ${vm.name}...`, userId, vmId: vm.vm_id });
        emit(`Powering off ${vm.name}...`);
        await setPowerState(vm.vm_id, "stop");
        await waitForPowerOff(vm.vm_id);
      } catch {
        logDebug("routes", "user_delete", { message: `${vm.name} already off or unreachable, skipping`, userId, vmId: vm.vm_id });
        emit(`${vm.name} already off or unreachable, skipping`);
      }
      try {
        logDebug("routes", "user_delete", { message: `Deleting ${vm.name} from vCenter...`, userId, vmId: vm.vm_id });
        emit(`Deleting ${vm.name} from vCenter...`);
        await deleteVM(vm.vm_id);
      } catch (err) {
        logError("routes", "user_delete", {
          userId,
          vmId: vm.vm_id,
          vmName: vm.name,
          message: err instanceof Error ? err.message : String(err),
        });
        res.end(
          JSON.stringify({ message: `Failed to delete ${vm.name} from vCenter: ${(err as Error).message}`, done: true, error: true }) +
            "\n",
        );
        return;
      }
      await deleteClonedVMByVmId(vm.vm_id);
    }

    // Step 2: Remove VPN from ASA if enabled
    if (user.vpn_enable) {
      try {
        logDebug("routes", "user_delete", { message: `Removing VPN for ${user.email}...`, userId, email: user.email });
        emit(`Removing VPN for ${user.email}...`);
        await asaClient.deleteUser(user.email);
      } catch (err) {
        logError("routes", "user_delete", {
          message: `Failed to remove VPN for ${user.email}`,
          userId,
          email: user.email,
          error: err instanceof Error ? err.message : String(err),
        });
        emit(`Failed to remove VPN for ${user.email}: ${(err as Error).message}`, false, true);
      }
    }
  }

  // Step 3: Delete from DB
  logDebug("routes", "user_delete", { message: "Cleaning up database..." });
  emit("Cleaning up database...");
  await deleteUsers(userIds);

  logDebug("routes", "user_delete", { message: `Deleted ${userIds.length} user(s)`, done: true });
  res.end(JSON.stringify({ message: `Deleted ${userIds.length} user(s)`, done: true }) + "\n");
});

// POST /api/users/password/reset  body: { userIds, newPassword }  — admin batch reset
router.post("/password/reset", requireAdmin, async (req: Request, res: Response) => {
  const { userIds, newPassword } = req.body;
  logDebug("routes", "password_reset", { message: "Request received", userCount: userIds?.length ?? 0 });
  await resetUserPasswords(userIds, newPassword);
  logDebug("routes", "password_reset", { message: "Done" });
  res.json({ message: "Passwords reset" });
});

// POST /api/users/vpn  body: { userIds, vpnPassword }  — admin batch enable (streaming)
router.post("/vpn", requireAdmin, async (req: Request, res: Response) => {
  const { userIds, vpnPassword } = req.body;
  logDebug("routes", "vpn_enable", { message: "Request received", userCount: userIds?.length ?? 0 });
  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  try {
    const { rows } = await pool.query("SELECT id, email FROM users WHERE id = ANY($1)", [userIds]);
    const users = rows as { id: number; email: string }[];
    logDebug("routes", "vpn_enable", { message: "Users loaded", userCount: users.length });

    logDebug("routes", "vpn_enable", { message: "Enabling VPN on Cisco ASA..." });
    emit("Enabling VPN on Cisco ASA...");
    await asaClient.batchAddUsers(users.map((u) => ({ username: u.email, password: vpnPassword })));

    logDebug("routes", "vpn_enable", { message: "Writing VPN state to database..." });
    emit("Writing VPN state to database...");
    //延迟1秒
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await enableVPN(userIds, vpnPassword);

    logDebug("routes", "vpn_enable", { message: "Done", done: true });
    emit("Done", true);
  } catch (err) {
    logError("routes", "vpn_enable", {
      userCount: userIds?.length ?? 0,
      message: err instanceof Error ? err.message : String(err),
    });
    emit(`Error: ${(err as Error).message}`, true, true);
  }
  res.end();
});

// DELETE /api/users/vpn  body: { userIds }  — admin batch disable (streaming)
router.delete("/vpn", requireAdmin, async (req: Request, res: Response) => {
  const { userIds } = req.body;
  logDebug("routes", "vpn_disable", { message: "Request received", userCount: userIds?.length ?? 0 });
  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (message: string, done = false, error = false) => res.write(JSON.stringify({ message, done, error }) + "\n");

  try {
    const { rows } = await pool.query("SELECT email FROM users WHERE id = ANY($1)", [userIds]);
    logDebug("routes", "vpn_disable", { message: "Users loaded", userCount: rows.length });

    logDebug("routes", "vpn_disable", { message: "Disabling VPN on Cisco ASA..." });
    emit("Disabling VPN on Cisco ASA...");
    await asaClient.batchDeleteUsers(rows.map((u: { email: string }) => u.email));

    logDebug("routes", "vpn_disable", { message: "Writing VPN state to database..." });
    emit("Writing VPN state to database...");
    //延迟1秒
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await disableVPN(userIds);

    logDebug("routes", "vpn_disable", { message: "Done", done: true });
    emit("Done", true);
  } catch (err) {
    logError("routes", "vpn_disable", {
      userCount: userIds?.length ?? 0,
      message: err instanceof Error ? err.message : String(err),
    });
    emit(`Error: ${(err as Error).message}`, true, true);
  }
  res.end();
});

export default router;
