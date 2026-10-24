// Fixed, locally hosted Waline emoji pack. User-provided image URLs are never allowed.
export const guestbookEmojiPack = {"name": "基础表情", "prefix": "weibo_", "type": "png", "icon": "doge", "items": ["smile", "lovely", "blush", "grin", "laugh", "joy", "angry", "bye", "hammer", "kiss", "love", "mask", "money", "quiet", "rage", "sad", "shy", "sick", "slient", "smirk", "slap", "antic", "desire", "longing", "no_idea", "look_down", "clap", "yum", "sleep", "dizzy_face", "chuckle", "disappointed", "flushed", "heart_eyes", "no", "shuai", "suprised", "think", "vomit", "scream", "sleepy", "sob", "sunglasses", "greddy", "pick_nose", "annoyed", "awkward", "confused", "grievance", "poor", "wink", "rolling_eyes", "watermalon", "annoyed_left", "annoyed_right", "yawn", "hufen", "doge", "husky", "dog_annoyed", "dog_bye", "dog_consider", "dog_cry", "dog_joy", "dog_laugh", "dog_sweat", "dog_think", "dog_yum", "cat", "cat_annoyed", "cat_bye", "cat_cry", "cat_think", "girl_annoyed", "boy", "girl", "panda", "pig", "rabbit", "ultraman", "wool_group", "yan", "xi", "soap", "meng", "jiong", "geili", "shenma", "alpaca"], "folder": "/waline-emojis/weibo"}
export const guestbookEmojiMap = Object.fromEntries(guestbookEmojiPack.items.map(name => [
  `weibo_${name}`, `/waline-emojis/weibo/weibo_${name}.png`,
]))
export const guestbookEmojiSources = new Set(Object.values(guestbookEmojiMap))

// Waline expands shortcodes to HTML before submission. Only its exact known image
// tags are converted back to shortcodes; every other HTML tag remains plain text.
export function normalizeWalineEmoji(markdown) {
  return String(markdown ?? '').replace(/<img class="wl-emoji" src="([^"]+)" alt="([^"]+)">/g,
    (tag, src, key) => guestbookEmojiMap[key] === src ? `:${key}:` : tag)
}
