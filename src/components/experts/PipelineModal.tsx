"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PipelineModalState = {
  open: boolean;
  title: string;
  status: "running" | "completed" | "failed" | "stopped" | "idle";
  log: string[];
  currentStep?: string;
  summary?: string;
  canResume?: boolean;
};

type Props = {
  state: PipelineModalState;
  onClose: () => void;
  onStop?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
};

export function PipelineModal({ state, onClose, onStop, onResume, onRestart }: Props) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.log]);

  const isDone = state.status === "completed" || state.status === "failed" || state.status === "stopped";
  const isRunning = state.status === "running";
  const isFailed = state.status === "failed" || state.status === "stopped";

  const currentStep = state.currentStep ?? (() => {
    for (let i = state.log.length - 1; i >= 0; i--) {
      const line = state.log[i];
      if (line && !line.startsWith("✓") && !line.startsWith("✗")) return line;
    }
    return null;
  })();

  return (
    <Dialog open={state.open} onOpenChange={(open) => { if (!open && isDone) onClose(); }}>
      <DialogContent className="sm:max-w-xl" showCloseButton={isDone}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {isRunning && (
                <span className="relative flex size-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
              )}
              {state.status === "completed" && <span className="size-2.5 rounded-full bg-emerald-500 shrink-0" />}
              {state.status === "failed" && <span className="size-2.5 rounded-full bg-destructive shrink-0" />}
              {state.status === "stopped" && <span className="size-2.5 rounded-full bg-muted-foreground shrink-0" />}
              <DialogTitle>{state.title}</DialogTitle>
            </div>
            {isRunning && onStop && (
              <Button variant="outline" size="sm" onClick={onStop} className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10">
                Stop
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Current step banner — shown while running */}
        {isRunning && currentStep && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5 font-medium uppercase tracking-wide">Currently</p>
            <p className="text-sm text-foreground font-medium leading-snug animate-pulse">{currentStep}</p>
          </div>
        )}

        {/* Log terminal */}
        <div
          ref={logRef}
          className="rounded-lg bg-sidebar p-4 font-mono text-xs text-sidebar-foreground space-y-1 h-56 overflow-y-auto"
        >
          {state.log.length === 0 ? (
            <p className="text-sidebar-foreground/40">Waiting...</p>
          ) : (
            state.log.map((line, i) => {
              const isSuccess = line.startsWith("✓");
              const isError = line.startsWith("✗");
              const isInfo = !isSuccess && !isError;
              return (
                <p
                  key={i}
                  className={cn(
                    "leading-relaxed",
                    isSuccess && "text-emerald-400",
                    isError && "text-destructive",
                    isInfo && "text-sidebar-foreground/70"
                  )}
                >
                  {isSuccess ? line : isError ? line : `› ${line}`}
                </p>
              );
            })
          )}
          {isRunning && (
            <p className="text-primary/60 animate-pulse">▊</p>
          )}
        </div>

        {/* Summary / result */}
        {isDone && state.summary && (
          <div className={cn(
            "rounded-lg px-4 py-3 text-sm font-medium",
            state.status === "completed" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            state.status === "failed" && "bg-destructive/10 text-destructive",
            state.status === "stopped" && "bg-muted text-muted-foreground",
          )}>
            {state.summary}
          </div>
        )}

        {isDone && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* Resume / Restart actions for failed atlas builds */}
            {isFailed && (onResume || onRestart) && (
              <div className="flex gap-2 flex-1">
                {onResume && state.canResume && (
                  <Button onClick={onResume} size="sm">
                    Resume where left off
                  </Button>
                )}
                {onRestart && (
                  <Button variant="outline" size="sm" onClick={onRestart}>
                    Restart from scratch
                  </Button>
                )}
              </div>
            )}
            <Button onClick={onClose} variant={state.status === "completed" ? "default" : "outline"} size="sm">
              {state.status === "completed" ? "Done" : "Close"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
