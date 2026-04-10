import VCenterClient from "./api-client";

const client = new VCenterClient();

export type VMPowerState = "POWERED_ON" | "POWERED_OFF" | "SUSPENDED";

export interface VMSummary {
  vm: string;
  name: string;
  power_state: VMPowerState;
  cpu_count: number;
  memory_size_MiB: number;
}

export interface VMDetails {
  vm: string;
  name: string;
  power_state: VMPowerState;
  memory: {
    size_MiB: number;
  };
  cpu: {
    count: number;
  };
  guest_OS: string;
}

export interface PowerState {
  state: VMPowerState;
  clean_power_off?: boolean;
}

export interface CloneSpec {
  name: string;
  source: string;
  placement: {
    folder: string;
  };
}

export async function getVMList(folder?: string): Promise<VMSummary[]> {
  const url = folder ? `/api/vcenter/vm?folders=${encodeURIComponent(folder)}` : "/api/vcenter/vm";
  return client.get<VMSummary[]>(url);
}

export async function getVMDetails(vmId: string): Promise<VMDetails> {
  return client.get<VMDetails>(`/api/vcenter/vm/${vmId}`);
}

export async function getPowerState(vmId: string): Promise<PowerState> {
  return client.get<PowerState>(`/api/vcenter/vm/${vmId}/power`);
}

export async function setPowerState(vmId: string, action: "start" | "stop" | "reset"): Promise<void> {
  // Fire-and-forget：命令发给 VMware 即返回，不等待响应（VMware 电源 API 不保证回包）
  client.fireAndForget("POST", `/api/vcenter/vm/${vmId}/power?action=${action}`);
}

export async function deleteVM(vmId: string): Promise<void> {
  await client.delete(`/api/vcenter/vm/${vmId}`);
}

/**
 * Polls power state until POWERED_OFF or timeout.
 * @param intervalMs - polling interval in ms (default 2s)
 * @param maxAttempts - max poll attempts (default 30, i.e. ~60s)
 */
export async function waitForPowerOff(vmId: string, intervalMs = 2000, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const { state } = await getPowerState(vmId);
    if (state === "POWERED_OFF") return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`VM ${vmId} did not power off within ${(intervalMs * maxAttempts) / 1000}s`);
}

export async function cloneVM(cloneSpec: CloneSpec): Promise<{ success: boolean; clonedVmId: string }> {
  const cloneClient = new VCenterClient(120_000);
  const clonedVmId = await cloneClient.post<string>("/api/vcenter/vm?action=clone", cloneSpec);
  return { success: true, clonedVmId };
}

export async function getVMConsoleTicket(vmId: string): Promise<{ ticket: string }> {
  const res = await client.post<{ value: { ticket: string } }>(`/rest/vcenter/vm/${vmId}/console/tickets`, { spec: { type: "WEBMKS" } });
  return res.value;
}
