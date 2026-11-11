import type { Config } from "tailwindcss";

/**
 * IDENTIDAD VISUAL OBLIGATORIA — CONECTA EXPRESS
 * Color principal: #DE1025
 * Tonalidades derivadas del rojo corporativo (#DE1025) para profundidad y jerarquía
 * Blanco #FFFFFF y escalas de grises neutros puros.
 * Prohibido cualquier tono de azul, morado o colores ajenos a la marca.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        conecta: {
          DEFAULT: "#DE1025",
          primary: "#DE1025",
          50: "#FDF2F3",
          100: "#FBE3E6",
          200: "#F6C5CB",
          300: "#EE95A0",
          400: "#E55363",
          500: "#DE1025",
          600: "#B80D1F",
          700: "#960A19",
          800: "#780814",
          900: "#5C060F",
          950: "#3D040A",
          white: "#FFFFFF",
        },
        neutral: {
          50: "#FAFAFA",
          100: "#F5F5F5",
          200: "#E5E5E5",
          300: "#D4D4D4",
          400: "#A3A3A3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0A0A0A",
        },
        gray: {
          50: "#FAFAFA",
          100: "#F5F5F5",
          200: "#E5E5E5",
          300: "#D4D4D4",
          400: "#A3A3A3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0A0A0A",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Consolas",
          "Monaco",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
