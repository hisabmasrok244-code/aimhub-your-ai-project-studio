import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, FolderGit2, Lock, Globe, Plus } from "lucide-react";
import { AppShell } from "@/components/aimhub/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createProject, listProjects } from "@/lib/aimhub/projects.functions";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "المشاريع — AimHub" },
      { name: "description", content: "كل مستودعات مشاريعك على AimHub في مكان واحد." },
      { property: "og:title", content: "المشاريع — AimHub" },
      { property: "og:description", content: "أنشئ مشروعًا جديدًا أو افتح مستودعًا موجودًا." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const listFn = useServerFn(listProjects);
  const createFn = useServerFn(createProject);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [template, setTemplate] = useState<"android-starter" | "empty">("android-starter");

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => listFn() });

  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { name, description, visibility, template, buildType: "android-gradle" } }),
    onSuccess: () => {
      toast.success("تم إنشاء المشروع");
      setOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "فشل الإنشاء"),
  });

  return (
    <AppShell
      title="المشاريع"
      subtitle="مستودعاتك"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> جديد
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>مشروع جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">الوصف</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الظهور</Label>
                  <Select value={visibility} onValueChange={(v) => setVisibility(v as "private")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">خاص</SelectItem>
                      <SelectItem value="public">عام</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>القالب</Label>
                  <Select value={template} onValueChange={(v) => setTemplate(v as "empty")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="android-starter">أندرويد (Gradle)</SelectItem>
                      <SelectItem value="empty">فارغ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!name.trim() || create.isPending}
                onClick={() => create.mutate()}
              >
                إنشاء
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {projects.isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : (projects.data ?? []).length === 0 ? (
        <div className="panel p-6 text-center">
          <FolderGit2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            لا توجد مشاريع بعد. أنشئ مشروعك الأول من زر «جديد».
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {(projects.data ?? []).map((project) => (
            <li key={project.id}>
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="panel flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{project.name}</span>
                    {project.visibility === "public" ? (
                      <Globe className="size-3.5 text-muted-foreground" />
                    ) : (
                      <Lock className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {project.description || project.slug}
                  </p>
                </div>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
