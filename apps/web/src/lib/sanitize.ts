/**
 * Lightweight server-side HTML sanitizer.
 * Strips XSS vectors (scripts, event handlers, javascript: links) from
 * scraper-sourced description HTML before dangerouslySetInnerHTML rendering.
 *
 * Keeps safe formatting tags: <p>, <ul>, <li>, <b>, <strong>, <em>, <br>
 * Does NOT require any external npm package.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  return html
    // Remove <script>...</script> blocks entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove <style>...</style> blocks entirely
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all on* event handler attributes (onclick, onerror, onload, etc.)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Remove javascript: and vbscript: in href/src attributes
    .replace(/\b(href|src|action)\s*=\s*["']\s*(?:javascript|vbscript):[^"']*/gi, '$1="#"')
    // Remove <iframe>, <object>, <embed>, <form> tags
    .replace(/<\/?(iframe|object|embed|form|input|button|meta|link)\b[^>]*>/gi, '');
}
