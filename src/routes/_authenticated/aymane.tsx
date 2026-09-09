import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Send } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/aimhub/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listProjects } from "@/lib/aimhub/projects.functions";
import {
  applyProposal,
  createConversation,
  getAiSettings,
  getMessages,
  listConversations,
  listProposals,
  rejectProposal,
  sendAiMessage,
} from "@/lib/aimhub/ai.functions";

export const Route = createFileRoute("/_authenticated/aymane")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Aymane AI — AimHub" },
      {
        name: "description",
        content: "مساعد Aymane AI يقرأ مشروعك ويقترح تعديلات على الملفات ويصلح أخطاء البناء.",
      },
      { property: "og:title", content: "Aymane AI — AimHub" },
      { property: "og:description", content: "مساعد ذكي مستقل داخل AimHub بمفتاح API خاص بك." },
    ],
  }),
  component: AymanePage,
});

function AymanePage() {
  const search = Route.useSearch();
  const projectsFn = useServerFn(listProjects);
  const settingsFn = useServerFn(getAiSettings);
  const listConvFn = useServerFn(listConversations);
  const createConvFn = useServerFn(createConversation);
  const messagesFn = useServerFn(getMessages);
  const sendFn = useServerFn(sendAiMessage);
  const proposalsFn = useServerFn(listProposals);
  const applyFn = useServerFn(applyProposal);
  const rejectFn = useServerFn(rejectProposal);

  const [projectId, setProjectId] = useState<string | undefined>(search.projectId);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => projectsFn() });
  const settings = useQuery({ queryKey: ["ai-settings"], queryFn: () => settingsFn() });

  const conversations = useQuery({
    queryKey: ["conversations", projectId ?? "all"],
    queryFn: () => listConvFn({ data: projectId ? { projectId } : {} }),
  });

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => messagesFn({ data: { conversationId: conversationId! } }),
    enabled: Boolean(conversationId),
  });

  const proposals = useQuery({
    queryKey: ["proposals", projectId],
    queryFn: () => proposalsFn({ data: { projectId: projectId!, status: "pending" } }),
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (!conversationId && conversations.data?.length) {
      setConversationId(conversations.data[0]!.id);
    }
  }, [conversations.data, conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  const send = async () => {
    const content = input.trim();
    if (!content) return;
    setSending(true);
    try {
      let convId = conversationId;
      if (!convId) {
        const conv = await createConvFn({
          data: { projectId: projectId ?? null, title: content.slice(0, 40) },
        });
        convId = conv.id;
        setConversationId(convId);
        conversations.refetch();
      }
      setInput("");
      const result = await sendFn({
        data: { conversationId: convId, projectId: projectId ?? null, content },
      });
      if (result && "ok" in result && result.ok === false) toast.error(result.error);
      messages.refetch();
      if (projectId) proposals.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell
      title="Aymane AI"
      subtitle="مساعد مستقل بمفتاحك الخاص"
      action={
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            const conv = await createConvFn({ data: { projectId: projectId ?? null } });
            setConversationId(conv.id);
            conversations.refetch();
          }}
        >
          محادثة جديدة
        </Button>
      }
    >
      {settings.data && !settings.data.has_api_key ? (
        <div className="panel mb-3 p-3 text-sm">
          لم تتم إضافة مفتاح API بعد.{" "}
          <Link to="/settings" className="text-primary underline underline-offset-4">
            افتح الإعدادات لإضافته
          </Link>
          .
        </div>
      ) : null}

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <Select
          value={projectId ?? "none"}
          onValueChange={(v) => setProjectId(v === "none" ? undefined : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="بدون مشروع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">بدون مشروع</SelectItem>
            {(projects.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={conversationId ?? ""} onValueChange={(v) => setConversationId(v)}>
          <SelectTrigger>
            <SelectValue placeholder="المحادثات" />
          </SelectTrigger>
          <SelectContent>
            {(conversations.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(proposals.data ?? []).length > 0 ? (
        <div className="panel mb-3 space-y-3 p-3">
          <p className="text-sm font-semibold">تعديلات بانتظار موافقتك</p>
          {(proposals.data ?? []).map((proposal) => (
            <div key={proposal.id} className="rounded-md border border-border p-3">
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
                    await applyFn({ data: { proposalId: proposal.id } });
                    proposals.refetch();
                    toast.success("تم تطبيق التعديلات على المشروع");
                  }}
                >
                  تطبيق
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await rejectFn({ data: { proposalId: proposal.id } });
                    proposals.refetch();
                  }}
                >
                  رفض
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        {(messages.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            اطلب مثلًا: «أنشئ لعبة أندرويد بسيطة» أو «أصلح خطأ البناء الأخير».
          </p>
        ) : (
          (messages.data ?? [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-start" : ""}>
                {message.role === "user" ? (
                  <p className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                    {message.content}
                  </p>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none text-sm">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-20 mt-4 flex items-end gap-2 rounded-xl border border-border bg-surface p-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب طلبك لـ Aymane AI…"
          className="min-h-12 resize-none border-0 bg-transparent focus-visible:ring-0"
        />
        <Button size="icon" onClick={send} disabled={sending || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </AppShell>
  );
}
