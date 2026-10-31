import { FileUpIcon, LinkIcon, LoaderCircleIcon, PencilIcon, RefreshCwIcon, TypeIcon } from "lucide-react"
import { useRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, type Ingested, type Source } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Markdown } from "./Markdown"

const ACCEPT = ".pdf,.docx,.doc,.rtf,.odt,.txt,.md,.markdown,.html,.htm,.png,.jpg,.jpeg,.webp"
const LABEL = { cv: "tu CV", job: "el puesto" }

export interface DocValue { markdown: string; source: Source }

/**
 * Loads a document (CV or job) from a file, text or link → readable, reviewable, editable Markdown.
 * Supports PDF, DOCX, DOC, RTF, ODT, TXT, MD, HTML and images (scanned CV).
 */
export function SourceInput({ kind, value, onChange }: { kind: "cv" | "job"; value: DocValue | null; onChange: (v: DocValue | null) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [text, setText] = useState("")
  const [url, setUrl] = useState("")
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function run(input: { file?: File; text?: string; url?: string }) {
    setBusy(true)
    setError(null)
    try {
      const r: Ingested = await api.ingest(kind, input)
      setWarnings(r.warnings)
      onChange({ markdown: r.markdown, source: r.source })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (value) return <MarkdownEditor value={value.markdown} source={value.source} warnings={warnings}
    onChange={(md) => onChange({ ...value, markdown: md })} onReset={() => { onChange(null); setWarnings([]) }} />

  return (
    <div className="flex flex-col gap-3">
      <Tabs defaultValue="file">
        <TabsList className="w-full">
          <TabsTrigger value="file"><FileUpIcon /> Subir archivo</TabsTrigger>
          <TabsTrigger value="text"><TypeIcon /> Pegar texto</TabsTrigger>
          <TabsTrigger value="url"><LinkIcon /> Link</TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) run({ file: f }) }}
            className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-within:ring-2 focus-within:ring-ring",
              drag ? "border-primary bg-accent/50" : "hover:border-primary/50")}
          >
            <FileUpIcon className="size-6 text-primary" aria-hidden />
            <span className="font-medium">Arrastrá {LABEL[kind]} acá o hacé clic para elegirlo</span>
            <span className="text-xs text-muted-foreground">PDF, Word (DOCX/DOC), RTF, ODT, TXT, Markdown, HTML o una imagen (PNG/JPG) · hasta 10 MB</span>
            <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) run({ file: f }); e.target.value = "" }} />
          </label>
        </TabsContent>

        <TabsContent value="text" className="flex flex-col gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} disabled={busy}
            placeholder={kind === "cv" ? "Pegá el texto de tu CV…" : "Pegá el aviso, la descripción del puesto o tus notas de preparación…"} />
          <Button className="w-fit" onClick={() => run({ text })} disabled={busy || text.trim().length < 30}>Convertir a Markdown</Button>
        </TabsContent>

        <TabsContent value="url" className="flex flex-col gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" disabled={busy} inputMode="url" />
          <p className="text-xs text-muted-foreground">Funciona con páginas públicas (Ashby, Greenhouse, Lever, la web de la empresa). LinkedIn y sitios con login no: en ese caso copiá y pegá el texto.</p>
          <Button className="w-fit" onClick={() => run({ url })} disabled={busy || !/^https?:\/\/\S+/.test(url)}>Leer el link</Button>
        </TabsContent>
      </Tabs>

      {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircleIcon className="size-4 motion-safe:animate-spin" /> Leyendo y convirtiendo a Markdown… (~10 s)</p>}
      {error && <Alert><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  )
}

/** View | Edit of a Markdown document. */
export function MarkdownEditor({ value, source, warnings = [], onChange, onReset, resetLabel = "Cargar otro" }: {
  value: string; source?: Source; warnings?: string[]; onChange: (md: string) => void; onReset?: () => void; resetLabel?: string
}) {
  const [mode, setMode] = useState<"view" | "edit">("view")
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {source?.kind === "file" ? `Archivo: ${source.name}` : source?.kind === "url" ? `Link: ${source.name}` : source?.kind === "text" ? "Texto pegado" : ""}
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={mode === "view" ? "secondary" : "ghost"} onClick={() => setMode("view")} aria-pressed={mode === "view"}>Vista</Button>
          <Button size="sm" variant={mode === "edit" ? "secondary" : "ghost"} onClick={() => setMode("edit")} aria-pressed={mode === "edit"}><PencilIcon /> Editar</Button>
          {onReset && <Button size="sm" variant="ghost" onClick={onReset}><RefreshCwIcon /> {resetLabel}</Button>}
        </div>
      </div>
      {warnings.map((w, i) => <Alert key={i}><AlertDescription>{w}</AlertDescription></Alert>)}
      {mode === "view" ? (
        <div className="max-h-[55svh] overflow-y-auto rounded-xl border bg-card p-4"><Markdown>{value}</Markdown></div>
      ) : (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={20} className="font-mono text-[13px]" aria-label="Editar Markdown" />
      )}
    </div>
  )
}
