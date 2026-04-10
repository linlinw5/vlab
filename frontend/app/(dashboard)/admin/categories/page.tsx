"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { labs as labsApi } from "@/lib/api";
import type { Category } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Trash2Icon, PlusIcon } from "lucide-react";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  async function reload() {
    setCategories(await labsApi.categories());
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await labsApi.createCategory(name);
      setNewName("");
      reload();
      toast.success(`Category "${name}" created`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await labsApi.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      reload();
      toast.success(`Category "${deleteTarget.name}" deleted`);
    } catch (err) {
      toast.error((err as Error).message);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Categories</h1>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreate())}
          placeholder="New category name"
          className="max-w-60"
        />
        <Button onClick={handleCreate} disabled={!newName.trim()}>
          <PlusIcon className="size-3.5 mr-1" /> New category
        </Button>
      </div>

      <div className="border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-muted-foreground">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-muted-foreground text-xs">{c.id}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(c)}
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
            <AlertDialogTitle>Delete category "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Labs using this category will have their category cleared.</AlertDialogDescription>
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
