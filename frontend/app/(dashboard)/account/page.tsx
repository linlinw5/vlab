"use client";

import { useState } from "react";
import { auth } from "@/lib/api";
import { useUser } from "@/contexts/user-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function AccountPage() {
  const user = useUser();
  const [pwdOpen, setPwdOpen] = useState(false);

  if (!user) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Username", value: user.username },
    { label: "Email", value: user.email },
    { label: "Role", value: <Badge variant="secondary">{user.roleName}</Badge> },
    { label: "Group", value: user.groupName ?? <span className="text-muted-foreground">—</span> },
    {
      label: "VPN",
      value: user.vpnEnable ? <Badge variant="default">Active</Badge> : <span className="text-muted-foreground text-sm">Inactive</span>,
    },
    { label: "Registered", value: new Date(user.createdAt).toLocaleString() },
  ];

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">My Account</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Password</span>
            <Button variant="outline" size="sm" onClick={() => setPwdOpen(true)}>
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!current) {
      setError("Current password is required");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (next.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await auth.changePassword(current, next);
      toast.success("Password changed successfully");
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2">
            <Label>Current Password</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label>New Password</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
