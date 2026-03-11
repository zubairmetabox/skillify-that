"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceEndpoint, SourcePolicyProfile } from "@prisma/client";

type Source = SourceEndpoint & { policyProfile: SourcePolicyProfile | null };

type Props = {
  sources: Source[];
  expertId: string;
  tierColors: Record<string, string>;
  complianceColors: Record<string, string>;
  onUpdate: () => Promise<void>;
};

const COMPLIANCE_STEPS = [
  {
    value: "ALLOWED",
    icon: CheckCircle,
    active: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    hover: "hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
  },
  {
    value: "PENDING",
    icon: Clock,
    active: "bg-muted text-muted-foreground",
    hover: "hover:bg-muted/60",
  },
  {
    value: "DISALLOWED",
    icon: XCircle,
    active: "bg-destructive/10 text-destructive dark:bg-destructive/20",
    hover: "hover:bg-destructive/5 dark:hover:bg-destructive/10",
  },
] as const;

function ComplianceToggle({
  sourceId,
  current,
  disabled,
  onSelect,
}: {
  sourceId: string;
  current: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-1">
      {COMPLIANCE_STEPS.map(({ value, icon: Icon, active, hover }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            disabled={disabled}
            onClick={() => !isActive && onSelect(value)}
            title={value}
            className={cn(
              "flex items-center justify-center rounded-full p-1.5 transition-colors disabled:opacity-40",
              isActive ? active : cn("text-muted-foreground/40", hover)
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export function SourceTable({ sources, expertId, tierColors, complianceColors, onUpdate }: Props) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function setCompliance(source: Source, next: string) {
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
      toast.success(`Set to ${next}`);
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
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.id}>
                <TableCell className="max-w-xs">
                  <div>
                    <p className="font-medium text-sm text-foreground truncate">
                      {source.label ?? source.url}
                    </p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate block"
                    >
                      {source.url.length > 60
                        ? source.url.slice(0, 60) + "..."
                        : source.url}
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {source.sourceType.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierColors[source.tier] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {source.tier}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium text-foreground">
                    {source.priorityScore.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${complianceColors[source.complianceStatus] ?? "bg-muted"}`}
                    >
                      {source.complianceStatus}
                    </span>
                    {source.complianceNote && (
                      <p className="text-xs text-muted-foreground/70 max-w-[180px] truncate">
                        {source.complianceNote}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ComplianceToggle
                    sourceId={source.id}
                    current={source.complianceStatus}
                    disabled={updating === source.id}
                    onSelect={(next) => setCompliance(source, next)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
