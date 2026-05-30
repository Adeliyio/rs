/**
 * Safe JSON-LD serializer — prevents script tag breakout (VULN-11).
 *
 * When using dangerouslySetInnerHTML for <script type="application/ld+json">,
 * a value containing "</script>" can break out of the tag and inject HTML.
 * This helper escapes the closing angle bracket to the Unicode equivalent.
 */

/**
 * Serializes structured data to a JSON string safe for embedding
 * inside a <script> tag via dangerouslySetInnerHTML.
 *
 * Replaces `<` with `\u003c` so that `</script>` in any value
 * cannot close the surrounding script element.
 */
export function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
