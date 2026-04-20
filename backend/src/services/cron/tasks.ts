import CronTaskManager from "./task-manager";
import { getVMList, setPowerState } from "../vcenter";
import { config } from "../../config";
import { logDebug, logError } from "../../lib/logger";
import { getAllUsersByGroup, getClonedVmsByUserId } from "../../db/queries";

const taskManager = new CronTaskManager();

async function shutdownAllUserVMs(): Promise<void> {
  logDebug("cron", "cron_shutdown_vms", { message: "Shutting down all user VMs..." });
  const vms = await getVMList(config.vmFolder.target);
  logDebug("cron", "cron_shutdown_vms", { message: "Loaded VMs", vmCount: vms.length });
  for (const vm of vms) {
    if (vm.power_state === "POWERED_ON") {
      try {
        await setPowerState(vm.vm, "stop");
        logDebug("cron", "cron_shutdown_vms", { message: "Shutdown submitted", vmId: vm.vm, vmName: vm.name });
      } catch (err) {
        logError("cron", "cron_shutdown_vms", {
          message: err instanceof Error ? err.message : String(err),
          vmId: vm.vm,
          vmName: vm.name,
        });
      }
    }
  }
  logDebug("cron", "cron_shutdown_vms", { message: "Shutdown task complete." });
}

// 仅用于测试：每分钟关闭 group1 用户的虚拟机
async function shutdownGroup1UserVMsForTest(): Promise<void> {
  logDebug("cron", "cron_shutdown_group1_test", { message: "Shutting down group1 user VMs for test" });
  const users = await getAllUsersByGroup(1);
  logDebug("cron", "cron_shutdown_group1_test", { message: "Loaded users", userCount: users.length });

  for (const user of users) {
    const clonedVMs = await getClonedVmsByUserId(user.id);
    logDebug("cron", "cron_shutdown_group1_test", {
      message: "Loaded user VMs",
      userId: user.id,
      userEmail: user.email,
      vmCount: clonedVMs.length,
    });

    for (const vm of clonedVMs) {
      try {
        await setPowerState(vm.vm_id, "stop");
        logDebug("cron", "cron_shutdown_group1_test", {
          message: "Shutdown submitted",
          userId: user.id,
          userEmail: user.email,
          vmId: vm.vm_id,
          vmName: vm.name,
        });
      } catch (err) {
        logError("cron", "cron_shutdown_group1_test", {
          message: err instanceof Error ? err.message : String(err),
          userId: user.id,
          userEmail: user.email,
          vmId: vm.vm_id,
          vmName: vm.name,
        });
      }
    }
  }

  logDebug("cron", "cron_shutdown_group1_test", { message: "Test shutdown task complete" });
}

taskManager.registerTask("shutdown-vms", "0 22 * * *", shutdownAllUserVMs, "shutdown all user VMs at 10 PM daily", {
  timezone: "Asia/Shanghai",
});
// taskManager.registerTask(
//   "shutdown-group1-vms-test",
//   "* * * * *",
//   shutdownGroup1UserVMsForTest,
//   "test only: shutdown group1 user VMs every minute",
//   {
//     timezone: "Asia/Shanghai",
//     enabled: false,
//   },
// );

export default taskManager;
