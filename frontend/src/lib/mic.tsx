import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { type MicError, openMic } from "./audio"

// El permiso se pide una vez (con pantalla previa en el panel). El micrófono se ABRE solo mientras grabás y se
// libera al terminar: dejarlo abierto pone al sistema en "modo llamada" y degrada lo que suena por los parlantes.
interface MicState {
  stream: MediaStream | null
  error: MicError | null
  asking: boolean
  request: () => Promise<MediaStream | null>
  release: () => void
}

const Ctx = createContext<MicState | null>(null)

export function MicProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<MicError | null>(null)
  const [asking, setAsking] = useState(false)

  const request = useCallback(async () => {
    if (stream && stream.getAudioTracks().some((t) => t.readyState === "live")) return stream
    setAsking(true)
    setError(null)
    try {
      const s = await openMic()
      setStream(s)
      return s
    } catch (e) {
      setError((e as { micError?: MicError }).micError ?? "Unknown")
      return null
    } finally {
      setAsking(false)
    }
  }, [stream])

  const release = useCallback(() => {
    setStream((s) => { s?.getTracks().forEach((t) => t.stop()); return null })
  }, [])

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream])

  return <Ctx.Provider value={{ stream, error, asking, request, release }}>{children}</Ctx.Provider>
}

export function useMic() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useMic fuera de MicProvider")
  return v
}
