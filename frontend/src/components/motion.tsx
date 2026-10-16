import { Illustration } from "@/components/illustration"
import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react"
import { TrendingUpIcon } from "lucide-react"

/**
 * Movimiento con propósito. Motion con LazyMotion+m (carga mínima) y
 * reducedMotion="user": si el sistema pide menos movimiento, se anulan transform/layout y queda solo la opacidad.
 * Tokens: base 240 ms ease-out para entrar (NN/g 100–500 ms; Material/Carbon).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: [0, 0, 0.38, 0.9] }}>{children}</MotionConfig>
    </LazyMotion>
  )
}

/** Momento firma 1: cada parte de la devolución aparece cuando su etapa termina (opacidad + 8 px). */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <m.div className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      {children}
    </m.div>
  )
}

/**
 * Momento firma 3: una mejora REAL de competencia entre intentos (Sailer et al. 2017: feedback de rendimiento
 * informativo apoya la competencia). Sin confeti ni count-up: el texto dice qué mejoró y cuánto.
 */
export function ImprovementNote({ label, from, to }: { label: string; from: number; to: number }) {
  if (!(to > from)) return null
  return (
    <m.div role="status" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
      className="flex items-start gap-3 rounded-xl border border-ok/40 bg-ok-bg p-4 text-ok">
      <Illustration name="progress-tracking" className="w-16 max-w-16 shrink-0" />
      <TrendingUpIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="text-body"><span className="font-semibold">Mejoraste en {label}:</span> de <span className="num">{from}</span> a <span className="num">{to}</span> sobre 5 respecto de tu intento anterior.</p>
    </m.div>
  )
}
