"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { labs as labsApi, vms as vmsApi } from "@/lib/api";
import { useUser } from "@/contexts/user-context";
import type { Lab, ClonedVM } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConicalIcon, MonitorIcon, ExternalLinkIcon, ChevronRightIcon } from "lucide-react";

export default function LabsPage() {
  const router = useRouter();
  const user = useUser();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [myVMs, setMyVMs] = useState<ClonedVM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) return; // 等 layout 完成鉴权
    async function load() {
      const [labList, vmResult] = await Promise.all([labsApi.list(user?.groupId ?? undefined), vmsApi.myVMs(1, 200)]);
      setLabs(labList);
      setMyVMs(vmResult.data);
      setLoading(false);
    }
    load().catch(console.error);
  }, [user]);

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My Labs</h1>

      {labs.length === 0 && <p className="text-muted-foreground text-sm">No labs assigned.</p>}

      <div className="space-y-3">
        {labs.map((lab) => {
          const vmCount = myVMs.filter((vm) => vm.labId === lab.id).length;
          return (
            <div key={lab.id} className="group cursor-pointer" onClick={() => router.push(`/labs/${lab.id}`)}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FlaskConicalIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-base">{lab.title}</CardTitle>
                      {lab.categoryName && (
                        <Badge variant="secondary" className="text-xs">
                          {lab.categoryName}
                        </Badge>
                      )}
                    </div>
                    <ChevronRightIcon className="size-4 text-muted-foreground mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  {lab.description && <CardDescription>{lab.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MonitorIcon className="size-3.5" />
                      {vmCount} VM{vmCount !== 1 ? "s" : ""}
                    </span>
                    {lab.link && (
                      <a
                        href={lab.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Docs <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
