import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ExpertDetailClient } from "@/components/experts/ExpertDetailClient";

export default async function ExpertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const expert = await db.expert.findUnique({
    where: { id },
    include: {
      aliases: true,
      sourceEndpoints: {
        include: { policyProfile: true },
        orderBy: { priorityScore: "desc" },
      },
      discoveryRuns: { orderBy: { startedAt: "desc" } },
    },
  });

  if (!expert) notFound();
  if (expert.clerkUserId !== userId) redirect("/dashboard");

  return <ExpertDetailClient expert={expert} />;
}
