import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// В контейнере эти пути проксирует nginx (apps/web/vite-project/nginx.conf).
// В dev тем же занимается Vite, иначе /admin отдал бы index.html — SPA такого роута не знает,
// и вместо админки открывалась бы пустая страница.
const API = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/admin': { target: API, changeOrigin: true },
      '/photos': { target: API, changeOrigin: true },
    },
  },
})
