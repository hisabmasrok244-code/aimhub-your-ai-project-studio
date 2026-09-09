import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { AppShell } from "@/components/aimhub/AppShell";
import { StatusBadge } from "@/components/aimhub/StatusBadge";
import { Button } from "@/components/ui/button";
import { listBuilds } from "@/lib/aimhub/builds.functions";
import { listProjects } from "@/lib/aimhub/projects.functions";

export const Route = createFileRoute("/_authenticated/actions")({
  head: () => ({
    meta: [
      { title: "Actions — AimHub" },
      { name: "description", content: "سجل عمليات البناء وحالتها وروابط تنزيل APK." },
      { property: "og:title", content: "Actions — AimHub" },
      { property: "og:description", content: "تابع كل عمليات البناء في AimHub." },
    ],
  }),
  component: ActionsPage,
});

function ActionsPage() {
  const buildsFn = useServerFn(listBuilds);
  const projectsFn = useServerFn(listProjects);

  const builds = useQuery({
    queryKey: ["builds", "all"],
    queryFn: () => buildsFn({ data: {} }),
    refetchInterval: 8000,
  });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => projectsFn() });

  const nameOf = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? "مشروع";

  return (
    <AppShell title="Actions" subtitle="سجل عمليات البناء">
      {(builds.data ?? []).length === 0 ? (
        <p className="panel p-4 text-sm text-muted-foreground">
          لا توجد عمليات بناء بعد. افتح مشروعًا وشغّل Build.
        </p>
      ) : (
        <ul className="space-y-2">
          {(builds.data ?? []).map((build) => (
            <li key={build.id} className="panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: build.project_id }}
                    className="truncate font-medium"
                  >
                    {nameOf(build.project_id)} — بناء #{build.number}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {new Date(build.created_at).toLocaleString("ar")}
                  </p>
                </div>
                <StatusBadge status={build.status} />
              </div>
              {build.error ? (
                <p className="mt-2 line-clamp-2 text-xs text-destructive">{build.error}</p>
              ) : null}
              {build.status === "success" && build.artifact_url ? (
                <Button asChild size="sm" className="mt-3 w-full">
                  <a href={build.artifact_url} target="_blank" rel="noreferrer">
                    <Download className="size-4" /> تنزيل APK
                  </a>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
