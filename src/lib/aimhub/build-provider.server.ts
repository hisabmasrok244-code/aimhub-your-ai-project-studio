// Build layer. AimHub never fakes a build: it hands a real project snapshot to
// a build runner and tracks the real result. The runner is pluggable so a
// second provider (GitHub Actions, another build farm) can be added later
// without touching the app code that starts builds.

export interface BuildSnapshotFile {
  path: string;
  content: string;
  is_binary: boolean;
}

export interface StartBuildContext {
  buildId: string;
  projectId: string;
  projectName: string;
  buildType: string;
  files: BuildSnapshotFile[];
  callbackUrl: string;
}

export interface StartBuildResult {
  externalId: string | null;
  status: "queued" | "running";
}

export interface BuildProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  configurationHint(): string;
  start(ctx: StartBuildContext): Promise<StartBuildResult>;
}

/** AimHub's own build runner (Android/Gradle worker). */
const aimhubProvider: BuildProvider = {
  id: "aimhub",
  label: "AimHub Build Server",
  isConfigured() {
    return Boolean(process.env["AIMHUB_BUILD_SERVER_URL"] && process.env["AIMHUB_BUILD_SERVER_TOKEN"]);
  },
  configurationHint() {
    return "خادم البناء غير مربوط بعد. أضف AIMHUB_BUILD_SERVER_URL و AIMHUB_BUILD_SERVER_TOKEN في إعدادات المشروع لتشغيل بناء حقيقي.";
  },
  async start(ctx) {
    const url = process.env["AIMHUB_BUILD_SERVER_URL"]!.replace(/\/+$/, "");
    const res = await fetch(`${url}/v1/builds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env["AIMHUB_BUILD_SERVER_TOKEN"]}`,
      },
      body: JSON.stringify({
        build_id: ctx.buildId,
        project_id: ctx.projectId,
        project_name: ctx.projectName,
        build_type: ctx.buildType,
        callback_url: ctx.callbackUrl,
        files: ctx.files,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`رفض خادم البناء الطلب (${res.status}): ${text.slice(0, 300)}`);
    }
    let body: { id?: string; status?: string } = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      /* runner may answer with an empty body */
    }
    return {
      externalId: body.id ?? null,
      status: body.status === "running" ? "running" : "queued",
    };
  },
};

const providers: Record<string, BuildProvider> = {
  aimhub: aimhubProvider,
};

export function getBuildProvider(id: string): BuildProvider {
  return providers[id] ?? aimhubProvider;
}

export function listBuildProviders(): BuildProvider[] {
  return Object.values(providers);
}
