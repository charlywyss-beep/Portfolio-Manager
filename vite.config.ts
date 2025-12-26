import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'docs',
  },
  server: {
    proxy: {
      '/api/yahoo-finance': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => {
          // Extract query params from /api/yahoo-finance?symbol=X&period=Y&interval=Z
          const url = new URL(path, 'http://localhost');
          const symbol = url.searchParams.get('symbol');
          const period = url.searchParams.get('period');
          const interval = url.searchParams.get('interval');
          return `/v8/finance/chart/${symbol}?range=${period}&interval=${interval}`;
        },
      },
    },
  },
})
