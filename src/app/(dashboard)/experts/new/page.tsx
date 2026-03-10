"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function NewExpertPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    canonicalName: "",
    domain: "",
    bio: "",
    aliasesRaw: "",
    knownUrlsRaw: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const aliases = form.aliasesRaw
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const knownUrls = form.knownUrlsRaw
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => {
        try {
          new URL(u);
          return true;
        } catch {
          return false;
        }
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
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">New Expert Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">
          We'll use this to discover all their public sources and build a Skill Atlas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expert Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
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
              <Label htmlFor="bio">Bio (optional)</Label>
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
                <span className="text-xs text-zinc-400">(comma separated)</span>
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
                <span className="text-xs text-zinc-400">(one per line)</span>
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
              <Button type="submit" disabled={loading || !form.canonicalName}>
                {loading ? "Creating..." : "Create Expert Profile"}
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
        </CardContent>
      </Card>
    </div>
  );
}
