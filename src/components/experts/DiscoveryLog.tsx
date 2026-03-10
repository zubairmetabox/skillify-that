"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DiscoveryRun } from "@prisma/client";

const statusColors = {
  RUNNING: "text-blue-500",
  COMPLETED: "text-green-600",
  FAILED: "text-red-500",
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
            <span
              className={`text-sm font-semibold ${statusColors[run.status]}`}
            >
              {run.status}
            </span>
            <span className="text-xs text-zinc-400">
              {new Date(run.startedAt).toLocaleString()}
            </span>
            {run.status === "COMPLETED" && (
              <span className="text-xs text-zinc-500">
                {run.sourcesFound} sources found
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-400">{expanded ? "▲" : "▼"}</span>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <div className="rounded-lg bg-zinc-950 p-4 font-mono text-xs text-green-400 space-y-1 max-h-64 overflow-y-auto">
            {run.log.length === 0 ? (
              <p className="text-zinc-500">No log entries</p>
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
