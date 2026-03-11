"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SourceTable } from "./SourceTable";
import { DiscoveryLog } from "./DiscoveryLog";
import { PipelineModal, type PipelineModalState } from "./PipelineModal";
import { toast } from "sonner";
import type {
  Expert,
  ExpertAlias,
  SourceEndpoint,
  SourcePolicyProfile,
  DiscoveryRun,
  IngestionRun,
  SkillAtom,
  SkillAtlas,
  SkillCluster,
  SkillPackage,
} from "@prisma/client";

type ExpertFull = Expert & {
  aliases: ExpertAlias[];
  sourceEndpoints: (SourceEndpoint & { policyProfile: SourcePolicyProfile | null })[];
  discoveryRuns: DiscoveryRun[];
};

type AtomWithRecord = SkillAtom & {
  contentRecord: { title: string | null; url: string; contentType: string };
};

type StepStatus = "locked" | "active" | "done";

const ATOM_TYPE_COLORS: Record<string, string> = {
  PRINCIPLE: "bg-primary/10 text-primary",
  TACTIC: "bg-accent text-accent-foreground",
  SCRIPT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  FRAMEWORK: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DIAGNOSTIC: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  OBJECTION_RESPONSE: "bg-destructive/10 text-destructive",
  WORKFLOW: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  INSIGHT: "bg-muted text-muted-foreground",
};

const ATTRIBUTION_COLORS: Record<string, string> = {
  L1_DIRECT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  L2_FIRST_PARTY: "bg-primary/10 text-primary",
  L3_SECONDARY: "bg-muted text-muted-foreground",
};

function StepHeader({
  number,
  title,
  status,
  badge,
}: {
  number: number;
  title: string;
  status: StepStatus;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          status === "done"
            ? "bg-emerald-500 text-white"
            : status === "active"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {status === "done" ? "✓" : number}
      </span>
      <span
        className={`font-medium text-sm ${
          status === "locked" ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {title}
      </span>
      {status === "locked" && (
        <span className="text-muted-foreground text-xs">🔒</span>
      )}
      {badge && (
        <span className="ml-auto text-xs text-muted-foreground pr-2">{badge}</span>
      )}
    </div>
  );
}

export function ExpertDetailClient({ expert: initialExpert }: { expert: ExpertFull }) {
  const router = useTransitionRouter();
  const [expert, setExpert] = useState(initialExpert);
  const [ingestionRuns, setIngestionRuns] = useState<IngestionRun[]>([]);
  const [atoms, setAtoms] = useState<AtomWithRecord[]>([]);
  const [atomCount, setAtomCount] = useState(0);
  const [recordCount, setRecordCount] = useState(0);
  const [atlas, setAtlas] = useState<(SkillAtlas & { clusters: (SkillCluster & { packages: SkillPackage[] })[] }) | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(["discovery"]);
  const [modal, setModal] = useState<PipelineModalState>({
    open: false,
    title: "",
    status: "idle",
    log: [],
    summary: undefined,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({});
  const [reviewNotesDraft, setReviewNotesDraft] = useState<Record<string, string>>({});
  const [ingestionConfig, setIngestionConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("skillify:ingestionConfig");
      return saved ? JSON.parse(saved) : { maxVideos: 20, maxPages: 8, maxSources: 10 };
    } catch { return { maxVideos: 20, maxPages: 8, maxSources: 10 }; }
  });

  function updateConfig(key: string, value: number) {
    const next = { ...ingestionConfig, [key]: value };
    setIngestionConfig(next);
    try { localStorage.setItem("skillify:ingestionConfig", JSON.stringify(next)); } catch { /* ignore */ }
  }

  const allowedSources = expert.sourceEndpoints.filter((s) => s.complianceStatus === "ALLOWED");
  const disallowedSources = expert.sourceEndpoints.filter((s) => s.complianceStatus === "DISALLOWED");
  const sourceSummaryProgress =
    expert.sourceEndpoints.length > 0
      ? Math.round((allowedSources.length / expert.sourceEndpoints.length) * 100)
      : 0;

  // Step completion states
  const step1Done = expert.discoveryRuns.length > 0 && expert.sourceEndpoints.length > 0;
  const step2Done = allowedSources.length > 0;
  const step3Done = atomCount > 0;
  const step4Done = atomCount > 0;
  const step5Done = atlas !== null;

  const step2Locked = !step1Done;
  const step3Locked = !step2Done;
  const step4Locked = !step3Done;
  const step5Locked = !step4Done;

  // Auto-open the current step when data loads (controlled accordion)
  useEffect(() => {
    const currentStep = !step1Done ? "discovery"
      : !step2Done ? "sources"
      : !step3Done ? "ingestion"
      : !step4Done ? "atoms"
      : "atlas";
    setOpenSections((prev) => prev.includes(currentStep) ? prev : [...prev, currentStep]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atomCount, atlas]);

  const refreshData = useCallback(async () => {
    const res = await fetch(`/api/experts/${expert.id}/status`);
    if (!res.ok) return;
    const data = await res.json();
    setExpert(data.expert);
  }, [expert.id]);

  const loadIngestionData = useCallback(async () => {
    const [ingestRes, atomsRes] = await Promise.all([
      fetch(`/api/experts/${expert.id}/ingest`),
      fetch(`/api/experts/${expert.id}/atoms?limit=50`),
    ]);
    if (ingestRes.ok) {
      const d = await ingestRes.json();
      setIngestionRuns(d.runs ?? []);
      setAtomCount(d.atomCount ?? 0);
      setRecordCount(d.recordCount ?? 0);
    }
    if (atomsRes.ok) {
      const d = await atomsRes.json();
      setAtoms(d.atoms ?? []);
    }
  }, [expert.id]);

  const loadAtlasData = useCallback(async () => {
    try {
      const res = await fetch(`/api/experts/${expert.id}/build-atlas`);
      const d = await res.json();
      setAtlas(d.atlas?.packageCount > 0 ? d.atlas : null);
    } catch {
      // non-fatal
    }
  }, [expert.id]);

  useEffect(() => {
    loadIngestionData();
    loadAtlasData();
  }, [loadIngestionData, loadAtlasData]);

  function stopPipeline() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setModal((m) => ({
      ...m,
      status: "stopped",
      summary: "Stopped by user. The task may still be running in the background.",
    }));
  }

  function closeModal() {
    setModal((m) => ({ ...m, open: false }));
  }

  async function startDiscovery() {
    setModal({ open: true, title: "Running Discovery", status: "running", log: ["Starting discovery pipeline..."], currentStep: "Initializing..." });
    try {
      const res = await fetch(`/api/experts/${expert.id}/discover`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setModal((m) => ({ ...m, status: "failed", log: [...m.log, `✗ ${data.error ?? "Failed to start"}`], summary: "Discovery failed to start." }));
        return;
      }
      intervalRef.current = setInterval(async () => {
        const runRes = await fetch(`/api/experts/${expert.id}/discover`);
        const runData = await runRes.json();
        const latest = runData.runs?.[0];
        if (latest?.log) {
          const lastLine = latest.log[latest.log.length - 1] ?? "";
          setModal((m) => ({ ...m, log: latest.log, currentStep: lastLine }));
        }
        if (latest?.status === "COMPLETED" || latest?.status === "FAILED") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          await refreshData();
          if (latest.status === "COMPLETED") {
            setModal((m) => ({ ...m, status: "completed", log: latest.log ?? m.log, currentStep: undefined, summary: `✓ Found ${latest.sourcesFound} sources` }));
            router.refresh();
          } else {
            setModal((m) => ({ ...m, status: "failed", log: latest.log ?? m.log, currentStep: undefined, summary: "Discovery failed — check logs below." }));
          }
        }
      }, 2500);
    } catch {
      setModal((m) => ({ ...m, status: "failed", log: [...m.log, "✗ Network error"], summary: "Network error." }));
    }
  }

  async function startIngestion() {
    setModal({ open: true, title: "Running Ingestion", status: "running", log: ["Starting ingestion pipeline..."], currentStep: "Initializing..." });
    try {
      const res = await fetch(`/api/experts/${expert.id}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingestionConfig),
      });
      const data = await res.json();
      if (!res.ok) {
        setModal((m) => ({ ...m, status: "failed", log: [...m.log, `✗ ${data.error ?? "Failed to start"}`], summary: "Ingestion failed to start." }));
        return;
      }
      intervalRef.current = setInterval(async () => {
        const statusRes = await fetch(`/api/experts/${expert.id}/ingest`);
        const statusData = await statusRes.json();
        const latest = statusData.runs?.[0];
        if (latest?.log) {
          const lastLine = latest.log[latest.log.length - 1] ?? "";
          setModal((m) => ({ ...m, log: latest.log, currentStep: lastLine }));
        }
        if (latest?.status === "COMPLETED" || latest?.status === "FAILED") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          await loadIngestionData();
          if (latest.status === "COMPLETED") {
            setModal((m) => ({ ...m, status: "completed", log: latest.log ?? m.log, currentStep: undefined, summary: `✓ ${latest.recordsCreated} records · ${latest.atomsExtracted} atoms extracted` }));
          } else {
            setModal((m) => ({ ...m, status: "failed", log: latest.log ?? m.log, currentStep: undefined, summary: "Ingestion failed — check logs below." }));
          }
        }
      }, 3000);
    } catch {
      setModal((m) => ({ ...m, status: "failed", log: [...m.log, "✗ Network error"], summary: "Network error." }));
    }
  }

  function pollAtlasBuild() {
    intervalRef.current = setInterval(async () => {
      const atlasRes = await fetch(`/api/experts/${expert.id}/build-atlas`);
      const atlasData = await atlasRes.json();
      const a = atlasData.atlas;
      if (!a) return;

      // Show real server log
      if (a.buildLog?.length > 0) {
        const lastLine = a.buildLog[a.buildLog.length - 1] ?? "";
        setModal((m) => ({ ...m, log: a.buildLog, currentStep: lastLine }));
      }

      if (a.buildStatus === "COMPLETED" && a.packageCount > 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setAtlas(a);
        setModal((m) => ({
          ...m,
          status: "completed",
          currentStep: undefined,
          summary: `✓ ${a.title} — ${a.packageCount} packages · ${(a.coverageScore * 100).toFixed(0)}% coverage`,
        }));
      } else if (a.buildStatus === "FAILED") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        // Check if there are partial clusters we can resume from
        const hasClusters = (a.clusters?.length ?? 0) > 0;
        const hasMissingPackages = a.clusters?.some((c: { packages: unknown[] }) => c.packages.length === 0);
        setModal((m) => ({
          ...m,
          status: "failed",
          currentStep: undefined,
          canResume: hasClusters && hasMissingPackages,
          summary: "Atlas build failed. See log above.",
        }));
      }
    }, 4000);

    // 8 min safety timeout
    setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setModal((m) =>
          m.status === "running"
            ? { ...m, status: "failed", currentStep: undefined, canResume: true, summary: "Timed out. Use Resume to continue or Restart to try again." }
            : m
        );
      }
    }, 480_000);
  }

  async function startBuildAtlas() {
    if (atomCount === 0) {
      toast.error("No skill atoms found. Run ingestion first.");
      return;
    }
    setModal({ open: true, title: "Building Skill Atlas", status: "running", log: ["Sending request..."], currentStep: "Sending request..." });
    try {
      const res = await fetch(`/api/experts/${expert.id}/build-atlas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModal((m) => ({ ...m, status: "failed", log: [...m.log, `✗ ${data.error ?? "Failed to start"}`], summary: "Atlas build failed to start." }));
        return;
      }
      pollAtlasBuild();
    } catch {
      setModal((m) => ({ ...m, status: "failed", log: [...m.log, "✗ Network error"], summary: "Network error." }));
    }
  }

  async function resumeBuildAtlas() {
    setModal((m) => ({
      ...m,
      open: true,
      title: "Building Skill Atlas",
      status: "running",
      currentStep: "Resuming...",
      log: [...m.log, "Resuming atlas build..."],
      canResume: false,
    }));
    try {
      const res = await fetch(`/api/experts/${expert.id}/build-atlas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModal((m) => ({ ...m, status: "failed", log: [...m.log, `✗ ${data.error ?? "Failed to resume"}`], summary: "Resume failed." }));
        return;
      }
      pollAtlasBuild();
    } catch {
      setModal((m) => ({ ...m, status: "failed", log: [...m.log, "✗ Network error"], summary: "Network error." }));
    }
  }

  async function runValidation() {
    if (!atlas) return;
    setIsValidating(true);
    try {
      const res = await fetch(`/api/atlas/${atlas.id}/validate`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Validation failed"); return; }
      await loadAtlasData();
      toast.success("Validation complete");
    } catch {
      toast.error("Network error running validation");
    } finally {
      setIsValidating(false);
    }
  }

  async function updatePackage(pkgId: string, patch: { releaseState?: string; reviewNotes?: string }) {
    if (!atlas) return;
    const res = await fetch(`/api/atlas/${atlas.id}/packages/${pkgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { toast.error("Failed to update package"); return; }
    await loadAtlasData();
  }

  const isBuildingAtlas = modal.status === "running" && modal.title.includes("Atlas");

  const tierColors = {
    OFFICIAL: "bg-primary/10 text-primary",
    FIRST_PARTY: "bg-accent text-accent-foreground",
    SECONDARY: "bg-muted text-muted-foreground",
    TERTIARY: "bg-muted/50 text-muted-foreground",
  };

  const complianceColors = {
    ALLOWED: "bg-accent text-accent-foreground",
    DISALLOWED: "bg-destructive/10 text-destructive",
    PENDING: "bg-muted text-muted-foreground",
    REQUIRES_REVIEW: "bg-primary/10 text-primary",
  };

  const latestRun = expert.discoveryRuns[0];
  const isRunning = modal.status === "running" && modal.title.includes("Discovery");
  const isIngesting = modal.status === "running" && modal.title.includes("Ingestion");

  return (
    <>
      <PipelineModal
        state={modal}
        onClose={closeModal}
        onStop={stopPipeline}
        onResume={modal.title.includes("Atlas") ? resumeBuildAtlas : undefined}
        onRestart={modal.title.includes("Atlas") ? startBuildAtlas : undefined}
      />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{expert.canonicalName}</h1>
            {expert.domain && <Badge variant="secondary">{expert.domain}</Badge>}
          </div>
          {expert.bio && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{expert.bio}</p>
          )}
          {expert.aliases.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Also known as: {expert.aliases.map((a) => a.alias).join(", ")}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-5">
          {[
            { label: "Sources", value: expert.sourceEndpoints.length, sub: "discovered", color: "text-foreground" },
            { label: "Approved", value: allowedSources.length, sub: "allowed", color: "text-primary" },
            { label: "Blocked", value: disallowedSources.length, sub: "disallowed", color: "text-destructive" },
            { label: "Records", value: recordCount, sub: "content ingested", color: "text-foreground" },
            { label: "Skill Atoms", value: atomCount, sub: "extracted", color: "text-primary" },
          ].map(({ label, value, sub, color }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {expert.sourceEndpoints.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Source approval coverage</span>
                <span>{sourceSummaryProgress}%</span>
              </div>
              <Progress value={sourceSummaryProgress} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Workflow Accordion */}
        <Accordion multiple value={openSections} onValueChange={setOpenSections} className="space-y-2">
          {/* Step 1: Discovery */}
          <AccordionItem value="discovery" className="border rounded-lg px-4">
            <AccordionTrigger className="py-4 hover:no-underline">
              <StepHeader
                number={1}
                title="Discovery"
                status={step1Done ? "done" : "active"}
                badge={
                  expert.discoveryRuns.length > 0
                    ? `${expert.discoveryRuns.length} run${expert.discoveryRuns.length !== 1 ? "s" : ""} · ${expert.sourceEndpoints.length} sources found`
                    : undefined
                }
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Discover all web sources associated with this expert — their website, YouTube channel, podcast, articles, and more.
              </p>
              <Button onClick={startDiscovery} disabled={isRunning} size="sm">
                {isRunning ? "Discovering..." : latestRun ? "Re-discover" : "Discover Sources"}
              </Button>
              {expert.discoveryRuns.length > 0 && (
                <div className="space-y-3 mt-2">
                  {expert.discoveryRuns.map((run) => (
                    <DiscoveryLog key={run.id} run={run} />
                  ))}
                </div>
              )}
              {expert.discoveryRuns.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">No runs yet. Click &quot;Discover Sources&quot; to start.</p>
                  </CardContent>
                </Card>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Step 2: Review Sources */}
          <AccordionItem
            value="sources"
            className={`border rounded-lg px-4 ${step2Locked ? "opacity-60" : ""}`}
            disabled={step2Locked}
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <StepHeader
                number={2}
                title="Review Sources"
                status={step2Locked ? "locked" : step2Done ? "done" : "active"}
                badge={
                  step2Locked
                    ? "Complete Discovery first"
                    : `${allowedSources.length} approved · ${disallowedSources.length} blocked`
                }
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Review each discovered source and approve or block it. Only approved sources will be ingested.
              </p>
              {expert.sourceEndpoints.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">No sources yet. Run discovery to find them.</p>
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
            </AccordionContent>
          </AccordionItem>

          {/* Step 3: Ingestion */}
          <AccordionItem
            value="ingestion"
            className={`border rounded-lg px-4 ${step3Locked ? "opacity-60" : ""}`}
            disabled={step3Locked}
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <StepHeader
                number={3}
                title="Ingestion"
                status={step3Locked ? "locked" : step3Done ? "done" : "active"}
                badge={
                  step3Locked
                    ? "Approve at least one source first"
                    : ingestionRuns.length > 0
                      ? `${ingestionRuns.length} run${ingestionRuns.length !== 1 ? "s" : ""} · ${recordCount} records`
                      : undefined
                }
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Fetch and process content from all approved sources. The pipeline will extract raw text and prepare it for atom mining.
              </p>
              {/* Advanced ingestion settings */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="text-[10px]">{showAdvanced ? "▾" : "▸"}</span>
                  Advanced settings
                </button>
                {showAdvanced && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-3">
                    {[
                      { key: "maxVideos", label: "YouTube videos / channel", min: 5, max: 100, step: 5 },
                      { key: "maxPages",  label: "Web pages / site",          min: 3, max: 50,  step: 1 },
                      { key: "maxSources",label: "Sources to process",        min: 3, max: 20,  step: 1 },
                    ].map(({ key, label, min, max, step }) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-foreground">{label}</label>
                          <span className="text-xs font-semibold tabular-nums text-primary w-8 text-right">{ingestionConfig[key]}</span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={ingestionConfig[key]}
                          onChange={(e) => updateConfig(key, Number(e.target.value))}
                          className="w-full h-1.5 accent-primary cursor-pointer"
                        />
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground/60 pt-1">Higher values = more content but slower ingestion.</p>
                  </div>
                )}
              </div>
              <Button
                onClick={startIngestion}
                disabled={isIngesting || allowedSources.length === 0}
                size="sm"
              >
                {isIngesting ? "Ingesting..." : atomCount > 0 ? "Re-ingest" : "Run Ingestion"}
              </Button>
              {ingestionRuns.length > 0 ? (
                <div className="space-y-3 mt-2">
                  {ingestionRuns.map((run) => (
                    <Card key={run.id}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-sm font-semibold ${
                                run.status === "COMPLETED"
                                  ? "text-primary"
                                  : run.status === "FAILED"
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {run.status}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(run.startedAt).toLocaleString()}
                            </span>
                          </div>
                          {run.status === "COMPLETED" && (
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>{run.sourcesProcessed} sources</span>
                              <span>{run.recordsCreated} records</span>
                              <span className="font-medium text-primary">{run.atomsExtracted} atoms</span>
                            </div>
                          )}
                        </div>
                        <div className="rounded-lg bg-sidebar p-3 font-mono text-xs text-sidebar-foreground space-y-0.5 max-h-40 overflow-y-auto">
                          {run.log.map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">No ingestion runs yet.</p>
                  </CardContent>
                </Card>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Step 4: Skill Atoms */}
          <AccordionItem
            value="atoms"
            className={`border rounded-lg px-4 ${step4Locked ? "opacity-60" : ""}`}
            disabled={step4Locked}
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <StepHeader
                number={4}
                title="Skill Atoms"
                status={step4Locked ? "locked" : step4Done ? "done" : "active"}
                badge={
                  step4Locked
                    ? "Run Ingestion first"
                    : `${atomCount} atom${atomCount !== 1 ? "s" : ""} extracted`
                }
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Discrete knowledge primitives extracted from the expert&apos;s content — principles, tactics, frameworks, scripts, and more.
              </p>
              {atoms.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No atoms yet. Approve sources then click &quot;Run Ingestion&quot;.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {atoms.map((atom) => (
                    <Card key={atom.id}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ATOM_TYPE_COLORS[atom.atomType] ?? "bg-muted text-muted-foreground"}`}>
                              {atom.atomType.replace(/_/g, " ")}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ATTRIBUTION_COLORS[atom.attributionLevel] ?? "bg-muted"}`}>
                              {atom.attributionLevel}
                            </span>
                            {atom.domain && (
                              <span className="rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                                {atom.domain}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                            <span title="Evidence strength">E: {(atom.evidenceStrength * 100).toFixed(0)}%</span>
                            <span title="Domain relevance">R: {(atom.domainRelevance * 100).toFixed(0)}%</span>
                          </div>
                        </div>

                        <p className="font-semibold text-sm text-foreground">{atom.title}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{atom.body}</p>

                        {atom.sourceQuote && (
                          <blockquote className="border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground/70 italic">
                            &ldquo;{atom.sourceQuote}&rdquo;
                          </blockquote>
                        )}

                        {atom.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {atom.tags.map((tag) => (
                              <span key={tag} className="rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground/50">
                          From: {atom.contentRecord.title ?? atom.contentRecord.url}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Step 5: Skill Atlas */}
          <AccordionItem
            value="atlas"
            className={`border rounded-lg px-4 ${step5Locked ? "opacity-60" : ""}`}
            disabled={step5Locked}
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <StepHeader
                number={5}
                title="Skill Atlas"
                status={step5Locked ? "locked" : step5Done ? "done" : "active"}
                badge={
                  step5Locked
                    ? "Extract atoms first"
                    : atlas
                      ? `${atlas.packageCount} packages · ${(atlas.coverageScore * 100).toFixed(0)}% coverage`
                      : "Not built yet"
                }
              />
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Cluster atoms into skill domains and synthesize structured skill packages with steps, examples, and anti-patterns.
              </p>
              <Button
                onClick={startBuildAtlas}
                disabled={isBuildingAtlas || atomCount === 0}
                size="sm"
              >
                {isBuildingAtlas ? "Building Atlas..." : atlas ? "Rebuild Atlas" : "Build Atlas"}
              </Button>

              {!atlas ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {atomCount === 0
                        ? "No skill atoms yet. Run ingestion first, then build the atlas."
                        : "Atlas not built yet. Click \"Build Atlas\" to synthesize skill packages."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Atlas header */}
                  <Card>
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">{atlas.title}</h2>
                          <p className="text-sm text-muted-foreground mt-1">{atlas.domain}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Coverage</p>
                            <p className="text-2xl font-bold text-primary">{(atlas.coverageScore * 100).toFixed(0)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Packages</p>
                            <p className="text-2xl font-bold text-foreground">{atlas.packageCount}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/api/atlas/${atlas.id}/export`, "_blank")}
                          >
                            Export .md
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={runValidation}
                            disabled={isValidating}
                          >
                            {isValidating ? "Validating..." : "Run Validation"}
                          </Button>
                          {atlas.validationStatus && (
                            <Badge
                              className={
                                atlas.validationStatus === "PASSED"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : atlas.validationStatus === "FAILED"
                                    ? "bg-destructive/10 text-destructive"
                                    : atlas.validationStatus === "PARTIAL"
                                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                      : "bg-muted text-muted-foreground"
                              }
                            >
                              {atlas.validationStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {atlas.gaps.length > 0 && (
                        <div className="mt-4 rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Gaps & Notes</p>
                          <ul className="space-y-0.5">
                            {(atlas.gaps as string[]).map((gap, i) => (
                              <li key={i} className="text-xs text-muted-foreground">• {gap}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {atlas.atlasValidationNotes && (
                        <div className="mt-3 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200/50 p-3">
                          <details>
                            <summary className="text-xs font-medium text-orange-700 dark:text-orange-400 cursor-pointer">
                              Cross-package issues
                            </summary>
                            <ul className="mt-2 space-y-0.5">
                              {atlas.atlasValidationNotes.split("\n").filter(Boolean).map((note, i) => (
                                <li key={i} className="text-xs text-orange-700/80 dark:text-orange-400/80">• {note}</li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Clusters + Packages */}
                  {atlas.clusters?.map((cluster) => (
                    <div key={cluster.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-foreground">{cluster.name}</h3>
                        <Badge variant="secondary">{cluster.packages.length} packages</Badge>
                      </div>
                      {cluster.description && (
                        <p className="text-xs text-muted-foreground -mt-1">{cluster.description}</p>
                      )}
                      <div className="space-y-3">
                        {cluster.packages.map((pkg) => {
                          const steps = pkg.steps as { order: number; action: string; detail: string }[];
                          const examples = pkg.examples as { scenario: string; application: string }[];
                          const antiPatterns = pkg.antiPatterns as { pattern: string; why: string }[];
                          return (
                            <Card key={pkg.id}>
                              <CardContent className="pt-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <p className="font-semibold text-sm text-foreground">{pkg.name}</p>
                                    <Badge
                                      className={`text-[10px] shrink-0 ${
                                        pkg.releaseState === "APPROVED"
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          : pkg.releaseState === "REVIEWED"
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                            : pkg.releaseState === "DEPRECATED"
                                              ? "bg-destructive/10 text-destructive"
                                              : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {pkg.releaseState}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-muted-foreground">
                                      {(pkg.coverageScore * 100).toFixed(0)}% coverage
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-muted-foreground"
                                      onClick={() => window.open(`/api/atlas/${atlas!.id}/packages/${pkg.id}/export`, "_blank")}
                                    >
                                      ↓ .md
                                    </Button>
                                  </div>
                                </div>

                                {pkg.trigger && (
                                  <div className="rounded bg-primary/5 px-3 py-2">
                                    <p className="text-xs font-medium text-primary mb-0.5">Trigger</p>
                                    <p className="text-xs text-foreground">{pkg.trigger}</p>
                                  </div>
                                )}

                                {steps.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Steps</p>
                                    <ol className="space-y-1">
                                      {steps.map((step) => (
                                        <li key={step.order} className="text-xs text-foreground">
                                          <span className="font-medium">{step.order}. {step.action}</span>
                                          {step.detail && <span className="text-muted-foreground"> — {step.detail}</span>}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}

                                {examples.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Examples</p>
                                    <ul className="space-y-1">
                                      {examples.map((ex, i) => (
                                        <li key={i} className="text-xs text-foreground">
                                          <span className="font-medium">{ex.scenario}:</span>
                                          <span className="text-muted-foreground"> {ex.application}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {antiPatterns.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Anti-patterns</p>
                                    <ul className="space-y-1">
                                      {antiPatterns.map((ap, i) => (
                                        <li key={i} className="text-xs text-foreground">
                                          <span className="text-destructive">✗</span>{" "}
                                          <span className="font-medium">{ap.pattern}</span>
                                          {ap.why && <span className="text-muted-foreground"> — {ap.why}</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {pkg.evidenceSummary && (
                                  <p className="text-xs text-muted-foreground/60 italic">{pkg.evidenceSummary}</p>
                                )}

                                {((pkg.validationErrors?.length ?? 0) > 0 || (pkg.validationWarnings?.length ?? 0) > 0) && (
                                  <div className="rounded border border-border bg-muted/20 p-2.5 space-y-1.5">
                                    <details open={(pkg.validationErrors?.length ?? 0) > 0}>
                                      <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                                        Validation ({pkg.validationErrors?.length ?? 0} errors, {pkg.validationWarnings?.length ?? 0} warnings)
                                      </summary>
                                      <div className="mt-1.5 space-y-1">
                                        {(pkg.validationErrors ?? []).map((e, i) => (
                                          <p key={i} className="text-xs text-destructive">✗ {e}</p>
                                        ))}
                                        {(pkg.validationWarnings ?? []).map((w, i) => (
                                          <p key={i} className="text-xs text-orange-600 dark:text-orange-400">⚠ {w}</p>
                                        ))}
                                      </div>
                                    </details>
                                  </div>
                                )}

                                {atlas.validationStatus && (
                                  <div className="pt-1.5 border-t border-border/50 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {pkg.releaseState !== "APPROVED" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                          onClick={() => updatePackage(pkg.id, { releaseState: "APPROVED" })}
                                        >
                                          Approve
                                        </Button>
                                      )}
                                      {pkg.releaseState !== "REVIEWED" && pkg.releaseState !== "APPROVED" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs text-blue-600 hover:bg-blue-50"
                                          onClick={() => updatePackage(pkg.id, { releaseState: "REVIEWED" })}
                                        >
                                          Mark Reviewed
                                        </Button>
                                      )}
                                      {pkg.releaseState !== "DEPRECATED" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                                          onClick={() => updatePackage(pkg.id, { releaseState: "DEPRECATED" })}
                                        >
                                          Deprecate
                                        </Button>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <textarea
                                        placeholder="Reviewer notes (optional)..."
                                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                        rows={2}
                                        value={reviewNotesDraft[pkg.id] ?? pkg.reviewNotes ?? ""}
                                        onChange={(e) =>
                                          setReviewNotesDraft((prev) => ({ ...prev, [pkg.id]: e.target.value }))
                                        }
                                      />
                                      {(reviewNotesDraft[pkg.id] !== undefined &&
                                        reviewNotesDraft[pkg.id] !== (pkg.reviewNotes ?? "")) && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          disabled={savingNotes[pkg.id]}
                                          onClick={async () => {
                                            setSavingNotes((prev) => ({ ...prev, [pkg.id]: true }));
                                            await updatePackage(pkg.id, { reviewNotes: reviewNotesDraft[pkg.id] });
                                            setSavingNotes((prev) => ({ ...prev, [pkg.id]: false }));
                                          }}
                                        >
                                          {savingNotes[pkg.id] ? "Saving..." : "Save Notes"}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
