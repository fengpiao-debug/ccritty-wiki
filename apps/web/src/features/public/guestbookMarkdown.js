import createDOMPurify from 'dompurify'
import { renderGuestbookMarkdown, guestbookEmojiSources } from '@artist-wiki/markdown'

// A dedicated purifier avoids changing sanitization rules for other site content.
const purifier = createDOMPurify(window)
let allowedImages = guestbookEmojiSources
purifier.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.nodeName === 'IMG' && data.attrName === 'src') {
    if (!allowedImages.has(data.attrValue)) data.keepAttr = false
    // Only Blob URLs created from this editor's selected files may bypass the
    // default URI scheme filter. Never allow blob/data URLs from user markup.
    else if (data.attrValue.startsWith('blob:')) data.forceKeepAttr = true
  }
})
purifier.addHook('afterSanitizeAttributes', node => {
  if (node.nodeName === 'IMG' && !node.hasAttribute('src')) node.remove()
})

export function guestbookHtml(markdown, draftImages = {}) {
  allowedImages = new Set([...guestbookEmojiSources, ...Object.keys(draftImages)])
  try {
    return purifier.sanitize(renderGuestbookMarkdown(markdown, { draftImages }), {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'img'],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'role', 'aria-label', 'tabindex', 'start', 'src', 'alt', 'loading'],
      ALLOW_DATA_ATTR: false,
    })
  } finally { allowedImages = guestbookEmojiSources }
}
