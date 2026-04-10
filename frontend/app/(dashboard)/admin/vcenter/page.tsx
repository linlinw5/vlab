"use client";

import { useEffect, useState } from "react";
import { vcenter as vcApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "hosts" | "datastores" | "folders" | "clusters" | "resource-pools";

const TABS: { key: Tab; label: string }[] = [
  { key: "hosts", label: "Hosts" },
  { key: "datastores", label: "Datastores" },
  { key: "folders", label: "Folders" },
  { key: "clusters", label: "Clusters" },
  { key: "resource-pools", label: "Resource Pools" },
];

export default function AdminVCenterPage() {
  const [tab, setTab] = useState<Tab>("hosts");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const fetchers: Record<Tab, () => Promise<unknown>> = {
      hosts: vcApi.hosts,
      datastores: vcApi.datastores,
      folders: vcApi.folders,
      clusters: vcApi.clusters,
      "resource-pools": vcApi.resourcePools,
    };
    fetchers[tab]()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">vCenter Info</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList variant="line">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {loading ? (
              <p className="text-muted-foreground text-sm py-4">Loading…</p>
            ) : (
              <pre className="bg-muted p-4 text-xs overflow-auto max-h-[75vh]">{JSON.stringify(data, null, 2)}</pre>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
