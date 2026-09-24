import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// NOTE (T7): component tests land in the T7 ticket — add the vitest
// defineConfig wiring additively here then (jsdom environment plus the
// jest-dom /vitest setup import), along with the test script and pins
// (vitest 5.0.1, jsdom 30.1.1, @testing-library/react 16.3.3,
// @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1).

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
});
