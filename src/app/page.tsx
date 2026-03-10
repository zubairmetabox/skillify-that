import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Nav */}
      <header className="border-b border-zinc-100 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">
            Skillify That
          </span>
          <div className="flex items-center gap-3">
            {userId ? (
              <Link href="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <SignInButton>
                  <Button variant="outline" size="sm">
                    Sign in
                  </Button>
                </SignInButton>
                <Link href="/sign-up">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <Badge variant="secondary" className="text-xs uppercase tracking-widest">
          Milestone 1 — Expert Discovery
        </Badge>

        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-zinc-900">
          Turn any expert into a{" "}
          <span className="text-blue-600">Skill Atlas</span>
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-zinc-500">
          Give us an expert and a domain. We discover their public content,
          extract reusable skill primitives, and synthesize validated{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm text-zinc-700">
            SKILL.md
          </code>{" "}
          packages — automatically.
        </p>

        <div className="flex gap-3">
          {userId ? (
            <Link href="/dashboard">
              <Button size="lg">Go to dashboard</Button>
            </Link>
          ) : (
            <Link href="/sign-up">
              <Button size="lg">Start building your atlas</Button>
            </Link>
          )}
        </div>

        {/* Pipeline steps */}
        <div className="mt-12 grid w-full max-w-4xl grid-cols-2 gap-4 text-left sm:grid-cols-4">
          {[
            { step: "01", label: "Expert Identity", desc: "Resolve aliases, handles, and official channels" },
            { step: "02", label: "Source Discovery", desc: "Find YouTube, web, RSS, and podcast sources" },
            { step: "03", label: "Compliance Gate", desc: "API-first, robots-aware, rate-limit compliant" },
            { step: "04", label: "Skill Atlas", desc: "Cluster atoms into validated SKILL.md packages" },
          ].map(({ step, label, desc }) => (
            <div
              key={step}
              className="rounded-xl border border-zinc-100 bg-zinc-50 p-5"
            >
              <p className="mb-2 text-xs font-semibold text-blue-500">{step}</p>
              <p className="mb-1 font-semibold text-zinc-800">{label}</p>
              <p className="text-sm text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
