import { fileURLToPath } from 'node:url'

// Scope the transport and safe Markdown renderer to the official Waline client.
// Never patch window.fetch, dependency files, or unrelated Markdown consumers.
export function walineIntegration() {
  return {
    name: 'artist-wiki-waline-integration',
    enforce: 'pre',
    config() {
      return { define: {
        __VUE_OPTIONS_API__: 'true',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
      } }
    },
    resolveId(source, importer) {
      if (!importer?.replaceAll('\\', '/').includes('/node_modules/@waline/client/')) return null
      const file = source === '@waline/api' ? 'walineTransport.js' : source === 'marked' ? 'walineMarkdown.js' : null
      return file ? fileURLToPath(new URL(`./src/features/public/${file}`, import.meta.url)) : null
    },
  }
}
