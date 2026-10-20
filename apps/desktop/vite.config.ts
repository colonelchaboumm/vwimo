import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 1420, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          ui: ["react", "react-dom", "@radix-ui/react-dialog"],
        },
      },
    },
  },
  clearScreen: false,
});
