import { defineAppShellConfig } from 'fzl-fund-appshell--lit/config'

export default defineAppShellConfig({
  title: 'GA4 Projetos',
  storagePrefix: 'fzl-ga4',
  accessibility: {
    fonts: ['atkinson', 'opendyslexic'],
    themes: ['light', 'dark', 'high-contrast-light', 'high-contrast-dark'],
    textScale: { min: 1, max: 2 },
    defaults: { font: 'system', theme: 'system', textScale: 1 },
  },
  analytics: {
    requireConsent: false,
  },
  base: process.env.VITE_BASE_PATH || '/',
  manifest: {
    name: 'GA4 Projetos',
    short_name: 'GA4 Projetos',
    description: 'Painel centralizado do Google Analytics 4 para múltiplos projetos',
    lang: 'pt-BR',
    start_url: '.',
    display: 'standalone',
    background_color: '#fffbfe',
    theme_color: '#6750a4',
    icons: [48, 72, 96, 128, 144, 152, 192, 384, 512]
      .map((s) => ({ src: `icons/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' }))
      .concat({ src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
  },
  workbox: {
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  },
})
