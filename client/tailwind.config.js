module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B1F4E",
        primary: "#1D6EF5",
        "blue-pale": "#EFF6FF",
        "blue-pale2": "#DBEAFE",
        danger: "#DC2626",
        warning: "#D97706",
        success: "#059669",
        surface: "#F0F4FF",
      },
      fontFamily: {
        brand: ["Sora", "sans-serif"],
        ui: ["DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
