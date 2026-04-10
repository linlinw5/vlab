"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { TerminalIcon } from "lucide-react";
import { vms } from "@/lib/api";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    WMKS?: {
      createWMKS: (id: string, options: object) => WMKSInstance;
      CONST: {
        Events: { CONNECTION_STATE_CHANGE: string };
        ConnectionState: { CONNECTED: string; DISCONNECTED: string };
      };
    };
  }
}

interface WMKSInstance {
  connect: (url: string) => void;
  disconnect: () => void;
  destroy: () => void;
  sendCAD: () => void;
  register: (event: string, handler: (e: unknown, data: { state: string }) => void) => WMKSInstance;
  isFullScreen: () => boolean;
  enterFullScreen: () => void;
  exitFullScreen: () => void;
}

export default function ConsolePage() {
  const { id: vmId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const wmksRef = useRef<WMKSInstance | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let destroyed = false;

    async function connect() {
      try {
        const { ticket } = await vms.consoleTicket(vmId);

        const ticketUrl = new URL(ticket);
        const esxiHost = ticketUrl.host;
        const esxiPath = ticketUrl.pathname + ticketUrl.search;
        const proxyPort = searchParams.get("port") || "8843";
        const wsUrl = `wss://${window.location.hostname}:${proxyPort}/esxi/${esxiHost}${esxiPath}`;

        if (destroyed) return;

        // jQuery → jQuery UI → WMKS，必须按顺序加载
        await loadScript("/vmware/jquery-1.8.3.min.js");
        await loadScript("/vmware/jquery-ui.min.js");
        await loadScript("/vmware/wmks.min.js");

        if (destroyed || !window.WMKS) return;

        wmksRef.current = window.WMKS.createWMKS("wmks-container", {
          changeResolution: true,
          rescale: true,
        }).register(window.WMKS.CONST.Events.CONNECTION_STATE_CHANGE, (_e, data) => {
          if (data.state === window.WMKS!.CONST.ConnectionState.CONNECTED) {
            console.log("WMKS connected");
          } else if (data.state === window.WMKS!.CONST.ConnectionState.DISCONNECTED) {
            console.log("WMKS disconnected");
          }
        });

        wmksRef.current.connect(wsUrl);
      } catch (err: unknown) {
        if (!destroyed) {
          setErrorMsg(err instanceof Error ? err.message : "Connection failed");
        }
      }
    }

    connect();
    return () => {
      destroyed = true;
      wmksRef.current?.disconnect();
      wmksRef.current?.destroy();
    };
  }, [vmId, mounted]);

  if (!mounted) return null;

  function handleCAD() {
    wmksRef.current?.sendCAD();
  }

  function handleFullscreen() {
    const wmks = wmksRef.current;
    if (!wmks) return;
    if (wmks.isFullScreen()) {
      wmks.exitFullScreen();
    } else {
      wmks.enterFullScreen();
    }
  }

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden">
      {/* 顶部工具栏 */}
      <header className="relative bg-neutral-200 shrink-0 flex h-16 items-center justify-between gap-8 px-8">
        <div className="flex items-center gap-2 font-medium">
          <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
            <TerminalIcon className="size-10" />
          </div>
          <h1 className="text-xl font-bold">vlab</h1>
        </div>

        {/* 错误提示 */}
        {errorMsg && <div className="flex-1 px-2 py-1 text-sm text-red-400 bg-red-100 border border-red-200 text-center">{errorMsg}</div>}

        <div className="flex items-center gap-2">
          <Button onClick={handleCAD}>Ctrl+Alt+Del</Button>
          <Button onClick={handleFullscreen}>Full Screen</Button>
        </div>
      </header>

      {/* WMKS 容器，撑满剩余空间 */}
      <div id="wmks-container" className="absolute top-16 left-0 right-0 bottom-0 flex-1 bg-gray-400" />
    </div>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}
