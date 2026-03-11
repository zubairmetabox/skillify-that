"use client";

import { useState } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Candidate } from "@/app/api/experts/identify/route";

type Step = 1 | 2 | 3;

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Search" },
    { n: 2, label: "Identify" },
    { n: 3, label: "Confirm" },
  ] as const;

  return (
    <div className="flex items-center gap-2 text-xs mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted-foreground/40">—</span>}
          <span
            className={`flex items-center gap-1.5 font-medium ${
              current === s.n
                ? "text-foreground"
                : current > s.n
                  ? "text-muted-foreground"
                  : "text-muted-foreground/40"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                current > s.n
                  ? "bg-emerald-500 text-white"
                  : current === s.n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {current > s.n ? "✓" : s.n}
            </span>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function CandidateAvatar({ candidate }: { candidate: Candidate }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = candidate.canonicalName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (candidate.wikipediaThumb && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidate.wikipediaThumb}
        alt={candidate.canonicalName}
        className="w-14 h-14 rounded-full object-cover shrink-0 bg-muted"
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg shrink-0">
      {initials}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-4 flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-2.5 pt-1">
          <div className="h-4 bg-muted animate-pulse rounded w-40" />
          <div className="h-3 bg-muted animate-pulse rounded w-20" />
          <div className="h-3 bg-muted animate-pulse rounded w-full" />
          <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}

function candidateToForm(c: Candidate) {
  return {
    canonicalName: c.canonicalName,
    domain: c.domain,
    bio: c.bio,
    aliasesRaw: c.aliases.join(", "),
    knownUrlsRaw: c.knownUrls.join("\n"),
  };
}

const emptyForm = {
  canonicalName: "",
  domain: "",
  bio: "",
  aliasesRaw: "",
  knownUrlsRaw: "",
};

export default function NewExpertPage() {
  const router = useTransitionRouter();
  const [step, setStep] = useState<Step>(1);
  const [nameInput, setNameInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSearching(true);
    setStep(2);
    try {
      const res = await fetch("/api/experts/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      const data = await res.json();
      const found: Candidate[] = data.candidates ?? [];
      setCandidates(found);
      // Auto-populate name in case user skips to manual
      setForm({ ...emptyForm, canonicalName: nameInput.trim() });
    } catch {
      setCandidates([]);
      setForm({ ...emptyForm, canonicalName: nameInput.trim() });
    } finally {
      setSearching(false);
    }
  }

  function selectCandidate(c: Candidate) {
    setForm(candidateToForm(c));
    setStep(3);
  }

  function goManual() {
    setForm({ ...emptyForm, canonicalName: nameInput.trim() });
    setStep(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const aliases = form.aliasesRaw
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const knownUrls = form.knownUrlsRaw
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => {
        try { new URL(u); return true; } catch { return false; }
      });

    try {
      const res = await fetch("/api/experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalName: form.canonicalName,
          domain: form.domain || undefined,
          bio: form.bio || undefined,
          aliases,
          knownUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create expert");
        return;
      }
      toast.success("Expert profile created");
      router.push(`/experts/${data.expert.id}`);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  const obviousCandidate = candidates.length === 1 && candidates[0].isObvious ? candidates[0] : null;
  const multiCandidates = !obviousCandidate && candidates.length > 0 ? candidates : [];

  return (
    <div className="mx-auto max-w-xl space-y-2">
      <StepIndicator current={step} />

      {/* Step 1: Name Search */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Who do you want to Skillify?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter their name and we&apos;ll look them up to pre-fill their profile.
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              autoFocus
              placeholder="e.g. Alex Hormozi, Grant Cardone…"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="text-base"
            />
            <Button type="submit" disabled={!nameInput.trim()}>
              Search
            </Button>
          </form>
          <button
            type="button"
            onClick={() => { setForm(emptyForm); setStep(3); }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Skip — enter details manually
          </button>
        </div>
      )}

      {/* Step 2: Pick the Person */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {searching ? `Looking up "${nameInput}"…` : `Who is "${nameInput}"?`}
              </h1>
              {!searching && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {obviousCandidate
                    ? "We found a strong match."
                    : candidates.length > 0
                      ? "We found a few people by this name. Pick the right one."
                      : "We couldn't find a strong match. You can enter their details manually."}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors shrink-0"
            >
              ← Back
            </button>
          </div>

          {/* Loading skeletons */}
          {searching && (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Obvious single match */}
          {!searching && obviousCandidate && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <CandidateAvatar candidate={obviousCandidate} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{obviousCandidate.canonicalName}</p>
                      {obviousCandidate.domain && (
                        <Badge variant="secondary" className="text-xs">{obviousCandidate.domain}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                      {obviousCandidate.bio}
                    </p>
                    {obviousCandidate.knownUrls.length > 0 && (
                      <p className="text-xs text-muted-foreground/60 mt-1.5 truncate">
                        {obviousCandidate.knownUrls[0]}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button onClick={() => selectCandidate(obviousCandidate)}>
                    Yes, that&apos;s the one →
                  </Button>
                  <button
                    type="button"
                    onClick={goManual}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Not this person
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Multiple candidates */}
          {!searching && multiCandidates.length > 0 && (
            <div className="space-y-3">
              {multiCandidates.map((c, i) => (
                <Card key={i} className="hover:border-primary/30 transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <CandidateAvatar candidate={c} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{c.canonicalName}</p>
                          {c.domain && (
                            <Badge variant="secondary" className="text-xs">{c.domain}</Badge>
                          )}
                          {c.confidence === "high" && (
                            <Badge className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0">
                              Strong match
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                          {c.bio}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 self-center"
                        onClick={() => selectCandidate(c)}
                      >
                        Select
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* None of these */}
          {!searching && (
            <div className="pt-1">
              <button
                type="button"
                onClick={goManual}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {candidates.length === 0 ? "Enter details manually →" : "None of these / Enter manually →"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Review & Create</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the details below and edit anything that looks off.
              </p>
            </div>
            {step === 3 && (
              <button
                type="button"
                onClick={() => setStep(candidates.length > 0 ? 2 : 1)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors shrink-0"
              >
                ← Back
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Grant Cardone"
                value={form.canonicalName}
                onChange={(e) => setForm({ ...form, canonicalName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain">Domain / Expertise Area</Label>
              <Input
                id="domain"
                placeholder="e.g. sales, marketing, finance"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Brief description of who this expert is and what they're known for"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aliases">
                Known Aliases / Handles{" "}
                <span className="text-xs text-muted-foreground">(comma separated)</span>
              </Label>
              <Input
                id="aliases"
                placeholder="e.g. @grantcardone, 10X Guy, GC"
                value={form.aliasesRaw}
                onChange={(e) => setForm({ ...form, aliasesRaw: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="urls">
                Known Official URLs{" "}
                <span className="text-xs text-muted-foreground">(one per line)</span>
              </Label>
              <Textarea
                id="urls"
                placeholder={"https://grantcardone.com\nhttps://www.youtube.com/@GrantCardone"}
                rows={3}
                value={form.knownUrlsRaw}
                onChange={(e) => setForm({ ...form, knownUrlsRaw: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting || !form.canonicalName.trim()}>
                {submitting ? "Creating…" : "Create Expert Profile"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
