"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { SourceEndpoint, SourcePolicyProfile } from "@prisma/client";

type Source = SourceEndpoint & { policyProfile: SourcePolicyProfile | null };

type Props = {
  sources: Source[];
  expertId: string;
  tierColors: Record<string, string>;
  complianceColors: Record<string, string>;
  onUpdate: () => Promise<void>;
};

export function SourceTable({ sources, expertId, tierColors, complianceColors, onUpdate }: Props) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function toggleCompliance(source: Source) {
    const next =
      source.complianceStatus === "ALLOWED"
        ? "DISALLOWED"
        : source.complianceStatus === "DISALLOWED"
          ? "PENDING"
          : "ALLOWED";

    setUpdating(source.id);
    try {
      const res = await fetch(
        `/api/experts/${expertId}/sources?sourceId=${source.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complianceStatus: next }),
        }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(`Compliance updated to ${next}`);
      await onUpdate();
    } catch {
      toast.error("Failed to update compliance");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.id}>
                <TableCell className="max-w-xs">
                  <div>
                    <p className="font-medium text-sm text-zinc-800 truncate">
                      {source.label ?? source.url}
                    </p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline truncate block"
                    >
                      {source.url.length > 60
                        ? source.url.slice(0, 60) + "..."
                        : source.url}
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-zinc-500">
                    {source.sourceType.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierColors[source.tier] ?? "bg-zinc-100 text-zinc-500"}`}
                  >
                    {source.tier}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium text-zinc-700">
                    {source.priorityScore.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${complianceColors[source.complianceStatus] ?? "bg-zinc-100"}`}
                    >
                      {source.complianceStatus}
                    </span>
                    {source.complianceNote && (
                      <p className="text-xs text-zinc-400 max-w-[180px] truncate">
                        {source.complianceNote}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={updating === source.id}
                    onClick={() => toggleCompliance(source)}
                    className="text-xs"
                  >
                    {updating === source.id ? "..." : "Toggle"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
