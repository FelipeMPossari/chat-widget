import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    copyPublicDir: false,
    lib: {
      entry: 'src/index.tsx',
      name: 'XChannelWebChat',
      formats: ['iife'],
      fileName: () => 'xchannel-webchat.js',
    },
  },
});

