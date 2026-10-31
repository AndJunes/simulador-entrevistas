import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Alternative to voice (W3C: don't require speech). Ctrl/⌘+Enter sends. */
export function WrittenAnswer({ value, onChange, onSend, onCancel, dark }: { value: string; onChange: (v: string) => void; onSend: () => void; onCancel: () => void; dark?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="written-answer" className={cn("text-label font-medium", dark && "text-white")}>Tu respuesta por escrito</label>
      <textarea id="written-answer" autoFocus rows={6} value={value} maxLength={8000} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend() } }}
        className={cn("w-full rounded-lg border border-input bg-card p-3 text-body text-foreground", dark && "bg-white/10 text-white")} />
      <p className={cn("text-caption", dark ? "text-white/80" : "text-muted-foreground")}>Ctrl/⌘ + Enter envía. Se evalúa el contenido; las métricas de voz no aplican.</p>
      <div className="flex gap-2">
        <Button onClick={onSend} disabled={!value.trim()}>Enviar respuesta</Button>
        <Button variant="ghost" onClick={onCancel} className={cn(dark && "text-white hover:bg-white/10")}>Volver a la voz</Button>
      </div>
    </div>
  )
}
