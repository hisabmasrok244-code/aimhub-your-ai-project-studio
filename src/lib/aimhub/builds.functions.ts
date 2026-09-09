import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Build, BuildLogLine } from "./types";

export const listBuilds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("builds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.projectId) query = query.eq("project_id", data.projectId);
    const { data: builds, error } = await query;
    if (error) throw new Error(error.message);
    return (builds ?? []) as Build[];
  });

export const getBuild = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ buildId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: build, error } = await context.supabase
      .from("builds")
      .select("*")
      .eq("id", data.buildId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: logs, error: logError } = await context.supabase
      .from("build_logs")
      .select("id, level, message, created_at")
      .eq("build_id", data.buildId)
      .order("id");
    if (logError) throw new Error(logError.message);
    return { build: build as Build | null, logs: (logs ?? []) as BuildLogLine[] };
  });

export const startBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project, error: projectError } = await context.supabase
      .from("projects")
      .select("id, name, build_type, owner_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project) throw new Error("المشروع غير موجود");

    const { count } = await context.supabase
      .from("builds")
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId);

    const { data: build, error } = await context.supabase
      .from("builds")
      .insert({
        project_id: data.projectId,
        user_id: context.userId,
        number: (count ?? 0) + 1,
        status: "queued",
        provider: "aimhub",
        trigger: "manual",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const log = async (level: string, message: string) => {
      await context.supabase.from("build_logs").insert({ build_id: build.id, level, message });
    };

    await log("info", `AimHub build #${build.number} — ${project.name}`);

    const { getBuildProvider } = await import("./build-provider.server");
    const provider = getBuildProvider("aimhub");

    if (!provider.isConfigured()) {
      await log("error", provider.configurationHint());
      await context.supabase
        .from("builds")
        .update({
          status: "failed",
          error: provider.configurationHint(),
          finished_at: new Date().toISOString(),
        })
        .eq("id", build.id);
      return { build: build as Build, configured: false };
    }

    const { data: files, error: filesError } = await context.supabase
      .from("project_files")
      .select("path, content, is_binary, is_dir")
      .eq("project_id", data.projectId);
    if (filesError) throw new Error(filesError.message);

    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "";

    try {
      await log("info", "إرسال لقطة المشروع إلى خادم البناء…");
      const result = await provider.start({
        buildId: build.id,
        projectId: project.id,
        projectName: project.name,
        buildType: project.build_type,
        callbackUrl: `${origin}/api/public/builds/callback`,
        files: (files ?? [])
          .filter((f) => !f.is_dir)
          .map((f) => ({ path: f.path, content: f.content, is_binary: f.is_binary })),
      });
      await context.supabase
        .from("builds")
        .update({
          status: result.status,
          external_id: result.externalId,
          started_at: new Date().toISOString(),
        })
        .eq("id", build.id);
      await log("info", `تم قبول العملية من الخادم (${result.status}).`);
      return { build: { ...build, status: result.status } as Build, configured: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل غير معروف";
      await log("error", message);
      await context.supabase
        .from("builds")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", build.id);
      return { build: { ...build, status: "failed" } as Build, configured: true };
    }
  });

export const cancelBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ buildId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("builds")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.buildId)
      .in("status", ["queued", "running"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const buildServerStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getBuildProvider } = await import("./build-provider.server");
  const provider = getBuildProvider("aimhub");
  return {
    provider: provider.label,
    configured: provider.isConfigured(),
    hint: provider.configurationHint(),
  };
});
