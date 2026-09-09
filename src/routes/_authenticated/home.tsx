import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Boxes, PlayCircle, Plus, ServerCog } from "lucide-react";
import { AppShell } from "@/components/aimhub/AppShell";
import { StatusBadge } from "@/components/aimhub/StatusBadge";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/aimhub/projects.functions";
import { listBuilds, buildServerStatus } from "@/lib/aimhub/builds.functions";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية — AimHub" },
      { name: "description", content: "نظرة سريعة على مشاريعك وآخر عمليات البناء في AimHub." },
      { property: "og:title", content: "الرئيسية — AimHub" },
      { property: "og:description", content: "مشاريعك وعمليات البناء في مكان واحد." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const projectsFn = useServerFn(listProjects);
  const buildsFn = useServerFn(listBuilds);
  const statusFn = useServerFn(buildServerStatus);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => projectsFn() });
  const builds = useQuery({ queryKey: ["builds", "all"], queryFn: () => buildsFn({ data: {} }) });
  const server = useQuery({ queryKey: ["build-server"], queryFn: () => statusFn() });

  return (
    <AppShell
      title="AimHub"
      subtitle="مشاريعك وبناؤك من الهاتف"
      action={
        <Button asChild size="sm">
          <Link to="/projects">
            <Plus className="size-4" /> مشروع
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Boxes} label="المشاريع" value={projects.data?.length ?? 0} />
        <StatCard icon={PlayCircle} label="عمليات البناء" value={builds.data?.length ?? 0} />
      </div>

      <section className="panel mt-4 p-4">
        <div className="flex items-center gap-2">
          <ServerCog className="size-4 text-primary" />
          <h2 className="font-semibold">خادم البناء</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {server.data?.configured
            ? `متصل: ${server.data.provider}. عمليات البناء تُنفَّذ فعليًا وتُرجع APK.`
            : (server.data?.hint ?? "جارٍ التحقق…")}
        </p>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 font-semibold">آخر عمليات البناء</h2>
        {(builds.data ?? []).length === 0 ? (
          <p className="panel p-4 text-sm text-muted-foreground">لا توجد عمليات بناء بعد.</p>
        ) : (
          <ul className="space-y-2">
            {(builds.data ?? []).slice(0, 5).map((build) => (
              <li key={build.id} className="panel flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">بناء #{build.number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(build.created_at).toLocaleString("ar")}
                  </p>
                </div>
                <StatusBadge status={build.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/projects" className="panel flex items-center gap-3 p-4">
          <Boxes className="size-5 text-primary" />
          <span className="text-sm font-medium">إدارة المشاريع والملفات</span>
        </Link>
        <Link to="/aymane" className="panel flex items-center gap-3 p-4">
          <Bot className="size-5 text-primary" />
          <span className="text-sm font-medium">تحدّث مع Aymane AI</span>
        </Link>
      </section>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
}) {
  return (
    <div className="panel p-4">
      <Icon className="size-5 text-primary" />
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
