import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Boxes, FileCode2, PlayCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AimHub — مشاريعك وبناء APK من الهاتف" },
      {
        name: "description",
        content:
          "AimHub منصة لإدارة مستودعات المشاريع، تحرير الملفات، تشغيل عمليات البناء، وتنزيل APK، مع مساعد Aymane AI.",
      },
      { property: "og:title", content: "AimHub" },
      {
        property: "og:description",
        content: "منصة مشاريع وبناء APK مع مساعد Aymane AI داخل التطبيق.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Boxes, title: "مستودعات", text: "مشاريع بملفات ومجلدات حقيقية، رفع ZIP، ونقل وحذف." },
  { icon: FileCode2, title: "محرر داخلي", text: "افتح أي ملف نصي، عدّله واحفظه مباشرة." },
  { icon: PlayCircle, title: "Actions", text: "شغّل البناء وتابع الحالة والسجلات لحظة بلحظة." },
  { icon: Bot, title: "Aymane AI", text: "مساعد مستقل يقرأ مشروعك ويقترح تعديلات تعتمدها بنفسك." },
];

function Landing() {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-5 py-14">
        <header className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Smartphone className="size-3.5" /> مصمم للهاتف أولًا
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            AimHub — أدر مشاريعك وابنِ <span className="text-primary">APK</span> من هاتفك
          </h1>
          <p className="text-muted-foreground">
            مستودعات، محرر كود، عمليات بناء بسجلات حيّة، ومساعد Aymane AI يعمل بمفتاح API خاص بك.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">ابدأ الآن</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth" search={{ mode: "signin" }}>
                تسجيل الدخول
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="panel p-4">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
