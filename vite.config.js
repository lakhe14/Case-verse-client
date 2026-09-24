import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Deployment builds (Vercel / Netlify, or CASEVERSE_DEPLOY_BUILD=1) must call
  // the real API: refuse a missing, http or localhost VITE_API_URL instead of
  // shipping a storefront that talks to a developer machine.
  const deployBuild = command === 'build' && (process.env.VERCEL || process.env.NETLIFY || process.env.CASEVERSE_DEPLOY_BUILD);
  if (deployBuild) {
    const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL || '';
    if (!/^https:\/\/[^/\s]+$/.test(apiUrl) || /localhost|127\.0\.0\.1/.test(apiUrl)) {
      throw new Error('VITE_API_URL must be the https origin of the API (no path, no localhost) for deployment builds.');
    }
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:4000',
        '/uploads': 'http://localhost:4000',
      },
    },
  };
});
