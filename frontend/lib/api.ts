import type { Paginated, User, Group, Lab, Category, Assignment, ClonedVM, PowerState, CronTask } from "@/types";

export interface ProxyOption {
  label: string;
  port: number;
}

const API_BASE = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface StreamLine {
  message: string;
  done?: boolean;
  error?: boolean;
}

// 用单一 Promise 替代布尔锁：并发的 401 都等待同一次 refresh，而不是直接返回 false 触发重定向
let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  } finally {
    refreshPromise = null;
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh();
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 401) {
    // 登录接口本身返回 401 时，直接把错误抛给调用方显示，不要自动刷新或跳回登录页。
    if (path === "/auth/login" || path === "/auth/refresh") {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(res.status, body.message ?? res.statusText);
    }

    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...options.headers },
      });
      if (!retry.ok) {
        if (typeof window !== "undefined") window.location.href = "/auth";
        throw new ApiError(retry.status, "Unauthorized");
      }
      return retry.json();
    }
    if (typeof window !== "undefined") window.location.href = "/auth";
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function streamRequest(path: string, options: RequestInit, onLine: (line: StreamLine) => void): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      if (typeof window !== "undefined") window.location.href = "/auth";
      throw new ApiError(401, "Unauthorized");
    }
    return streamRequest(path, options, onLine);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onLine(JSON.parse(line) as StreamLine);
    }
  }
  if (buffer.trim()) onLine(JSON.parse(buffer) as StreamLine);
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  refresh: () => request("/auth/refresh", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) => request("/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) }),
};

// Users
export const users = {
  list: (groupId: number, page = 1, pageSize = 20) =>
    request<Paginated<User>>(`/users?groupId=${groupId}&page=${page}&pageSize=${pageSize}`),
  get: (id: number) => request<User>(`/users/${id}`),
  create: (body: object) => request("/users", { method: "POST", body: JSON.stringify(body) }),
  createQuick: (username: string, password: string, groupId: number, onLine: (l: StreamLine) => void) =>
    streamRequest("/users/quick", { method: "POST", body: JSON.stringify({ username, password, groupId }) }, onLine),
  createBatch: (prefix: string, password: string, groupId: number, count: number, start = 1, onLine: (l: StreamLine) => void) =>
    streamRequest("/users/batch", { method: "POST", body: JSON.stringify({ prefix, password, groupId, count, start }) }, onLine),
  update: (id: number, body: object) => request(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (userIds: number[], onLine: (l: StreamLine) => void) =>
    streamRequest("/users", { method: "DELETE", body: JSON.stringify({ userIds }) }, onLine),
  resetPassword: (userIds: number[], newPassword: string) =>
    request("/users/password/reset", { method: "POST", body: JSON.stringify({ userIds, newPassword }) }),
  enableVPN: (userIds: number[], vpnPassword: string, onLine: (l: StreamLine) => void) =>
    streamRequest("/users/vpn", { method: "POST", body: JSON.stringify({ userIds, vpnPassword }) }, onLine),
  disableVPN: (userIds: number[], onLine: (l: StreamLine) => void) =>
    streamRequest("/users/vpn", { method: "DELETE", body: JSON.stringify({ userIds }) }, onLine),
};

// Groups
export const groups = {
  list: (page = 1, pageSize = 20) => request<Paginated<Group>>(`/groups?page=${page}&pageSize=${pageSize}`),
  listAll: () => request<Paginated<Group>>("/groups?page=1&pageSize=100"),
  get: (id: number) => request<Group>(`/groups/${id}`),
  create: (body: object, onLine: (l: StreamLine) => void) =>
    streamRequest("/groups", { method: "POST", body: JSON.stringify(body) }, onLine),
  update: (id: number, body: object, onLine: (l: StreamLine) => void) =>
    streamRequest(`/groups/${id}`, { method: "PUT", body: JSON.stringify(body) }, onLine),
  delete: (id: number, onLine: (l: StreamLine) => void) => streamRequest(`/groups/${id}`, { method: "DELETE" }, onLine),
};

// Labs
export const labs = {
  list: (groupId?: number) => request<Lab[]>(`/labs${groupId ? `?groupId=${groupId}` : ""}`),
  get: (id: number) => request<Lab>(`/labs/${id}`),
  create: (body: object) => request("/labs", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => request(`/labs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: number) => request(`/labs/${id}`, { method: "DELETE" }),
  categories: () => request<Category[]>("/labs/categories"),
  createCategory: (name: string) => request("/labs/categories", { method: "POST", body: JSON.stringify({ name }) }),
  deleteCategory: (id: number) => request(`/labs/categories/${id}`, { method: "DELETE" }),
};

// Assignments
export const assign = {
  list: () => request<Assignment[]>("/assign"),
  listByGroup: (groupId: number) => request<Assignment[]>(`/assign/group/${groupId}`),
  create: (labId: number, groupId: number, onLine: (l: StreamLine) => void) =>
    streamRequest("/assign", { method: "POST", body: JSON.stringify({ labId, groupId }) }, onLine),
  delete: (id: number, onLine: (l: StreamLine) => void) => streamRequest(`/assign/${id}`, { method: "DELETE" }, onLine),
  assignToUser: (labId: number, userId: number, onLine: (l: StreamLine) => void) =>
    streamRequest("/assign/user", { method: "POST", body: JSON.stringify({ labId, userId }) }, onLine),
};

// VMs
export const vms = {
  myVMs: (page = 1, pageSize = 50) => request<Paginated<ClonedVM>>(`/vms/my?page=${page}&pageSize=${pageSize}`),
  cloned: (params: { userId?: number; groupId?: number; labId?: number }, page = 1, pageSize = 20) => {
    const q = new URLSearchParams();
    if (params.userId) q.set("userId", String(params.userId));
    if (params.groupId) q.set("groupId", String(params.groupId));
    if (params.labId) q.set("labId", String(params.labId));
    q.set("page", String(page));
    q.set("pageSize", String(pageSize));
    return request<Paginated<ClonedVM>>(`/vms/cloned?${q}`);
  },
  powerState: (vmId: string) => request<PowerState>(`/vms/${vmId}/power`),
  setPower: (vmId: string, action: "start" | "stop" | "reset") =>
    request(`/vms/${vmId}/power`, { method: "POST", body: JSON.stringify({ action }) }),
  consoleTicket: (vmId: string) => request<{ ticket: string }>(`/vms/${vmId}/console-ticket`),
  clone: (body: object) => request("/vms/clone", { method: "POST", body: JSON.stringify(body) }),
  delete: (vmId: string, onLine: (l: StreamLine) => void) => streamRequest(`/vms/${vmId}`, { method: "DELETE" }, onLine),
  vcenterList: (folder?: string) => request(`/vmware/vcenter/vm${folder ? `?folders=${encodeURIComponent(folder)}` : ""}`),
  sourceList: () => request<{ vm: string; name: string }[]>("/vmware/source-vms"),
};

// vCenter (raw passthrough, admin only)
export const vcenter = {
  hosts: () => request("/vmware/vcenter/host"),
  datastores: () => request("/vmware/vcenter/datastore"),
  folders: (type?: string) => request(`/vmware/vcenter/folder${type ? `?type=${type}` : ""}`),
  clusters: () => request("/vmware/vcenter/cluster"),
  resourcePools: () => request("/vmware/vcenter/resource-pool"),
  cis: {
    categories: () => request("/vmware/cis/tagging/category"),
    createCategory: (name: string) => request("/vmware/cis/tagging/category", { method: "POST", body: JSON.stringify({ name }) }),
    deleteCategory: (id: string) => request(`/vmware/cis/tagging/category/${id}`, { method: "DELETE" }),
    tags: () => request("/vmware/cis/tagging/tag"),
    createTag: (category_id: string, name: string, description?: string) =>
      request("/vmware/cis/tagging/tag", { method: "POST", body: JSON.stringify({ category_id, name, description }) }),
    updateTag: (id: string, name: string, description?: string) =>
      request(`/vmware/cis/tagging/tag/${id}`, { method: "PATCH", body: JSON.stringify({ name, description }) }),
    deleteTag: (id: string) => request(`/vmware/cis/tagging/tag/${id}`, { method: "DELETE" }),
    attachTagToVM: (vmId: string, tagId: string) =>
      request(`/vmware/cis/tagging/tag-association/${tagId}?action=attach`, {
        method: "POST",
        body: JSON.stringify({ object_id: { id: vmId, type: "VirtualMachine" } }),
      }),
    listTaggedVMs: (tagId: string) =>
      request("/vmware/cis/tagging/tag-association?action=list-attached-objects-on-tags", {
        method: "POST",
        body: JSON.stringify({ tag_ids: [tagId] }),
      }),
  },
};

// System config (public, no auth required)
export const sysConfig = {
  proxyOptions: () =>
    request<{ consoleProxies: ProxyOption[] }>("/config").then((r) => r.consoleProxies),
};

// Cron
export const cron = {
  tasks: () => request<CronTask[]>("/cron/tasks"),
  toggle: (id: string) => request<{ id: string; enabled: boolean }>(`/cron/tasks/${id}/toggle`, { method: "POST" }),
};
