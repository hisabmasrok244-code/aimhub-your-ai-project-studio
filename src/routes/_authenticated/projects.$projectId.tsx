import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  ChevronDown,
  ChevronLeft,
  Download,
  File as FileIcon,
  FilePlus2,
  FolderPlus,
  Play,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/aimhub/AppShell";
import { StatusBadge } from "@/components/aimhub/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteProject,
  getProject,
  listFiles,
  saveFile,
  createEntry,
  deleteEntry,
  moveEntry,
  importZip,
  uploadFile,
} from "@/lib/aimhub/projects.functions";
import { getBuild, listBuilds, startBuild } from "@/lib/aimhub/builds.functions";
import { applyProposal, listProposals, rejectProposal } from "@/lib/aimhub/ai.functions";
import { buildTree, languageFromPath, type TreeNode } from "@/lib/aimhub/tree";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "المستودع — AimHub" },
      { name: "description", content: "تصفح ملفات المشروع، عدّلها، وشغّل عمليات البناء." },
      { property: "og:title", content: "المستودع — AimHub" },
      { property: "og:description", content: "ملفات المشروع وعمليات البناء ومقترحات Aymane AI." },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getProjectFn = useServerFn(getProject);
  const listFilesFn = useServerFn(listFiles);
  const saveFileFn = useServerFn(saveFile);
  const createEntryFn = useServerFn(createEntry);
  const deleteEntryFn = useServerFn(deleteEntry);
  const moveEntryFn = useServerFn(moveEntry);
  const importZipFn = useServerFn(importZip);
  const uploadFileFn = useServerFn(uploadFile);
  const deleteProjectFn = useServerFn(deleteProject);
  const startBuildFn = useServerFn(startBuild);
  const listBuildsFn = useServerFn(listBuilds);
  const listProposalsFn = useServerFn(listProposals);
  const applyProposalFn = useServerFn(applyProposal);
  const rejectProposalFn = useServerFn(rejectProposal);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectFn({ data: { projectId } }),
  });
  const files = useQuery({
    queryKey: ["files", projectId],
    queryFn: () => listFilesFn({ data: { projectId } }),
  });
  const builds = useQuery({
    queryKey: ["builds", projectId],
    queryFn: () => listBuildsFn({ data: { projectId } }),
    refetchInterval: 6000,
  });
  const proposals = useQuery({
    queryKey: ["proposals", projectId],
    queryFn: () => listProposalsFn({ data: { projectId, status: "pending" } }),
  });

  const [openPath, setOpenPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const tree = useMemo(() => buildTree(files.data ?? []), [files.data]);
  const openFile = (files.data ?? []).find((f) => f.path === openPath);

  const refreshFiles = () => queryClient.invalidateQueries({ queryKey: ["files", projectId] });

  const openEditor = (path: string) => {
    const file = (files.data ?? []).find((f) => f.path === path);
    if (!file || file.is_binary) {
      toast.info("هذا ملف ثنائي ولا يمكن تحريره كنص.");
      return;
    }
    setOpenPath(path);
    setDraft(file.content);
  };

  const save = useMutation({
    mutationFn: () => saveFileFn({ data: { projectId, path: openPath!, content: draft } }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      refreshFiles();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحفظ"),
  });

  const runBuild = useMutation({
    mutationFn: () => startBuildFn({ data: { projectId } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["builds"] });
      if (result && "id" in result) setSelectedBuildId(result.id as string);
      toast.success("تم إرسال عملية البناء");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر بدء البناء"),
  });

  const addEntry = async (isDir: boolean) => {
    const path = window.prompt(isDir ? "مسار المجلد الجديد" : "مسار الملف الجديد");
    if (!path) return;
    try {
      await createEntryFn({ data: { projectId, path, isDir, content: "" } });
      refreshFiles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الإنشاء");
    }
  };

  const removeEntry = async (path: string) => {
    if (!window.confirm(`حذف ${path}؟`)) return;
    await deleteEntryFn({ data: { projectId, path } });
    if (openPath === path) setOpenPath(null);
    refreshFiles();
  };

  const renameEntry = async (path: string) => {
    const to = window.prompt("المسار الجديد", path);
    if (!to || to === path) return;
    await moveEntryFn({ data: { projectId, from: path, to } });
    if (openPath === path) setOpenPath(to);
    refreshFiles();
  };

  const readBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
      reader.readAsDataURL(file);
    });

  return (
    <AppShell
      title={project.data?.name ?? "المستودع"}
      subtitle={project.data?.description ?? project.data?.slug ?? ""}
      action={
        <Button size="sm" onClick={() => runBuild.mutate()} disabled={runBuild.isPending}>
          <Play className="size-4" /> بناء
        </Button>
      }
    >
      <Tabs defaultValue="files">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="files">الملفات</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="ai">مقترحات AI</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => addEntry(false)}>
              <FilePlus2 className="size-4" /> ملف
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addEntry(true)}>
              <FolderPlus className="size-4" /> مجلد
            </Button>
            <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> رفع ملف
            </Button>
            <Button size="sm" variant="secondary" onClick={() => zipInput.current?.click()}>
              <Upload className="size-4" /> استيراد ZIP
            </Button>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  await uploadFileFn({
                    data: { projectId, path: file.name, base64: await readBase64(file) },
                  });
                  refreshFiles();
                  toast.success("تم الرفع");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "فشل الرفع");
                }
              }}
            />
            <input
              ref={zipInput}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const result = await importZipFn({
                    data: {
                      projectId,
                      base64: await readBase64(file),
                      stripRoot: true,
                      targetDir: "",
                    },
                  });
                  refreshFiles();
                  toast.success(`تم استيراد ${result.imported} ملفًا`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "فشل الاستيراد");
                }
              }}
            />
          </div>

          <div className="panel p-2">
            {tree.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">لا توجد ملفات بعد.</p>
            ) : (
              <FileTree
                nodes={tree}
                onOpen={openEditor}
                onDelete={removeEntry}
                onRename={renameEntry}
              />
            )}
          </div>

          {openFile ? (
            <div className="panel p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" dir="ltr">
                    {openFile.path}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {languageFromPath(openFile.path)}
                  </p>
                </div>
                <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                  <Save className="size-4" /> حفظ
                </Button>
              </div>
              <Textarea
                dir="ltr"
                spellCheck={false}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="code-surface mt-3 min-h-80 font-mono text-xs"
              />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="actions" className="mt-4 space-y-2">
          {(builds.data ?? []).length === 0 ? (
            <p className="panel p-4 text-sm text-muted-foreground">
              لا توجد عمليات بناء لهذا المشروع بعد.
            </p>
          ) : (
            (builds.data ?? []).map((build) => (
              <div key={build.id} className="panel p-3">
                <button
                  className="flex w-full items-center justify-between gap-2 text-right"
                  onClick={() =>
                    setSelectedBuildId(selectedBuildId === build.id ? null : build.id)
                  }
                >
                  <span className="text-sm font-medium">بناء #{build.number}</span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={build.status} />
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </span>
                </button>
                {build.status === "success" && build.artifact_url ? (
                  <Button asChild size="sm" className="mt-3 w-full">
                    <a href={build.artifact_url} target="_blank" rel="noreferrer">
                      <Download className="size-4" /> تنزيل APK
                    </a>
                  </Button>
                ) : null}
                {selectedBuildId === build.id ? <BuildLogs buildId={build.id} /> : null}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-2">
          <Button asChild variant="secondary" className="w-full">
            <Link to="/aymane" search={{ projectId }}>
              <Bot className="size-4" /> افتح Aymane AI لهذا المشروع
            </Link>
          </Button>
          {(proposals.data ?? []).length === 0 ? (
            <p className="panel p-4 text-sm text-muted-foreground">لا توجد مقترحات معلّقة.</p>
          ) : (
            (proposals.data ?? []).map((proposal) => (
              <div key={proposal.id} className="panel p-3">
                <p className="text-sm">{proposal.summary}</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground" dir="ltr">
                  {proposal.changes.map((change, i) => (
                    <li key={i}>
                      {change.action} — {change.path}
                      {change.to ? ` → ${change.to}` : ""}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      await applyProposalFn({ data: { proposalId: proposal.id } });
                      refreshFiles();
                      proposals.refetch();
                      toast.success("تم تطبيق التعديلات");
                    }}
                  >
                    تطبيق
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await rejectProposalFn({ data: { proposalId: proposal.id } });
                      proposals.refetch();
                    }}
                  >
                    رفض
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Button
        variant="secondary"
        className="mt-6 w-full text-destructive"
        onClick={async () => {
          if (!window.confirm("حذف المشروع نهائيًا؟")) return;
          await deleteProjectFn({ data: { projectId } });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          navigate({ to: "/projects" });
        }}
      >
        <Trash2 className="size-4" /> حذف المشروع
      </Button>
    </AppShell>
  );
}

function FileTree({
  nodes,
  depth = 0,
  onOpen,
  onDelete,
  onRename,
}: {
  nodes: TreeNode[];
  depth?: number;
  onOpen: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
}) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.path}>
          <div
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            style={{ paddingInlineStart: depth * 14 + 8 }}
          >
            <button
              className="flex min-w-0 flex-1 items-center gap-2 text-right"
              onClick={() => (node.isDir ? undefined : onOpen(node.path))}
            >
              {node.isDir ? (
                <ChevronLeft className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate text-sm" dir="ltr">
                {node.name}
              </span>
            </button>
            <span className="flex shrink-0 gap-1">
              <button
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => onRename(node.path)}
              >
                نقل
              </button>
              <button
                className="text-[11px] text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(node.path)}
              >
                حذف
              </button>
            </span>
          </div>
          {node.children.length ? (
            <FileTree
              nodes={node.children}
              depth={depth + 1}
              onOpen={onOpen}
              onDelete={onDelete}
              onRename={onRename}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function BuildLogs({ buildId }: { buildId: string }) {
  const getBuildFn = useServerFn(getBuild);
  const build = useQuery({
    queryKey: ["build", buildId],
    queryFn: () => getBuildFn({ data: { buildId } }),
    refetchInterval: 5000,
  });

  return (
    <div className="code-surface mt-3 max-h-72 overflow-auto p-3" dir="ltr">
      {(build.data?.logs ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد سجلات بعد.</p>
      ) : (
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5">
          {(build.data?.logs ?? []).map((log) => `[${log.level}] ${log.message}`).join("\n")}
        </pre>
      )}
      {build.data?.build?.error ? (
        <p className="mt-2 font-mono text-[11px] text-destructive">{build.data.build.error}</p>
      ) : null}
    </div>
  );
}
