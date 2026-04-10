"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { users as usersApi, groups as groupsApi, type StreamLine } from "@/lib/api";
import type { User, Group } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PaginationBar } from "@/components/pagination-bar";
import { Trash2Icon, RotateCcwIcon, WifiIcon, WifiOffIcon, PlusIcon, UsersIcon } from "lucide-react";

export default function AdminUsersPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedGroup, setGroup] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  // 新建用户 dialog states
  const [singleOpen, setSingleOpen] = useState(false);
  const [singleUser, setSingleUser] = useState("");
  const [singlePwd, setSinglePwd] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState("");
  const [batchPwd, setBatchPwd] = useState("");
  const [batchCount, setBatchCount] = useState("10");
  const [batchStart, setBatchStart] = useState("1");

  // dialog states
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdValue, setPwdValue] = useState("");
  const [vpnOpen, setVpnOpen] = useState(false);
  const [vpnPwdValue, setVpnPwd] = useState("");
  const [disableVpnOpen, setDisableVpnOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    groupsApi.listAll().then((r) => setGroups(r.data));
  }, []);

  async function loadUsers(groupId: number, p = 1, ps = pageSize) {
    setLoading(true);
    setSelected(new Set());
    const result = await usersApi.list(groupId, p, ps);
    setUsers(result.data);
    setTotal(result.total);
    setLoading(false);
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === users.length ? new Set() : new Set(users.map((u) => u.id))));
  }

  async function handleDelete() {
    setDeleteOpen(false);
    setStreaming(true);
    try {
      const ids: (string | number)[] = [];
      await usersApi.delete([...selected], (line: StreamLine) => {
        if (line.done) {
          ids.forEach((id) => toast.dismiss(id));
          line.error ? toast.error(line.message) : toast.success("Deleted successfully");
          setStreaming(false);
          loadUsers(Number(selectedGroup), page);
        } else {
          ids.push(toast.loading(line.message));
        }
      });
    } catch (err) {
      toast.error((err as Error).message);
      setStreaming(false);
    }
  }

  async function handleCreateSingle() {
    if (!singleUser || !singlePwd || !selectedGroup) return;
    setSingleOpen(false);
    try {
      const ids: (string | number)[] = [];
      await usersApi.createQuick(singleUser, singlePwd, Number(selectedGroup), (line: StreamLine) => {
        if (line.done) {
          ids.forEach((id) => toast.dismiss(id));
          line.error ? toast.error(line.message) : toast.success(line.message);
          loadUsers(Number(selectedGroup), page);
        } else {
          ids.push(toast.loading(line.message));
        }
      });
      setSingleUser("");
      setSinglePwd("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleCreateBatch() {
    if (!batchPrefix || !batchPwd || !selectedGroup || !batchCount) return;
    setBatchOpen(false);
    try {
      const ids: (string | number)[] = [];
      await usersApi.createBatch(
        batchPrefix,
        batchPwd,
        Number(selectedGroup),
        Number(batchCount),
        Number(batchStart),
        (line: StreamLine) => {
          if (line.done) {
            ids.forEach((id) => toast.dismiss(id));
            line.error ? toast.error(line.message) : toast.success(line.message);
            loadUsers(Number(selectedGroup), page);
          } else {
            ids.push(toast.loading(line.message));
          }
        },
      );
      setBatchPrefix("");
      setBatchPwd("");
      setBatchCount("10");
      setBatchStart("1");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleResetPassword() {
    if (!pwdValue) return;
    try {
      await usersApi.resetPassword([...selected], pwdValue);
      toast.success(`Password reset for ${selected.size} user(s)`);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setPwdOpen(false);
    setPwdValue("");
  }

  async function handleEnableVPN() {
    if (!vpnPwdValue) return;
    setVpnOpen(false);
    setVpnPwd("");
    setStreaming(true);
    try {
      const ids: (string | number)[] = [];
      await usersApi.enableVPN([...selected], vpnPwdValue, (line: StreamLine) => {
        if (line.done) {
          ids.forEach((id) => toast.dismiss(id));
          line.error ? toast.error(line.message) : toast.success("VPN enabled");
          setStreaming(false);
          loadUsers(Number(selectedGroup), page);
        } else {
          ids.push(toast.loading(line.message));
        }
      });
    } catch (err) {
      toast.error((err as Error).message);
      setStreaming(false);
    }
  }

  async function handleDisableVPN() {
    setDisableVpnOpen(false);
    setStreaming(true);
    try {
      const ids: (string | number)[] = [];
      await usersApi.disableVPN([...selected], (line: StreamLine) => {
        if (line.done) {
          ids.forEach((id) => toast.dismiss(id));
          line.error ? toast.error(line.message) : toast.success("VPN disabled");
          setStreaming(false);
          loadUsers(Number(selectedGroup), page);
        } else {
          ids.push(toast.loading(line.message));
        }
      });
    } catch (err) {
      toast.error((err as Error).message);
      setStreaming(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>

      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedGroup || "__none__"}
          onValueChange={(v) => {
            const gid = v === "__none__" ? "" : v;
            setGroup(gid);
            if (gid) {
              setPage(1);
              loadUsers(Number(gid), 1);
            } else {
              setUsers([]);
              setTotal(0);
              setSelected(new Set());
            }
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Select group —</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedGroup && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSingleOpen(true)}>
              <PlusIcon className="size-3.5 mr-1" /> Add User
            </Button>
            <Button variant="outline" onClick={() => setBatchOpen(true)}>
              <UsersIcon className="size-3.5 mr-1" /> Batch Add
            </Button>
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setPwdOpen(true)}>
              <RotateCcwIcon className="size-3.5 mr-1" /> Reset Password
            </Button>
            <Button variant="outline" onClick={() => setVpnOpen(true)}>
              <WifiIcon className="size-3.5 mr-1" /> Enable VPN
            </Button>
            <Button variant="outline" onClick={() => setDisableVpnOpen(true)}>
              <WifiOffIcon className="size-3.5 mr-1" /> Disable VPN
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={streaming}>
              <Trash2Icon className="size-3.5 mr-1" /> Delete
            </Button>
          </div>
        )}
      </div>

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!loading && users.length > 0 && (
        <div className="border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-muted-foreground">ID</TableHead>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === users.length && users.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>VPN</TableHead>
                <TableHead>VPN Password</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-muted-foreground text-xs">{u.id}</TableCell>
                  <TableCell>
                    <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggleSelect(u.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{u.roleName}</TableCell>
                  <TableCell>
                    {u.vpnEnable ? (
                      <Badge variant="default" className="text-xs">
                        Active
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.vpnPassword ?? <span className="text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar
            page={page}
            total={total}
            pageSize={pageSize}
            onChange={(p) => {
              setPage(p);
              loadUsers(Number(selectedGroup), p);
            }}
            onPageSizeChange={(ps) => {
              setPageSize(ps);
              setPage(1);
              loadUsers(Number(selectedGroup), 1, ps);
            }}
          />
        </div>
      )}

      {/* 新建单个用户 */}
      <Dialog open={singleOpen} onOpenChange={setSingleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Username</Label>
              <Input value={singleUser} onChange={(e) => setSingleUser(e.target.value)} placeholder="e.g. student01" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Password</Label>
              <Input type="password" value={singlePwd} onChange={(e) => setSinglePwd(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Email will be: {singleUser || "<username>"}@{groups.find((g) => String(g.id) === selectedGroup)?.name}.local
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSingle} disabled={!singleUser || !singlePwd}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量新建用户 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Add Users</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Username Prefix</Label>
              <Input value={batchPrefix} onChange={(e) => setBatchPrefix(e.target.value)} placeholder="e.g. student" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Start Number</Label>
                <Input type="number" min={1} value={batchStart} onChange={(e) => setBatchStart(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Count (max 60)</Label>
                <Input type="number" min={1} max={60} value={batchCount} onChange={(e) => setBatchCount(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Password</Label>
              <Input type="password" value={batchPwd} onChange={(e) => setBatchPwd(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Will create: {batchPrefix || "<prefix>"}
              {String(Number(batchStart)).padStart(2, "0")} ~ {batchPrefix || "<prefix>"}
              {String(Number(batchStart) + Number(batchCount) - 1).padStart(2, "0")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBatch} disabled={!batchPrefix || !batchPwd || !batchCount}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码 */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>New Password</Label>
            <Input value={pwdValue} onChange={(e) => setPwdValue(e.target.value)} type="password" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 开通VPN */}
      <Dialog open={vpnOpen} onOpenChange={setVpnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable VPN</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>VPN Password</Label>
            <Input value={vpnPwdValue} onChange={(e) => setVpnPwd(e.target.value)} type="password" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVpnOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEnableVPN}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 关闭VPN 确认 */}
      <AlertDialog open={disableVpnOpen} onOpenChange={setDisableVpnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable VPN?</AlertDialogTitle>
            <AlertDialogDescription>VPN access will be disabled for {selected.size} selected user(s).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisableVPN}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete users?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} user(s) and their associated VMs will be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
