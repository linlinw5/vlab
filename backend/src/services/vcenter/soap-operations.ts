import { logDebug } from "../../lib/logger";
import { soapClient, extractTag, extractMoRef, extractPropVal, extractPropMoRef } from "./soap-client";

const TASK_POLL_INTERVAL = 2_000;
const TASK_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export interface SnapshotInfo {
  id: string;
  name: string;
  description: string;
  createTime: string;
  isCurrent: boolean;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function retrieveVmProp(vmId: string, ...paths: string[]): Promise<string> {
  const pathSet = paths.map((p) => `<vim25:pathSet>${p}</vim25:pathSet>`).join("\n");
  return soapClient.call(
    "RetrievePropertiesEx",
    `<vim25:_this type="PropertyCollector">${soapClient.propertyCollectorMoRef}</vim25:_this>
     <vim25:specSet>
       <vim25:propSet>
         <vim25:type>VirtualMachine</vim25:type>
         <vim25:all>false</vim25:all>
         ${pathSet}
       </vim25:propSet>
       <vim25:objectSet>
         <vim25:obj type="VirtualMachine">${vmId}</vim25:obj>
         <vim25:skip>false</vim25:skip>
       </vim25:objectSet>
     </vim25:specSet>
     <vim25:options/>`,
  );
}

async function waitForTask(taskId: string): Promise<string | null> {
  const deadline = Date.now() + TASK_TIMEOUT;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL));

    const xml = await soapClient.call(
      "RetrievePropertiesEx",
      `<vim25:_this type="PropertyCollector">${soapClient.propertyCollectorMoRef}</vim25:_this>
       <vim25:specSet>
         <vim25:propSet>
           <vim25:type>Task</vim25:type>
           <vim25:all>false</vim25:all>
           <vim25:pathSet>info.state</vim25:pathSet>
           <vim25:pathSet>info.result</vim25:pathSet>
           <vim25:pathSet>info.error</vim25:pathSet>
         </vim25:propSet>
         <vim25:objectSet>
           <vim25:obj type="Task">${taskId}</vim25:obj>
           <vim25:skip>false</vim25:skip>
         </vim25:objectSet>
       </vim25:specSet>
       <vim25:options/>`,
    );

    const state = extractPropVal(xml, "info.state");
    logDebug("vmware", "soap_task_poll", { taskId, state });

    if (state === "success") {
      return extractPropMoRef(xml, "info.result");
    }
    if (state === "error") {
      const errMsg = extractTag(xml, "localizedMessage") ?? extractTag(xml, "faultstring") ?? "Task failed";
      throw new Error(errMsg);
    }
  }

  throw new Error(`Task ${taskId} timed out after ${TASK_TIMEOUT / 1000}s`);
}

async function getCurrentSnapshotMoRef(vmId: string): Promise<string> {
  const xml = await retrieveVmProp(vmId, "snapshot.currentSnapshot");
  const moRef = extractPropMoRef(xml, "snapshot.currentSnapshot");
  if (!moRef) throw new Error(`VM ${vmId} has no current snapshot — create a snapshot before using linked clone`);
  return moRef;
}

async function getVmDatastore(vmId: string): Promise<string> {
  const xml = await retrieveVmProp(vmId, "datastore");
  const m = xml.match(/type="Datastore"[^>]*>([^<]+)</);
  if (!m) throw new Error(`Could not determine datastore for VM ${vmId}`);
  return m[1].trim();
}

async function getVmHost(vmId: string): Promise<string> {
  const xml = await retrieveVmProp(vmId, "runtime.host");
  const moRef = extractPropMoRef(xml, "runtime.host");
  if (!moRef) throw new Error(`Could not determine host for VM ${vmId}`);
  return moRef;
}

// ─── Public operations ───────────────────────────────────────────────────────

export async function linkedCloneVM(sourceVmId: string, name: string, folderId: string): Promise<string> {
  const [snapshotMoRef, datastoreMoRef, hostMoRef] = await Promise.all([
    getCurrentSnapshotMoRef(sourceVmId),
    getVmDatastore(sourceVmId),
    getVmHost(sourceVmId),
  ]);

  logDebug("vmware", "soap_linked_clone_placement", { datastoreMoRef, hostMoRef, snapshotMoRef });

  const xml = await soapClient.call(
    "CloneVM_Task",
    `<vim25:_this type="VirtualMachine">${sourceVmId}</vim25:_this>
     <vim25:folder type="Folder">${folderId}</vim25:folder>
     <vim25:name>${name}</vim25:name>
     <vim25:spec>
       <vim25:location>
         <vim25:datastore type="Datastore">${datastoreMoRef}</vim25:datastore>
         <vim25:diskMoveType>createNewChildDiskBacking</vim25:diskMoveType>
         <vim25:host type="HostSystem">${hostMoRef}</vim25:host>
       </vim25:location>
       <vim25:template>false</vim25:template>
       <vim25:powerOn>false</vim25:powerOn>
       <vim25:snapshot type="VirtualMachineSnapshot">${snapshotMoRef}</vim25:snapshot>
     </vim25:spec>`,
    10 * 60 * 1000,
  );

  const taskId = extractMoRef(xml, "returnval");
  if (!taskId) throw new Error("CloneVM_Task returned no task MoRef");

  const newVmId = await waitForTask(taskId);
  if (!newVmId) throw new Error("CloneVM_Task succeeded but returned no VM MoRef");
  return newVmId;
}

export async function createSnapshot(vmId: string, name: string, description = ""): Promise<void> {
  const xml = await soapClient.call(
    "CreateSnapshot_Task",
    `<vim25:_this type="VirtualMachine">${vmId}</vim25:_this>
     <vim25:name>${name}</vim25:name>
     <vim25:description>${description}</vim25:description>
     <vim25:memory>false</vim25:memory>
     <vim25:quiesce>false</vim25:quiesce>`,
  );

  const taskId = extractMoRef(xml, "returnval");
  if (!taskId) throw new Error("CreateSnapshot_Task returned no task MoRef");
  await waitForTask(taskId);
}

export async function revertToCurrentSnapshot(vmId: string): Promise<void> {
  const xml = await soapClient.call(
    "RevertToCurrentSnapshot_Task",
    `<vim25:_this type="VirtualMachine">${vmId}</vim25:_this>
     <vim25:suppressPowerOn>false</vim25:suppressPowerOn>`,
  );

  const taskId = extractMoRef(xml, "returnval");
  if (!taskId) throw new Error("RevertToCurrentSnapshot_Task returned no task MoRef");
  await waitForTask(taskId);
}

export async function removeAllSnapshots(vmId: string): Promise<void> {
  const xml = await soapClient.call(
    "RemoveAllSnapshots_Task",
    `<vim25:_this type="VirtualMachine">${vmId}</vim25:_this>
     <vim25:consolidate>true</vim25:consolidate>`,
  );

  const taskId = extractMoRef(xml, "returnval");
  if (!taskId) throw new Error("RemoveAllSnapshots_Task returned no task MoRef");
  await waitForTask(taskId);
}

export async function listSnapshots(vmId: string): Promise<SnapshotInfo[]> {
  const xml = await retrieveVmProp(vmId, "snapshot");

  const currentId = extractPropMoRef(xml, "snapshot.currentSnapshot") ?? "";

  const results: SnapshotInfo[] = [];
  const snapshotRegex =
    /<snapshot\s[^>]*type="VirtualMachineSnapshot"[^>]*>([^<]+)<\/snapshot>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<description>([^<]*)<\/description>[\s\S]*?<createTime>([^<]+)<\/createTime>/g;

  let m: RegExpExecArray | null;
  while ((m = snapshotRegex.exec(xml)) !== null) {
    results.push({
      id: m[1].trim(),
      name: m[2].trim(),
      description: m[3].trim(),
      createTime: m[4].trim(),
      isCurrent: m[1].trim() === currentId,
    });
  }

  return results;
}
