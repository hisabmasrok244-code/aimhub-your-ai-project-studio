import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizePath, dirName, isProbablyBinary } from "./tree";
import type { Project, ProjectFile } from "./types";

const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `project-${Date.now()}`;

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Project[];
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("المشروع غير موجود");
    return project as Project;
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(80),
        description: z.string().max(500).optional(),
        visibility: z.enum(["private", "public"]).default("private"),
        buildType: z.enum(["android-gradle", "capacitor", "other"]).default("android-gradle"),
        template: z.enum(["empty", "android-starter"]).default("android-starter"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .insert({
        owner_id: context.userId,
        name: data.name,
        slug: slugify(data.name),
        description: data.description ?? null,
        visibility: data.visibility,
        build_type: data.buildType,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.template === "android-starter") {
      const files = androidStarter(data.name);
      const rows = files.map((f) => ({
        project_id: project.id,
        path: f.path,
        content: f.content,
        size: f.content.length,
      }));
      const { error: fileError } = await context.supabase.from("project_files").insert(rows);
      if (fileError) throw new Error(fileError.message);
    }
    return project as Project;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: files, error } = await context.supabase
      .from("project_files")
      .select("id, project_id, path, is_dir, is_binary, content, size, updated_at")
      .eq("project_id", data.projectId)
      .order("path");
    if (error) throw new Error(error.message);
    return (files ?? []) as ProjectFile[];
  });

export const saveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1),
        content: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const path = normalizePath(data.path);
    const { error } = await context.supabase.from("project_files").upsert(
      {
        project_id: data.projectId,
        path,
        content: data.content,
        size: data.content.length,
        is_dir: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,path" },
    );
    if (error) throw new Error(error.message);
    await touchProject(context.supabase, data.projectId);
    return { ok: true, path };
  });

export const createEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1),
        isDir: z.boolean().default(false),
        content: z.string().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const path = normalizePath(data.path);
    if (!path) throw new Error("مسار غير صالح");
    const { error } = await context.supabase.from("project_files").insert({
      project_id: data.projectId,
      path,
      is_dir: data.isDir,
      is_binary: !data.isDir && isProbablyBinary(path),
      content: data.isDir ? "" : data.content,
      size: data.isDir ? 0 : data.content.length,
    });
    if (error) throw new Error(error.message);
    await touchProject(context.supabase, data.projectId);
    return { ok: true, path };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), path: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const path = normalizePath(data.path);
    const { error } = await context.supabase
      .from("project_files")
      .delete()
      .eq("project_id", data.projectId)
      .or(`path.eq.${path},path.like.${path}/%`);
    if (error) throw new Error(error.message);
    await touchProject(context.supabase, data.projectId);
    return { ok: true };
  });

export const moveEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        from: z.string().min(1),
        to: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const from = normalizePath(data.from);
    const to = normalizePath(data.to);
    const { data: rows, error } = await context.supabase
      .from("project_files")
      .select("id, path")
      .eq("project_id", data.projectId)
      .or(`path.eq.${from},path.like.${from}/%`);
    if (error) throw new Error(error.message);
    for (const row of rows ?? []) {
      const nextPath = row.path === from ? to : `${to}${row.path.slice(from.length)}`;
      const { error: updateError } = await context.supabase
        .from("project_files")
        .update({ path: nextPath })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
    }
    await touchProject(context.supabase, data.projectId);
    return { ok: true };
  });

/** Import a ZIP archive (base64) as project files. */
export const importZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        base64: z.string().min(1),
        stripRoot: z.boolean().default(true),
        targetDir: z.string().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { unzipSync, strFromU8 } = await import("fflate");
    const bytes = new Uint8Array(Buffer.from(data.base64, "base64"));
    const entries = unzipSync(bytes);
    const names = Object.keys(entries).filter((n) => !n.endsWith("/"));
    if (!names.length) throw new Error("الأرشيف فارغ");

    let prefix = "";
    if (data.stripRoot) {
      const first = names[0]!.split("/")[0]!;
      if (names.every((n) => n.startsWith(`${first}/`))) prefix = `${first}/`;
    }

    const rows = names.slice(0, 3000).map((name) => {
      const relative = name.slice(prefix.length);
      const path = normalizePath(
        data.targetDir ? `${data.targetDir}/${relative}` : relative,
      );
      const binary = isProbablyBinary(path);
      const raw = entries[name]!;
      return {
        project_id: data.projectId,
        path,
        is_dir: false,
        is_binary: binary,
        content: binary ? "" : safeText(raw, strFromU8),
        size: raw.length,
      };
    });

    const { error } = await context.supabase
      .from("project_files")
      .upsert(rows, { onConflict: "project_id,path" });
    if (error) throw new Error(error.message);
    await touchProject(context.supabase, data.projectId);
    return { imported: rows.length };
  });

/** Upload a single file (base64) into the project. */
export const uploadFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1),
        base64: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const path = normalizePath(data.path);
    const buffer = Buffer.from(data.base64, "base64");
    const binary = isProbablyBinary(path);
    const { error } = await context.supabase.from("project_files").upsert(
      {
        project_id: data.projectId,
        path,
        is_dir: false,
        is_binary: binary,
        content: binary ? "" : buffer.toString("utf8"),
        size: buffer.length,
      },
      { onConflict: "project_id,path" },
    );
    if (error) throw new Error(error.message);
    await touchProject(context.supabase, data.projectId);
    return { ok: true, path };
  });

function safeText(raw: Uint8Array, decode: (u: Uint8Array) => string): string {
  try {
    return decode(raw).slice(0, 400_000);
  } catch {
    return "";
  }
}

type SupabaseLike = { from: (table: string) => any };

async function touchProject(supabase: SupabaseLike, projectId: string) {
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
}

export { dirName };

function androidStarter(name: string): Array<{ path: string; content: string }> {
  const pkg = "com.aimhub.app";
  return [
    {
      path: "README.md",
      content: `# ${name}\n\nمشروع أندرويد أنشئ بواسطة AimHub.\n\n- الكود المصدري في \`app/src/main\`\n- البناء عبر Gradle (\`assembleDebug\`)\n`,
    },
    {
      path: "settings.gradle",
      content: `rootProject.name = "${name}"\ninclude ":app"\n`,
    },
    {
      path: "build.gradle",
      content: `plugins {\n    id 'com.android.application' version '8.5.0' apply false\n}\n`,
    },
    {
      path: "app/build.gradle",
      content: `plugins {\n    id 'com.android.application'\n}\n\nandroid {\n    namespace '${pkg}'\n    compileSdk 34\n\n    defaultConfig {\n        applicationId "${pkg}"\n        minSdk 24\n        targetSdk 34\n        versionCode 1\n        versionName "1.0"\n    }\n\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n}\n\ndependencies {\n    implementation 'androidx.appcompat:appcompat:1.7.0'\n}\n`,
    },
    {
      path: "app/src/main/AndroidManifest.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application android:label="${name}" android:theme="@style/Theme.AppCompat.DayNight">\n        <activity android:name=".MainActivity" android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n`,
    },
    {
      path: `app/src/main/java/${pkg.split(".").join("/")}/MainActivity.java`,
      content: `package ${pkg};\n\nimport android.os.Bundle;\nimport android.widget.TextView;\nimport androidx.appcompat.app.AppCompatActivity;\n\npublic class MainActivity extends AppCompatActivity {\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        TextView text = new TextView(this);\n        text.setText("${name}");\n        setContentView(text);\n    }\n}\n`,
    },
    {
      path: ".github/workflows/android.yml",
      content: `name: Android Build\n\non:\n  workflow_dispatch:\n  push:\n    branches: [main]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-java@v4\n        with:\n          distribution: temurin\n          java-version: '17'\n      - name: Build debug APK\n        run: ./gradlew assembleDebug --no-daemon\n      - uses: actions/upload-artifact@v4\n        with:\n          name: app-debug-apk\n          path: app/build/outputs/apk/debug/*.apk\n`,
    },
  ];
}
