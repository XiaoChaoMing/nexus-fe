import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Nginx edge of the backend (make nxl-up-all): one origin for /v1 and /hls, routed the same way as in compose.
  const gateway = env.VITE_DEV_GATEWAY_URL
  const identity = env.VITE_DEV_IDENTITY_URL || 'http://localhost:8090'
  const stream = env.VITE_DEV_STREAM_URL || 'http://localhost:8092'
  const hls = new URL(env.VITE_DEV_HLS_URL || 'http://localhost:9000/nxl-media')
  const bucketPath = hls.pathname.replace(/\/$/, '')

  // Web chỉ gọi một origin nên không cần CORS. Có VITE_DEV_GATEWAY_URL thì mọi thứ đi qua Nginx edge;
  // không có thì Vite tự định tuyến theo tiền tố tới từng service (chạy service ngoài Docker).
  const proxy: Record<string, ProxyOptions> = gateway
    ? {
        '/v1': { target: gateway, changeOrigin: true, ws: true },
        '/hls': { target: gateway, changeOrigin: true },
      }
    : {
        '/v1/studio': { target: stream, changeOrigin: true },
        '/v1/streams': { target: stream, changeOrigin: true },
        '/v1/vods': { target: stream, changeOrigin: true },
        '/v1': { target: identity, changeOrigin: true, ws: true },
        // /hls/streams/{id}/master.m3u8 → MinIO bucket nxl-media/streams/{id}/master.m3u8
        '/hls': {
          target: hls.origin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hls/, bucketPath),
        },
      }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // hls.js alone is ~500 kB; it is split into the player chunk and loaded only on player pages.
    build: {
      chunkSizeWarningLimit: 650,
      rolldownOptions: {
        output: {
          // Long-lived vendor chunks: they change rarely, so browsers keep them cached across app deploys.
          codeSplitting: {
            groups: [
              { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
              { name: 'i18n', test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/ },
              { name: 'radix', test: /[\\/]node_modules[\\/](radix-ui|@radix-ui[\\/][^\\/]+)[\\/]/ },
              // Player pages only (loaded on demand); a named group keeps shared page code out of this chunk.
              { name: 'hls', test: /[\\/]node_modules[\\/]hls\.js[\\/]/ },
            ],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy,
    },
  }
})
