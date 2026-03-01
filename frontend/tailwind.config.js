/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dce8ff",
          200: "#b9d1ff",
          500: "#3b6ee8",
          600: "#2d5cd1",
          700: "#2349ab",
        },
        surface: {
          DEFAULT: "#ffffff",
          dark: "#1a1d23",
          muted: "#f8f9fb",
          "muted-dark": "#23272f",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        reading: ["Lora", "Georgia", "serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
