"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SELECTABLE_MODELS } from "@/lib/groq-models";

type HistoryRow = { date: string; tokensUsed: number; requestCount: number };
type UsageData = {
  today: { tokensUsed: number; requestCount: number; dailyLimit: number };
  history: HistoryRow[];
  dailyLimit: number;
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SettingsPage() {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [savedModel, setSavedModel] = useState<string>("");
  const [savingModel, setSavingModel] = useState(false);

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoaded, setUsageLoaded] = useState(false);

  // Load settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSelectedModel(d.preferredModel);
        setSavedModel(d.preferredModel);
      })
      .catch(() => {});
  }, []);

  // Load usage
  useEffect(() => {
    fetch("/api/groq-usage?days=7")
      .then(async (r) => {
        const d = await r.json();
        if (r.ok && d?.today) setUsage(d);
      })
      .catch(() => {})
      .finally(() => setUsageLoaded(true));
  }, []);

  async function saveModel() {
    setSavingModel(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredModel: selectedModel }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSavedModel(selectedModel);
      toast.success("Model preference saved");
    } catch {
      toast.error("Failed to save model preference");
    } finally {
      setSavingModel(false);
    }
  }

  const todayPct = usage
    ? Math.min(usage.today.tokensUsed / usage.today.dailyLimit, 1)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure AI model and view token usage.
        </p>
      </div>

      {/* AI Model */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model</CardTitle>
          <CardDescription>
            Choose the Groq model used for ingestion, clustering, and synthesis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SELECTABLE_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModel(m.id)}
              className={cn(
                "w-full rounded-lg border p-4 text-left transition-colors",
                selectedModel === m.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    selectedModel === m.id
                      ? "border-primary"
                      : "border-muted-foreground/40"
                  )}
                >
                  {selectedModel === m.id && (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                </span>
                <div>
                  <p className="font-medium text-foreground">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </div>
            </button>
          ))}

          <div className="flex justify-end pt-2">
            <Button
              onClick={saveModel}
              disabled={savingModel || selectedModel === savedModel}
              size="sm"
            >
              {savingModel ? "Saving…" : "Save model"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Token Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Groq Token Usage</CardTitle>
          <CardDescription>
            Tracked locally from all AI calls. Resets daily.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {usage ? (
            <>
              {/* Today */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Today</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmt(usage.today.tokensUsed)} / {fmt(usage.today.dailyLimit)} tokens
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      todayPct < 0.5 && "bg-emerald-500",
                      todayPct >= 0.5 && todayPct < 0.8 && "bg-amber-500",
                      todayPct >= 0.8 && "bg-destructive"
                    )}
                    style={{ width: `${(todayPct * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {usage.today.requestCount} request{usage.today.requestCount !== 1 ? "s" : ""} today
                </p>
              </div>

              {/* History */}
              {usage.history.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Last 7 days</p>
                  <div className="divide-y divide-border rounded-lg border">
                    {usage.history.map((row) => {
                      const pct = Math.min(row.tokensUsed / usage.dailyLimit, 1);
                      return (
                        <div key={row.date} className="flex items-center gap-3 px-3 py-2">
                          <span className="w-14 shrink-0 text-xs text-muted-foreground">
                            {formatDate(row.date)}
                          </span>
                          <div className="flex-1">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  pct < 0.5 && "bg-emerald-500",
                                  pct >= 0.5 && pct < 0.8 && "bg-amber-500",
                                  pct >= 0.8 && "bg-destructive"
                                )}
                                style={{ width: `${(pct * 100).toFixed(1)}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {fmt(row.tokensUsed)}
                          </span>
                          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {row.requestCount} req
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : usageLoaded ? (
            <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Loading usage data…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
