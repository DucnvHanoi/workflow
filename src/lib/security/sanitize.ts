import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize HTML produced from stored markdown before it is injected via
 * dangerouslySetInnerHTML. Knowledge-base articles are rendered on the public,
 * unauthenticated /help pages; sanitizing here is defense-in-depth against a
 * stored-XSS payload reaching every visitor (e.g. if an authoring account is
 * compromised or a future write path is added).
 *
 * Strips <script>, event-handler attributes, and javascript:/data: URIs while
 * preserving the formatting tags marked() emits.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    // Links open in new tabs from the help center; allow target/rel.
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  })
}
