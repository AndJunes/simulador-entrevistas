import { createCn } from "cn/config"

/**
 * Merge de clases con la escala tipográfica propia (index.css @theme). Sin esto, `text-label` o `text-caption` se
 * toman como color y pisan `text-ink-foreground` (p. ej., botones oscuros quedan sin texto visible).
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["caption", "label", "body", "body-lg", "h3", "h2", "h1", "hero"] }] } },
})
