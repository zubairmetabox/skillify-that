import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpertStatus } from "@prisma/client";

const statusColors: Record<ExpertStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600",
  ACTIVE: "bg-green-100 text-green-700",
  ARCHIVED: "bg-red-100 text-red-600",
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const experts = await db.expert.findMany({
    where: { clerkUserId: userId },
    include: {
      aliases: true,
      sourceEndpoints: true,
      discoveryRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Expert Atlases</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Each expert profile runs through the full discovery pipeline.
          </p>
        </div>
        <Link href="/experts/new">
          <Button>+ New Expert</Button>
        </Link>
      </div>

      {experts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-zinc-400">No experts yet.</p>
            <Link href="/experts/new">
              <Button variant="outline">Create your first expert profile</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experts.map((expert) => {
            const latestRun = expert.discoveryRuns[0];
            const allowedSources = expert.sourceEndpoints.filter(
              (s) => s.complianceStatus === "ALLOWED"
            ).length;

            return (
              <Link key={expert.id} href={`/experts/${expert.id}`}>
                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold leading-tight text-zinc-900">
                        {expert.canonicalName}
                      </CardTitle>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[expert.status]}`}
                      >
                        {expert.status}
                      </span>
                    </div>
                    {expert.domain && (
                      <Badge variant="secondary" className="mt-1 w-fit text-xs">
                        {expert.domain}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-zinc-500">
                    <p>
                      <span className="font-medium text-zinc-700">
                        {expert.sourceEndpoints.length}
                      </span>{" "}
                      sources discovered ·{" "}
                      <span className="font-medium text-green-600">
                        {allowedSources}
                      </span>{" "}
                      approved
                    </p>
                    {latestRun && (
                      <p>
                        Last run:{" "}
                        <span
                          className={
                            latestRun.status === "COMPLETED"
                              ? "text-green-600"
                              : latestRun.status === "FAILED"
                                ? "text-red-500"
                                : "text-blue-500"
                          }
                        >
                          {latestRun.status}
                        </span>
                      </p>
                    )}
                    {expert.aliases.length > 0 && (
                      <p className="truncate text-xs text-zinc-400">
                        Also known as: {expert.aliases.map((a) => a.alias).join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
