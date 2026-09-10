import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Real build runners report progress here.
 *
 * POST /api/public/builds/callback
 * Header: x-aimhub-signature: sha256=<hex hmac of the raw body>
 * Body: { build_id, status?, logs?: [{level, message}], artifact_url?, error? }
 */
export const Route = createFileRoute("/api/public/builds/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AIMHUB_BUILD_WEBHOOK_SECRET"];
        if (!secret) {
          return json({ error: "webhook secret not configured" }, 503);
        }

        const raw = await request.text();
        const provided = (request.headers.get("x-aimhub-signature") ?? "").replace(/^sha256=/, "");
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return json({ error: "invalid signature" }, 401);
        }

        let payload: {
          build_id?: string;
          status?: string;
          logs?: Array<{ level?: string; message?: string }>;
          artifact_url?: string;
          error?: string;
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        if (!payload.build_id) return json({ error: "build_id required" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (payload.logs?.length) {
          await supabaseAdmin.from("build_logs").insert(
            payload.logs.slice(0, 500).map((line) => ({
              build_id: payload.build_id!,
              level: line.level ?? "info",
              message: (line.message ?? "").slice(0, 4000),
            })),
          );
        }

        const allowed = ["queued", "running", "success", "failed", "cancelled"];
        const update: {
          status?: string;
          started_at?: string;
          finished_at?: string;
          artifact_url?: string;
          error?: string;
        } = {};
        if (payload.status && allowed.includes(payload.status)) {
          update["status"] = payload.status;
          if (payload.status === "running") update["started_at"] = new Date().toISOString();
          if (["success", "failed", "cancelled"].includes(payload.status)) {
            update["finished_at"] = new Date().toISOString();
          }
        }
        if (payload.artifact_url) update["artifact_url"] = payload.artifact_url;
        if (payload.error) update["error"] = payload.error.slice(0, 4000);

        if (Object.keys(update).length) {
          await supabaseAdmin.from("builds").update(update).eq("id", payload.build_id);
        }
        return json({ ok: true });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
