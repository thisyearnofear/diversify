/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
        secondary: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        // Enhanced regional colors with better contrast
        region: {
          // USA - Enhanced blue
          usa: {
            light: "#DBEAFE",
            medium: "#3B82F6",
            dark: "#1E40AF",
            contrast: "#172554",
          },
          // Europe - Enhanced green
          europe: {
            light: "#DCFCE7",
            medium: "#22C55E",
            dark: "#15803D",
            contrast: "#14532D",
          },
          // Latin America - Enhanced orange/yellow
          latam: {
            light: "#FEF3C7",
            medium: "#F59E0B",
            dark: "#B45309",
            contrast: "#78350F",
          },
          // Africa - Enhanced red/terracotta
          africa: {
            light: "#FEE2E2",
            medium: "#EF4444",
            dark: "#B91C1C",
            contrast: "#7F1D1D",
          },
          // Asia - Enhanced purple/pink
          asia: {
            light: "#F5D0FE",
            medium: "#D946EF",
            dark: "#A21CAF",
            contrast: "#701A75",
          },
        },
        // Enhanced UI colors for better contrast
        text: {
          primary: "#111827", // Very dark gray for main text
          secondary: "#374151", // Dark gray for secondary text
          muted: "#6B7280", // Medium gray for less important text
          light: "#F9FAFB", // Almost white for text on dark backgrounds
        },
        background: {
          light: "#FFFFFF", // White
          offWhite: "#F9FAFB", // Very light gray
          subtle: "#F3F4F6", // Light gray
          muted: "#E5E7EB", // Medium light gray
        },
        accent: {
          success: "#059669", // Green
          warning: "#D97706", // Amber
          error: "#DC2626", // Red
          info: "#2563EB", // Blue
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        "card-hover":
          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};
