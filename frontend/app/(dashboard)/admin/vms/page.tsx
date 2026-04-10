"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { vms as vmsApi, groups as groupsApi, labs as labsApi, type StreamLine } from "@/lib/api";
import type { ClonedVM, Group, Lab } from "@/types";
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
import { PaginationBar } from "@/components/pagination-bar";
import VmPowerBadge from "@/components/vm-power-badge";
import { Trash2Icon, SearchIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function AdminVMsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [labList, setLabList] = useState<Lab[]>([]);
  const [vmList, setVmList] = useState<ClonedVM[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [groupId, setGroupId] = useState("");
  const [labId, setLabId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ClonedVM | null>(null);

  useEffect(() => {
    Promise.all([groupsApi.listAll(), labsApi.list()]).then(([g, l]) => {
      setGroups(g.data);
      setLabList(l);
    });
  }, []);

  async function search(p = 1, ps = pageSize) {
    if (!groupId || !labId) return;
    const result = await vmsApi.cloned({ groupId: Number(groupId), labId: Number(labId) }, p, ps);
    setVmList(result.data);
    setTotal(result.total);
    setPage(p);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    const ids: (string | number)[] = [];
    await vmsApi.delete(target.vmId, (line: StreamLine) => {
      if (line.done) {
        ids.forEach((id) => toast.dismiss(id));
        if (line.error) {
          toast.error(line.message);
        } else {
          toast.success(line.message);
          setVmList((prev) => prev.filter((v) => v.vmId !== target.vmId));
          setTotal((prev) => prev - 1);
        }
      } else {
        ids.push(toast.loading(line.message));
      }
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Cloned VMs</h1>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Group</label>
          <Select value={groupId || "__none__"} onValueChange={(v) => setGroupId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="w-36">
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
        </div>
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
        <Button onClick={() => search(1)} disabled={!groupId || !labId}>
          <SearchIcon className="size-3.5 mr-1" /> Search
        </Button>
      </div>

      {vmList.length > 0 && (
        <div className="border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-muted-foreground">ID</TableHead>
                <TableHead>VM Name</TableHead>
                <TableHead>VM ID</TableHead>
                <TableHead>Source VM ID</TableHead>
                <TableHead className="w-16 text-center">Lab</TableHead>
                <TableHead className="w-16 text-center">GID</TableHead>
                <TableHead className="w-16 text-center">UID</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-64">Power</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vmList.map((vm) => (
                <TableRow key={vm.id}>
                  <TableCell className="text-muted-foreground text-xs">{vm.id}</TableCell>
                  <TableCell className="font-medium">{vm.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{vm.vmId}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{vm.sourceVmId}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{vm.labId}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{vm.groupId ?? "—"}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{vm.userId}</TableCell>
                  <TableCell className="text-muted-foreground">{vm.email}</TableCell>
                  <TableCell>
                    <VmPowerBadge vmId={vm.vmId} pollInterval={60_000} />
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(vm)}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete VM</TooltipContent>
                    </Tooltip>
                  </TableCell>
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
              search(p);
            }}
            onPageSizeChange={(ps) => {
              setPageSize(ps);
              setPage(1);
              search(1, ps);
            }}
          />
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VM?</AlertDialogTitle>
            <AlertDialogDescription>
              VM "{deleteTarget?.name}" ({deleteTarget?.vmId}) will be permanently deleted from vCenter. This action cannot be undone.
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
