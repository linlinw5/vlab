"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { labs as labsApi, vms as vmsApi } from "@/lib/api";
import type { Lab, Category } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PencilIcon, Trash2Icon, PlusIcon } from "lucide-react";

interface SourceVM {
  vm: string;
  name: string;
}

export default function AdminLabsPage() {
  const [labList, setLabList] = useState<Lab[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Lab | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lab | null>(null);

  async function reload() {
    const [labs, cats] = await Promise.all([labsApi.list(), labsApi.categories()]);
    setLabList(labs);
    setCategories(cats);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await labsApi.delete(deleteTarget.id);
      toast.success(`Lab "${deleteTarget.title}" deleted`);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
      setDeleteTarget(null);
    }
  }

  async function handleSave(data: { title: string; description: string; link: string; categoryId: number | null; vmIds: string[] }) {
    setFormOpen(false);
    try {
      if (editing) {
        await labsApi.update(editing.id, data);
        toast.success("Lab updated");
      } else {
        await labsApi.create(data);
        toast.success("Lab created");
      }
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Labs</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon className="size-3.5 mr-1" /> New Lab
        </Button>
      </div>

      <div className="border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-muted-foreground">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>VMs</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {labList.map((lab) => (
              <TableRow key={lab.id}>
                <TableCell className="text-muted-foreground text-xs">{lab.id}</TableCell>
                <TableCell className="font-medium">{lab.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-xs">
                  {lab.description ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate">{lab.description}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm whitespace-pre-wrap">{lab.description}</TooltipContent>
                    </Tooltip>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{lab.categoryName || "—"}</TableCell>
                <TableCell>{lab.vmIds.length}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        setEditing(lab);
                        setFormOpen(true);
                      }}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(lab)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LabFormDialog open={formOpen} lab={editing} categories={categories} onClose={() => setFormOpen(false)} onSubmit={handleSave} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lab "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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

function LabFormDialog({
  open,
  lab,
  categories,
  onClose,
  onSubmit,
}: {
  open: boolean;
  lab: Lab | null;
  categories: Category[];
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; link: string; categoryId: number | null; vmIds: string[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState("");
  const [catId, setCatId] = useState("");
  const [selectedVms, setSelectedVms] = useState<Set<string>>(new Set());
  const [sourceVMs, setSourceVMs] = useState<SourceVM[]>([]);
  const [vmsLoading, setVmsLoading] = useState(false);
  const [vmSearch, setVmSearch] = useState("");

  useEffect(() => {
    setTitle(lab?.title ?? "");
    setDesc(lab?.description ?? "");
    setLink(lab?.link ?? "");
    setCatId(lab?.categoryId ? String(lab.categoryId) : "none");
    setSelectedVms(new Set(lab?.vmIds ?? []));
    setVmSearch("");
  }, [lab, open]);

  useEffect(() => {
    if (!open) return;
    setVmsLoading(true);
    vmsApi
      .sourceList()
      .then((list) => setSourceVMs(list))
      .catch(() => setSourceVMs([]))
      .finally(() => setVmsLoading(false));
  }, [open]);

  function toggleVm(vmId: string) {
    setSelectedVms((prev) => {
      const next = new Set(prev);
      next.has(vmId) ? next.delete(vmId) : next.add(vmId);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title,
      description: desc,
      link,
      categoryId: catId && catId !== "none" ? Number(catId) : null,
      vmIds: [...selectedVms],
    });
  }

  const filteredVMs = sourceVMs.filter(
    (v) => v.name.toLowerCase().includes(vmSearch.toLowerCase()) || v.vm.toLowerCase().includes(vmSearch.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{lab ? "Edit Lab" : "New Lab"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Docs Link</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Description</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>
              Template VMs
              {selectedVms.size > 0 && <span className="ml-2 text-muted-foreground font-normal">({selectedVms.size} selected)</span>}
            </Label>
            <Input placeholder="Search VMs…" value={vmSearch} onChange={(e) => setVmSearch(e.target.value)} className="h-8 text-xs" />
            <div className="border overflow-y-auto h-48 divide-y">
              {vmsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="w-4 h-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-3 w-full mb-1" />
                      <Skeleton className="h-2.5 w-2/3" />
                    </div>
                  </div>
                ))
              ) : filteredVMs.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No VMs found</p>
              ) : (
                filteredVMs.map((v) => (
                  <label key={v.vm} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={selectedVms.has(v.vm)} onCheckedChange={() => toggleVm(v.vm)} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{v.vm}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
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
