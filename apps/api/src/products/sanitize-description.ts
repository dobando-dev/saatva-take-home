import sanitizeHtml from 'sanitize-html'

/**
 * Reduces CMS HTML to a small formatting allowlist with no attributes (C-9). Disallowed tags are
 * dropped but their text is kept; `script`/`style` are dropped with their content. Returns null
 * when nothing is left.
 */
export function sanitizeDescription(html: string): string | null {
  const clean = sanitizeHtml(html, {
    allowedTags: ['p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br'],
    allowedAttributes: {},
  }).trim()
  return clean === '' ? null : clean
}
