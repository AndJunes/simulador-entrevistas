import { createCn } from "cn/config"

/**
 * Class merge aware of the custom type scale (index.css @theme). Without this, `text-label` or `text-caption` are
 * treated as colors and override `text-ink-foreground` (e.g., dark buttons end up with invisible text).
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["caption", "label", "body", "body-lg", "h3", "h2", "h1", "hero"] }] } },
})
