/**
 * Server-safe HTML sanitizer using isomorphic-dompurify.
 * Runs on both server (via JSDOM) and client (native DOM).
 *
 * Replaces the previous custom regex sanitizer which could be bypassed via:
 *   - SVG <animate> with attributeName="href" to="javascript:..."
 *   - data: URIs containing HTML payloads
 *   - CSS expression() in style attributes
 *   - Null-byte injection like <scri\0pt>
 *
 * Allowlists only safe formatting tags and strips all attributes.
 */
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'ul', 'ol', 'li', 'b', 'strong', 'em', 'i', 'br', 'span'];

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR:     [],   // no attributes — eliminates all attribute injection vectors
    FORBID_CONTENTS:  ['script', 'style'],
    FORCE_BODY:       false,
    RETURN_DOM:       false,
    RETURN_DOM_FRAGMENT: false,
  });
}
