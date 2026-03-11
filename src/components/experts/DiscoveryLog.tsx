"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DiscoveryRun } from "@prisma/client";

const statusColors = {
  RUNNING: "text-primary",
  COMPLETED: "text-accent-foreground",
  FAILED: "text-destructive",
};

export function DiscoveryLog({ run }: { run: DiscoveryRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${statusColors[run.status]}`}>
              {run.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(run.startedAt).toLocaleString()}
            </span>
            {run.status === "COMPLETED" && (
              <span className="text-xs text-muted-foreground">
                {run.sourcesFound} sources found
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <div className="rounded-lg bg-sidebar p-4 font-mono text-xs text-sidebar-foreground space-y-1 max-h-64 overflow-y-auto">
            {run.log.length === 0 ? (
              <p className="text-sidebar-foreground/50">No log entries</p>
            ) : (
              run.log.map((line, i) => (
                <p key={i} className="leading-relaxed">
                  {line}
                </p>
              ))
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
