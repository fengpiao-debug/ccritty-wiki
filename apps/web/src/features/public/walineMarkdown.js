import { normalizeWalineEmoji } from '@artist-wiki/markdown'
import { guestbookHtml } from './guestbookMarkdown'
import { walineDraftImages } from './walineTransport'

// Waline's native preview accepts raw HTML. Route its Marked surface through the
// same HTML-disabled parser and sanitizer used by public and administrator views.
export class Marked {
  setOptions() { return this }
  use() { return this }
  parse(markdown) { return guestbookHtml(normalizeWalineEmoji(markdown), walineDraftImages()) }
}
