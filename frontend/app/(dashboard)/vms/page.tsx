"use client";

import { useEffect, useState } from "react";
import { vms as vmsApi } from "@/lib/api";
import type { ClonedVM } from "@/types";
import { MonitorIcon } from "lucide-react";
import VmPowerBadge from "@/components/vm-power-badge";

export default function VmsPage() {
  const [vms, setVms] = useState<ClonedVM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vmsApi
      .myVMs(1, 200)
      .then((res) => {
        setVms(res.data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My VMs</h1>

      {vms.length === 0 && <p className="text-muted-foreground text-sm">No VMs assigned.</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {vms.map((vm) => (
          <div key={vm.vmId} className="border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2">
              <MonitorIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{vm.name}</span>
            </div>
            <VmPowerBadge vmId={vm.vmId} pollInterval={60_000} />
          </div>
        ))}
      </div>
    </div>
  );
}
