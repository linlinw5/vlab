"use client";

import { useEffect, useState } from "react";
import { groups as groupsApi, type StreamLine } from "@/lib/api";
import type { Group } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PaginationBar } from "@/components/pagination-bar";
import { PencilIcon, Trash2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

export default function AdminGroupsPage() {
  const [list, setList] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<Group | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [streaming, setStreaming] = useState(false);

  async function reload(p = page, ps = pageSize) {
    const result = await groupsApi.list(p, ps);
    setList(result.data);
    setTotal(result.total);
  }

  useEffect(() => {
    reload(page, pageSize);
  }, [page, pageSize]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    setStreaming(true);
    try {
      const ids: (string | number)[] = [];
      await groupsApi.delete(deleteTarget.id, (line: StreamLine) => {
        if (line.done) {
          ids.forEach((id) => toast.dismiss(id));
          line.error ? toast.error(line.message) : toast.success("Group deleted");
          setStreaming(false);
          reload(1);
          setPage(1);
        } else {
          ids.push(toast.loading(line.message));
        }
      });
    } catch (err) {
      toast.error((err as Error).message);
      setStreaming(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(g: Group) {
    setEditing(g);
    setFormOpen(true);
  }

  async function handleSave(name: string, desc: string) {
    setFormOpen(false);
    const isEdit = !!editing;
    try {
      const ids: (string | number)[] = [];
      await (isEdit
        ? groupsApi.update(editing!.id, { name, description: desc }, (line: StreamLine) => {
            if (!line.done) ids.push(toast.loading(line.message));
          })
        : groupsApi.create({ name, description: desc }, (line: StreamLine) => {
            if (!line.done) ids.push(toast.loading(line.message));
          }));
      ids.forEach((id) => toast.dismiss(id));
      toast.success(isEdit ? "Group updated" : "Group created");
      reload(isEdit ? page : 1);
      if (!isEdit) setPage(1);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Groups</h1>
        <Button onClick={openCreate}>
          <PlusIcon className="size-3.5 mr-1" /> New Group
        </Button>
      </div>

      <div className="border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-muted-foreground">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>VMware Tag ID</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="text-muted-foreground text-xs">{g.id}</TableCell>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-muted-foreground">{g.description || "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{g.vmwareTagId || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(g)} disabled={g.id === 1}>
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(g)}
                      disabled={streaming || g.id === 1}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar
          page={page}
          total={total}
          pageSize={pageSize}
          onChange={setPage}
          onPageSizeChange={(ps) => {
            setPageSize(ps);
            setPage(1);
          }}
        />
      </div>

      {/* 表单弹窗 */}
      <GroupFormDialog open={formOpen} group={editing} onClose={() => setFormOpen(false)} onSubmit={handleSave} />

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>All users and VMs in this group will be deleted. This action cannot be undone.</AlertDialogDescription>
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

function GroupFormDialog({
  open,
  group,
  onClose,
  onSubmit,
}: {
  open: boolean;
  group: Group | null;
  onClose: () => void;
  onSubmit: (name: string, desc: string) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    setName(group?.name ?? "");
    setDesc(group?.description ?? "");
  }, [group, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(name, desc);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? "Edit Group" : "New Group"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
