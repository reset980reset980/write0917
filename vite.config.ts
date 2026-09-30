import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Gemini API 키는 이제 미니PC API 서버에만 있습니다. (브라우저 코드에 넣지 않음)
export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
