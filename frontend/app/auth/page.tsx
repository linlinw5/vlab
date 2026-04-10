"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { TerminalIcon } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="hidden bg-muted lg:block" />
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <div className="flex items-center gap-2 font-medium">
            <div className="flex size-12 items-center justify-center bg-primary text-primary-foreground">
              <TerminalIcon className="size-12" />
            </div>
            <h1 className="text-2xl font-bold">vlab</h1>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
