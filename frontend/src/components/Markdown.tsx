import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/** Markdown legible para CV y puesto. Sin HTML crudo (react-markdown lo ignora por defecto): seguro con texto de terceros. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-[15px] leading-7 text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="mb-3 mt-1 text-xl font-semibold tracking-tight" {...p} />,
          h2: (p) => <h2 className="mb-2 mt-6 border-b pb-1 text-base font-semibold" {...p} />,
          h3: (p) => <h3 className="mb-1.5 mt-4 font-semibold" {...p} />,
          p: (p) => <p className="my-2" {...p} />,
          ul: (p) => <ul className="my-2 list-disc space-y-1 pl-5" {...p} />,
          ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-5" {...p} />,
          a: ({ href, ...p }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4" {...p} />,
          blockquote: (p) => <blockquote className="my-3 border-l-2 pl-3 text-muted-foreground" {...p} />,
          code: (p) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]" {...p} />,
          table: (p) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm" {...p} /></div>,
          th: (p) => <th className="border-b px-2 py-1.5 text-left font-medium" {...p} />,
          td: (p) => <td className="border-b px-2 py-1.5 align-top" {...p} />,
          hr: () => <hr className="my-4" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
