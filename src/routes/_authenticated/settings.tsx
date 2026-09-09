import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/aimhub/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { buildServerStatus } from "@/lib/aimhub/builds.functions";
import { clearAiKey, getAiSettings, saveAiSettings } from "@/lib/aimhub/ai.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — AimHub" },
      { name: "description", content: "إعدادات الحساب، مزود الذكاء الاصطناعي، وخادم البناء." },
      { property: "og:title", content: "الإعدادات — AimHub" },
      { property: "og:description", content: "اضبط مفتاح الذكاء الاصطناعي وخادم البناء." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const getFn = useServerFn(getAiSettings);
  const saveFn = useServerFn(saveAiSettings);
  const clearFn = useServerFn(clearAiKey);
  const statusFn = useServerFn(buildServerStatus);

  const settings = useQuery({ queryKey: ["ai-settings"], queryFn: () => getFn() });
  const server = useQuery({ queryKey: ["build-server"], queryFn: () => statusFn() });

  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (settings.data) {
      setBaseUrl(settings.data.base_url);
      setModel(settings.data.model);
    }
  }, [settings.data]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const save = async () => {
    try {
      await saveFn({ data: { provider: "openai-compatible", baseUrl, model, apiKey } });
      setApiKey("");
      settings.refetch();
      toast.success("تم حفظ إعدادات Aymane AI");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ");
    }
  };

  return (
    <AppShell title="الإعدادات" subtitle={email}>
      <section className="panel space-y-4 p-4">
        <div>
          <h2 className="font-semibold">مزود Aymane AI</h2>
          <p className="text-xs text-muted-foreground">
            أي واجهة متوافقة مع OpenAI (OpenAI، OpenRouter، أو خادمك الخاص). المفتاح يُحفظ مشفّرًا
            على الخادم فقط ولا يظهر في التطبيق ولا في ملف APK.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="base">عنوان المزود</Label>
          <Input id="base" dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">الموديل</Label>
          <Input id="model" dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="key">مفتاح API</Label>
          <Input
            id="key"
            dir="ltr"
            type="password"
            placeholder={settings.data?.has_api_key ? "محفوظ — أدخل مفتاحًا جديدًا للاستبدال" : "sk-…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={save}>حفظ</Button>
          {settings.data?.has_api_key ? (
            <Button
              variant="secondary"
              onClick={async () => {
                await clearFn();
                settings.refetch();
                toast.success("تم حذف المفتاح");
              }}
            >
              حذف المفتاح
            </Button>
          ) : null}
        </div>
      </section>

      <section className="panel mt-4 p-4">
        <h2 className="font-semibold">خادم البناء</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {server.data?.configured
            ? `متصل: ${server.data.provider}`
            : (server.data?.hint ?? "جارٍ التحقق…")}
        </p>
      </section>

      <Button
        variant="secondary"
        className="mt-4 w-full"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/auth" });
        }}
      >
        تسجيل الخروج
      </Button>
    </AppShell>
  );
}
