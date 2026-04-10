"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { labs as labsApi, vms as vmsApi } from "@/lib/api";
import type { Lab, ClonedVM } from "@/types";
import { Badge } from "@/components/ui/badge";
import { FlaskConicalIcon, MonitorIcon, ExternalLinkIcon, ChevronLeftIcon } from "lucide-react";
import VmPowerBadge from "@/components/vm-power-badge";

export default function LabDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lab, setLab] = useState<Lab | null>(null);
  const [vms, setVms] = useState<ClonedVM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [labData, vmResult] = await Promise.all([labsApi.get(Number(id)), vmsApi.myVMs(1, 200)]);
      setLab(labData);
      setVms(vmResult.data.filter((vm) => vm.labId === Number(id)));
      setLoading(false);
    }
    load().catch(console.error);
  }, [id]);

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!lab) return <p className="text-destructive text-sm">Lab not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/labs" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeftIcon className="size-3.5" /> Back to Labs
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FlaskConicalIcon className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{lab.title}</h1>
            {lab.categoryName && (
              <Badge variant="secondary" className="text-xs">
                {lab.categoryName}
              </Badge>
            )}
          </div>
          {lab.link && (
            <a
              href={lab.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Docs <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
        {lab.description && <p className="text-sm text-muted-foreground mt-1">{lab.description}</p>}
      </div>

      {vms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No VMs assigned.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vms.map((vm) => (
            <div key={vm.vmId} className="border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <MonitorIcon className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">{vm.name}</span>
              </div>
              <VmPowerBadge vmId={vm.vmId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
