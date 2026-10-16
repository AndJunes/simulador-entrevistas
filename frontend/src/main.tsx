import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import App from "./App"
import { MotionProvider } from "./components/motion"
import { MicProvider } from "./lib/mic"
import { applyTheme } from "./lib/theme"
import "./index.css"

applyTheme()

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <TooltipProvider>
          <MicProvider>
            <MotionProvider>
              <App />
              <Toaster position="bottom-center" />
            </MotionProvider>
          </MicProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
