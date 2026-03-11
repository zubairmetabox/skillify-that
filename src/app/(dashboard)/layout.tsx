import { UserButton } from "@clerk/nextjs";
import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { NavigationProgress } from "@/components/NavigationProgress";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <NavigationProgress />
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight text-foreground">
            Skillify That
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="ghost" size="icon" title="Settings">
                <Settings className="size-4" />
              </Button>
            </Link>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
