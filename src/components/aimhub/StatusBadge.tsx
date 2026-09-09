import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  queued: "في الانتظار",
  running: "قيد التنفيذ",
  success: "نجح",
  failed: "فشل",
  cancelled: "أُلغي",
  pending: "بانتظار الموافقة",
  applied: "مطبَّق",
  rejected: "مرفوض",
};

const STYLES: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  applied: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
