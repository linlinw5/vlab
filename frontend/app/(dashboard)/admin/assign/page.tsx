"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { assign as assignApi, labs as labsApi, groups as groupsApi, users as usersApi, type StreamLine } from "@/lib/api";
import type { Assignment, Lab, Group, User } from "@/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Trash2Icon, PlusIcon, UserPlusIcon } from "lucide-react";

export default function AdminAssignPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [labList, setLabList] = useState<Lab[]>([]);
  const [groupList, setGroupList] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);

  // group assign
  const [labId, setLabId] = useState("");
  const [groupId, setGroupId] = useState("");

  // manual assign (to single user)
  const [manualGroupId, setManualGroupId] = useState("");
  const [manualUserId, setManualUserId] = useState("");
  const [manualLabId, setManualLabId] = useState("");
  const [userList, setUserList] = useState<User[]>([]);

  async function reload() {
    const [a, l, g] = await Promise.all([assignApi.list(), labsApi.list(), groupsApi.listAll()]);
    setAssignments(a);
    setLabList(l);
    setGroupList(g.data);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleManualGroupChange(gid: string) {
    setManualGroupId(gid);
    setManualUserId("");
    if (!gid) {
      setUserList([]);
      return;
    }
    const result = await usersApi.list(Number(gid), 1, 200);
    setUserList(result.data);
  }

  async function handleAssign() {
    if (!labId || !groupId) return;
    setLoading(true);
    try {
      const ids: (string | number)[] = [];
      await assignApi.create(Number(labId), Number(groupId), (line: StreamLine) => {
        if (line.done) {
          ids.forEach((id) => toast.dismiss(id));
          line.error ? toast.error(line.message) : toast.success("Assigned successfully");
          setLoading(false);
          reload();
          setLabId("");
          setGroupId("");
        } else {
          ids.push(toast.loading(line.message));
        }
      });
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  async function handleManualAssign() {
    if (!manualLabId || !manualUserId) return;
    setLoading(true);
    const ids: (string | number)[] = [];
    try {
      await assignApi.assignToUser(Number(manualLabId), Number(manualUserId), (line: StreamLine) => {
        if (line.done) {
          ids.forEach((id) => toast.dismiss(id));
          line.error ? toast.error(line.message) : toast.success(line.message);
          setLoading(false);
        } else if (line.error) {
          ids.push(toast.error(line.message));
        } else {
          ids.push(toast.loading(line.message));
        }
      });
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    setLoading(true);
    try {
      const ids: (string | number)[] = [];
      await assignApi.delete(deleteTarget.id, (line: StreamLine) => {
        if (line.done) {
          ids.forEach((id) => toast.dismiss(id));
          line.error ? toast.error(line.message) : toast.success("Assignment removed");
          setLoading(false);
          reload();
        } else {
          ids.push(toast.loading(line.message));
        }
      });
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Assignment</h1>

      {/* Lab → Group */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Assign lab to group</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Lab</label>
            <Select value={labId || "__none__"} onValueChange={(v) => setLabId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select lab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select lab —</SelectItem>
                {labList.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Group</label>
            <Select value={groupId || "__none__"} onValueChange={(v) => setGroupId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select group —</SelectItem>
                {groupList.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={loading || !labId || !groupId}>
            <PlusIcon className="size-3.5 mr-1" /> Assign
          </Button>
        </div>
      </div>

      {/* Lab → User */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Assign lab to single user</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Group</label>
            <Select value={manualGroupId || "__none__"} onValueChange={(v) => handleManualGroupChange(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select group —</SelectItem>
                {groupList.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">User</label>
            <Select value={manualUserId || "__none__"} onValueChange={(v) => setManualUserId(v === "__none__" ? "" : v)} disabled={!manualGroupId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select user —</SelectItem>
                {userList.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Lab</label>
            <Select value={manualLabId || "__none__"} onValueChange={(v) => setManualLabId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select lab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select lab —</SelectItem>
                {labList.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleManualAssign} disabled={loading || !manualUserId || !manualLabId}>
            <UserPlusIcon className="size-3.5 mr-1" /> Assign to User
          </Button>
        </div>
      </div>

      <div className="border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-muted-foreground">ID</TableHead>
              <TableHead>Lab</TableHead>
              <TableHead>Group</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-muted-foreground text-xs">{a.id}</TableCell>
                <TableCell>{a.labTitle}</TableCell>
                <TableCell>{a.groupName}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(a)}
                    disabled={loading}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the assignment of "{deleteTarget?.labTitle}" to "{deleteTarget?.groupName}" and all associated cloned VMs.
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
