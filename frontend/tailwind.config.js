/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        radar: {
          bg: "#05070a",
          grid: "#12ffaa",
          hazard: "#ff3358",
          safe: "#f5d091",
        },
      },
      fontFamily: {
        mono: ['ui-monospace', '"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
