import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { AiMessage, AiProposal, AiSettingsView, FileChange } from "./types";

const MAX_STEPS = 6;

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiSettingsView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_settings")
      .select("provider, base_url, model, api_key_ciphertext")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      provider: data?.provider ?? "openai-compatible",
      base_url: data?.base_url ?? "https://api.openai.com/v1",
      model: data?.model ?? "gpt-4o-mini",
      has_api_key: Boolean(data?.api_key_ciphertext),
    };
  });

export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.string().min(1).max(40),
        baseUrl: z.string().url(),
        model: z.string().min(1).max(120),
        apiKey: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: {
      user_id: string;
      provider: string;
      base_url: string;
      model: string;
      updated_at: string;
      api_key_ciphertext?: string;
    } = {
      user_id: context.userId,
      provider: data.provider,
      base_url: data.baseUrl,
      model: data.model,
      updated_at: new Date().toISOString(),
    };
    if (data.apiKey && data.apiKey.trim()) {
      const { encryptSecret } = await import("./crypto.server");
      payload["api_key_ciphertext"] = encryptSecret(data.apiKey.trim());
    }
    const { error } = await supabaseAdmin
      .from("ai_settings")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ai_settings")
      .update({ api_key_ciphertext: null })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("ai_conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (data.projectId) query = query.eq("project_id", data.projectId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ projectId: z.string().uuid().nullable().optional(), title: z.string().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_conversations")
      .insert({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        title: data.title ?? "محادثة جديدة",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_messages")
      .select("id, role, content, metadata, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as AiMessage[];
  });

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), status: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("ai_proposals")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as AiProposal[];
  });

export const applyProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ proposalId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: proposal, error } = await context.supabase
      .from("ai_proposals")
      .select("*")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!proposal) throw new Error("المقترح غير موجود");
    if (proposal.status !== "pending") throw new Error("سبق التعامل مع هذا المقترح");

    const changes = (proposal.changes ?? []) as unknown as FileChange[];
    for (const change of changes) {
      if (change.action === "delete") {
        await context.supabase
          .from("project_files")
          .delete()
          .eq("project_id", proposal.project_id)
          .or(`path.eq.${change.path},path.like.${change.path}/%`);
      } else if (change.action === "move" && change.to) {
        await context.supabase
          .from("project_files")
          .update({ path: change.to })
          .eq("project_id", proposal.project_id)
          .eq("path", change.path);
      } else {
        await context.supabase.from("project_files").upsert(
          {
            project_id: proposal.project_id,
            path: change.path,
            content: change.content ?? "",
            size: (change.content ?? "").length,
            is_dir: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,path" },
        );
      }
    }

    await context.supabase
      .from("ai_proposals")
      .update({ status: "applied", updated_at: new Date().toISOString() })
      .eq("id", proposal.id);
    return { applied: changes.length };
  });

export const rejectProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ proposalId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("ai_proposals")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", data.proposalId);
    return { ok: true };
  });

export const sendAiMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        projectId: z.string().uuid().nullable().optional(),
        content: z.string().min(1).max(8000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("ai_settings")
      .select("base_url, model, api_key_ciphertext")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!settings?.api_key_ciphertext) {
      return {
        ok: false as const,
        error:
          "لم تتم إضافة مفتاح API بعد. افتح إعدادات Aymane AI وأدخل عنوان المزود والمفتاح والموديل.",
      };
    }

    const { decryptSecret } = await import("./crypto.server");
    const { chatCompletion, AiProviderError } = await import("./ai-provider.server");
    type ChatMessage = import("./ai-provider.server").ChatMessage;

    await context.supabase.from("ai_messages").insert({
      conversation_id: data.conversationId,
      role: "user",
      content: data.content,
    });

    const { data: history } = await context.supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", data.conversationId)
      .order("created_at")
      .limit(40);

    let fileIndex = "";
    if (data.projectId) {
      const { data: files } = await context.supabase
        .from("project_files")
        .select("path, size, is_binary")
        .eq("project_id", data.projectId)
        .order("path")
        .limit(500);
      fileIndex = (files ?? [])
        .map((f) => `${f.path}${f.is_binary ? " (ثنائي)" : ""} — ${f.size} bytes`)
        .join("\n");
    }

    const pendingChanges: FileChange[] = [];

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "أنت Aymane AI، مساعد هندسي داخل منصة AimHub لإدارة مشاريع الأندرويد وبنائها.",
          "تجيب بالعربية بشكل عملي ومختصر، وتستعمل الأدوات لقراءة الملفات قبل اقتراح التعديل.",
          "كل تعديل على الملفات يُسجَّل كمقترح يعرضه المستخدم ويوافق عليه قبل التطبيق.",
          data.projectId ? `ملفات المشروع الحالي:\n${fileIndex || "(المشروع فارغ)"}` : "لا يوجد مشروع محدد.",
        ].join("\n\n"),
      },
      ...(history ?? []).map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      })),
    ];

    const tools = data.projectId ? aiTools : [];
    let finalText = "";

    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const result = await chatCompletion(
          {
            baseUrl: settings.base_url,
            apiKey: decryptSecret(settings.api_key_ciphertext),
            model: settings.model,
          },
          messages,
          tools,
        );

        if (!result.toolCalls.length) {
          finalText = result.content;
          break;
        }

        messages.push({ role: "assistant", content: result.content, tool_calls: result.toolCalls });

        for (const call of result.toolCalls) {
          let args: Record<string, string> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const output = await runTool(
            call.function.name,
            args,
            data.projectId ?? null,
            context.supabase,
            pendingChanges,
          );
          messages.push({ role: "tool", tool_call_id: call.id, content: output });
        }
        finalText = result.content || finalText;
      }
    } catch (err) {
      const message =
        err instanceof AiProviderError
          ? `فشل الاتصال بمزود الذكاء (${err.status}): ${err.message}`
          : err instanceof Error
            ? err.message
            : "خطأ غير معروف";
      await context.supabase.from("ai_messages").insert({
        conversation_id: data.conversationId,
        role: "assistant",
        content: `تعذّر إتمام الطلب. ${message}`,
      });
      return { ok: false as const, error: message };
    }

    let proposalId: string | null = null;
    if (pendingChanges.length && data.projectId) {
      const { data: proposal } = await context.supabase
        .from("ai_proposals")
        .insert({
          user_id: context.userId,
          project_id: data.projectId,
          conversation_id: data.conversationId,
          summary: finalText.slice(0, 400) || "تعديلات مقترحة على الملفات",
          changes: pendingChanges as unknown as never,
        })
        .select("id")
        .single();
      proposalId = proposal?.id ?? null;
    }

    await context.supabase.from("ai_messages").insert({
      conversation_id: data.conversationId,
      role: "assistant",
      content: finalText || "تم.",
      metadata: proposalId ? { proposal_id: proposalId } : null,
    });
    await context.supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    return { ok: true as const, proposalId, changes: pendingChanges.length };
  });

const aiTools = [
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "يعرض قائمة كل ملفات المشروع الحالي مع أحجامها.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "يقرأ محتوى ملف نصي داخل المشروع.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_build_logs",
      description: "يقرأ سجلات آخر عملية بناء للمشروع لتحليل الأخطاء.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "يقترح إنشاء أو استبدال ملف بمحتوى كامل جديد (يحتاج موافقة المستخدم).",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_file",
      description: "يقترح حذف ملف أو مجلد (يحتاج موافقة المستخدم).",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "move_file",
      description: "يقترح نقل أو إعادة تسمية ملف (يحتاج موافقة المستخدم).",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, to: { type: "string" } },
        required: ["path", "to"],
        additionalProperties: false,
      },
    },
  },
];

async function runTool(
  name: string,
  args: Record<string, string>,
  projectId: string | null,
  supabase: { from: (table: string) => any },
  pending: FileChange[],
): Promise<string> {
  if (!projectId) return "لا يوجد مشروع محدد.";
  const { normalizePath } = await import("./tree");

  switch (name) {
    case "list_files": {
      const { data } = await supabase
        .from("project_files")
        .select("path, size")
        .eq("project_id", projectId)
        .order("path")
        .limit(500);
      return (data ?? []).map((f: { path: string; size: number }) => `${f.path} (${f.size})`).join("\n") || "(فارغ)";
    }
    case "read_file": {
      const path = normalizePath(args["path"] ?? "");
      const { data } = await supabase
        .from("project_files")
        .select("content, is_binary")
        .eq("project_id", projectId)
        .eq("path", path)
        .maybeSingle();
      if (!data) return `الملف غير موجود: ${path}`;
      if (data.is_binary) return "ملف ثنائي، لا يمكن قراءته كنص.";
      return data.content.slice(0, 60_000);
    }
    case "read_build_logs": {
      const { data: builds } = await supabase
        .from("builds")
        .select("id, number, status, error")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1);
      const build = builds?.[0];
      if (!build) return "لا توجد عمليات بناء بعد.";
      const { data: logs } = await supabase
        .from("build_logs")
        .select("level, message")
        .eq("build_id", build.id)
        .order("id")
        .limit(300);
      return [
        `Build #${build.number} — ${build.status}${build.error ? ` — ${build.error}` : ""}`,
        ...(logs ?? []).map((l: { level: string; message: string }) => `[${l.level}] ${l.message}`),
      ].join("\n");
    }
    case "write_file": {
      const path = normalizePath(args["path"] ?? "");
      const { data } = await supabase
        .from("project_files")
        .select("id")
        .eq("project_id", projectId)
        .eq("path", path)
        .maybeSingle();
      pending.push({
        action: data ? "update" : "create",
        path,
        content: args["content"] ?? "",
      });
      return `تم تسجيل تعديل مقترح على ${path}.`;
    }
    case "delete_file": {
      const path = normalizePath(args["path"] ?? "");
      pending.push({ action: "delete", path });
      return `تم تسجيل حذف مقترح لـ ${path}.`;
    }
    case "move_file": {
      const path = normalizePath(args["path"] ?? "");
      const to = normalizePath(args["to"] ?? "");
      pending.push({ action: "move", path, to });
      return `تم تسجيل نقل مقترح من ${path} إلى ${to}.`;
    }
    default:
      return `أداة غير معروفة: ${name}`;
  }
}
