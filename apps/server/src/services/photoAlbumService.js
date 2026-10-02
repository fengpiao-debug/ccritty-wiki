import { normalizePhotoAlbum, validatePhotoAlbum } from '@artist-wiki/content-types'
import { validateImageAssetUrl } from './imageAssetService.js'

export function preparePhotoAlbum(record) {
  const invalid = validatePhotoAlbum(record)
  if (invalid) throw Object.assign(new Error(invalid), { status: 400 })
  const album = normalizePhotoAlbum(record)
  for (const image of album.images) {
    const error = validateImageAssetUrl(image.url)
    if (error) throw Object.assign(new Error(error), { status: 400 })
    image.url = image.url.trim()
  }
  return normalizePhotoAlbum(album)
}
