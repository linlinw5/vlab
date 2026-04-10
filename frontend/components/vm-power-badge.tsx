"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { vms, sysConfig, type ProxyOption } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PowerIcon, Play, Square, RotateCcw, TerminalSquare } from "lucide-react";

// 模块级缓存，所有实例共享一次请求
let proxyCache: ProxyOption[] | null = null;
let proxyFetch: Promise<ProxyOption[]> | null = null;

function loadProxyOptions(): Promise<ProxyOption[]> {
  if (proxyCache) return Promise.resolve(proxyCache);
  if (!proxyFetch) {
    proxyFetch = sysConfig.proxyOptions()
      .then((opts) => { proxyCache = opts; return opts; })
      .catch(() => []);
  }
  return proxyFetch;
}

type VmStateKey = "POWERED_ON" | "POWERED_OFF" | "SUSPENDED" | "UNKNOWN";

interface Props {
  vmId: string;
  pollInterval?: number;
}

const STATE_VARIANT: Record<VmStateKey, "default" | "secondary" | "destructive" | "outline"> = {
  POWERED_ON: "outline",
  POWERED_OFF: "destructive",
  SUSPENDED: "secondary",
  UNKNOWN: "outline",
};

const STATE_CLASS: Partial<Record<VmStateKey, string>> = {
  POWERED_ON: "border-green-200 text-green-600 bg-green-50",
};

const STATE_LABELS: Record<VmStateKey, string> = {
  POWERED_ON: "Running",
  POWERED_OFF: "Off",
  SUSPENDED: "Suspended",
  UNKNOWN: "Unknown",
};

export default function VmPowerBadge({ vmId, pollInterval = 30_000 }: Props) {
  const [stateKey, setStateKey] = useState<VmStateKey>("UNKNOWN");
  const [actioning, setActioning] = useState(false);
  const [proxyOptions, setProxyOptions] = useState<ProxyOption[] | null>(null);

  useEffect(() => {
    loadProxyOptions().then(setProxyOptions);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const s = await vms.powerState(vmId);
      setStateKey(s.state as VmStateKey);
    } catch {
      setStateKey("UNKNOWN");
    }
  }, [vmId]);

  useEffect(() => {
    fetchState();
    const timer = setInterval(fetchState, pollInterval);
    return () => clearInterval(timer);
  }, [fetchState, pollInterval]);

  async function handlePower(action: "start" | "stop" | "reset") {
    setActioning(true);
    const labels = { start: "Power On", stop: "Power Off", reset: "Restart" };
    const id = toast.loading(`${labels[action]}…`);
    try {
      await vms.setPower(vmId, action);
      toast.success(`${labels[action]} command sent`, { id });
    } catch (err) {
      toast.error((err as Error).message, { id });
      setActioning(false);
      return;
    }
    setTimeout(async () => {
      await fetchState();
      setActioning(false);
    }, 3_000);
  }

  return (
    <div className="flex items-center justify-between gap-2 flex-nowrap whitespace-nowrap">
      <Badge variant={STATE_VARIANT[stateKey] ?? "outline"} className={`gap-1 text-xs ${STATE_CLASS[stateKey] ?? ""}`}>
        <PowerIcon className="size-3" />
        {STATE_LABELS[stateKey] ?? stateKey}
      </Badge>

      <div className="flex items-center gap-1 flex-nowrap">
        {stateKey === "POWERED_OFF" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => handlePower("start")} disabled={actioning}>
                <Play className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Power On</TooltipContent>
          </Tooltip>
        )}
        {stateKey === "POWERED_ON" && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => handlePower("stop")} disabled={actioning}>
                  <Square className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Power Off</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => handlePower("reset")} disabled={actioning}>
                  <RotateCcw className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restart</TooltipContent>
            </Tooltip>
            {proxyOptions !== null && proxyOptions.length > 0 && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7">
                        <TerminalSquare className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Console</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  {proxyOptions.map((opt) => (
                    <DropdownMenuItem key={opt.port} asChild>
                      <Link href={`/console/${vmId}?port=${opt.port}`} target="_blank">
                        {opt.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>
    </div>
  );
}
