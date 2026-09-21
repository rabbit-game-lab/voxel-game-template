import { defineConfig } from 'vite'

// Rabbit contract: dev server reachable from the Studio iframe (--host)
// and standard Vite HMR. Do not add plugins without a new Template Version.
//
// cors: true is required — the Studio iframe is sandboxed WITHOUT
// allow-same-origin, so its origin is opaque ("null") and module scripts
// are CORS-blocked unless the dev server answers Access-Control-Allow-Origin.
export default defineConfig({
  base: './',
  server: {
    host: true,
    cors: true,
    headers: {
      'Permissions-Policy': 'pointer-lock=(self), fullscreen=(self), gamepad=(self)',
    },
  },
  preview: {
    host: true,
    cors: true,
    headers: {
      'Permissions-Policy': 'pointer-lock=(self), fullscreen=(self), gamepad=(self)',
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
