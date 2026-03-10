"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SourceTable } from "./SourceTable";
import { DiscoveryLog } from "./DiscoveryLog";
import { toast } from "sonner";
import type {
  Expert,
  ExpertAlias,
  SourceEndpoint,
  SourcePolicyProfile,
  DiscoveryRun,
} from "@prisma/client";

type ExpertFull = Expert & {
  aliases: ExpertAlias[];
  sourceEndpoints: (SourceEndpoint & { policyProfile: SourcePolicyProfile | null })[];
  discoveryRuns: DiscoveryRun[];
};

export function ExpertDetailClient({ expert: initialExpert }: { expert: ExpertFull }) {
  const router = useRouter();
  const [expert, setExpert] = useState(initialExpert);
  const [discovering, setDiscovering] = useState(false);
  const [polling, setPolling] = useState(false);

  const latestRun = expert.discoveryRuns[0];
  const isRunning = latestRun?.status === "RUNNING" || discovering;

  const allowedSources = expert.sourceEndpoints.filter(
    (s) => s.complianceStatus === "ALLOWED"
  );
  const disallowedSources = expert.sourceEndpoints.filter(
    (s) => s.complianceStatus === "DISALLOWED"
  );

  const sourceSummaryProgress =
    expert.sourceEndpoints.length > 0
      ? Math.round((allowedSources.length / expert.sourceEndpoints.length) * 100)
      : 0;

  const refreshData = useCallback(async () => {
    const res = await fetch(`/api/experts/${expert.id}/status`);
    if (!res.ok) return;
    const data = await res.json();
    setExpert(data.expert);
  }, [expert.id]);

  async function startDiscovery() {
    setDiscovering(true);
    try {
      const res = await fetch(`/api/experts/${expert.id}/discover`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to start discovery");
        setDiscovering(false);
        return;
      }

      toast.success("Discovery started — polling for results...");

      // Poll every 3s until completed/failed
      setPolling(true);
      const interval = setInterval(async () => {
        await refreshData();
        const runRes = await fetch(`/api/experts/${expert.id}/discover`);
        const runData = await runRes.json();
        const latest = runData.runs?.[0];
        if (latest?.status === "COMPLETED" || latest?.status === "FAILED") {
          clearInterval(interval);
          setDiscovering(false);
          setPolling(false);
          await refreshData();
          if (latest.status === "COMPLETED") {
            toast.success(`Discovery complete — ${latest.sourcesFound} sources found`);
            router.refresh();
          } else {
            toast.error("Discovery failed — check logs");
          }
        }
      }, 3000);
    } catch {
      toast.error("Network error");
      setDiscovering(false);
    }
  }

  const tierColors = {
    OFFICIAL: "bg-blue-100 text-blue-700",
    FIRST_PARTY: "bg-green-100 text-green-700",
    SECONDARY: "bg-yellow-100 text-yellow-700",
    TERTIARY: "bg-zinc-100 text-zinc-600",
  };

  const complianceColors = {
    ALLOWED: "bg-green-100 text-green-700",
    DISALLOWED: "bg-red-100 text-red-600",
    PENDING: "bg-yellow-100 text-yellow-700",
    REQUIRES_REVIEW: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">
              {expert.canonicalName}
            </h1>
            {expert.domain && (
              <Badge variant="secondary">{expert.domain}</Badge>
            )}
          </div>
          {expert.bio && (
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">{expert.bio}</p>
          )}
          {expert.aliases.length > 0 && (
            <p className="mt-1 text-xs text-zinc-400">
              Also known as:{" "}
              {expert.aliases.map((a) => a.alias).join(", ")}
            </p>
          )}
        </div>

        <Button
          onClick={startDiscovery}
          disabled={isRunning}
          className="shrink-0"
        >
          {isRunning
            ? polling
              ? "Running..."
              : "Starting..."
            : latestRun
              ? "Re-run Discovery"
              : "Run Discovery"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total Sources",
            value: expert.sourceEndpoints.length,
            sub: "discovered",
          },
          {
            label: "Approved",
            value: allowedSources.length,
            sub: "compliance: allowed",
            color: "text-green-600",
          },
          {
            label: "Blocked",
            value: disallowedSources.length,
            sub: "robots/TOS disallowed",
            color: "text-red-500",
          },
          {
            label: "Approval Rate",
            value: `${sourceSummaryProgress}%`,
            sub: "of discovered sources",
            color: "text-blue-600",
          },
        ].map(({ label, value, sub, color }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <p className="text-xs text-zinc-400">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color ?? "text-zinc-900"}`}>
                {value}
              </p>
              <p className="text-xs text-zinc-400">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {expert.sourceEndpoints.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
              <span>Source approval coverage</span>
              <span>{sourceSummaryProgress}%</span>
            </div>
            <Progress value={sourceSummaryProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">
            Sources ({expert.sourceEndpoints.length})
          </TabsTrigger>
          <TabsTrigger value="logs">
            Discovery Logs ({expert.discoveryRuns.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          {expert.sourceEndpoints.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-zinc-400">
                  No sources yet. Run discovery to find them.
                </p>
              </CardContent>
            </Card>
          ) : (
            <SourceTable
              sources={expert.sourceEndpoints}
              expertId={expert.id}
              tierColors={tierColors}
              complianceColors={complianceColors}
              onUpdate={refreshData}
            />
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          {expert.discoveryRuns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-zinc-400">No runs yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {expert.discoveryRuns.map((run) => (
                <DiscoveryLog key={run.id} run={run} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
