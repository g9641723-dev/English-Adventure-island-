import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        game: resolve("index.html"),
        teacher: resolve("teacher.html"),
        teacherPassword: resolve("teacher-password.html"),
      },
    },
  },
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } },
  },
});
