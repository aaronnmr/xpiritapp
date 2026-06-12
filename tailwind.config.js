/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#050507",
        graphite: "#111217",
        mist: "#E7E9EE",
        muted: "#8C929F",
        volt: "#C7F464",
        ember: "#FF6B4A",
        pool: "#56CCF2"
      },
      fontFamily: {
        display: ["System"],
        body: ["System"]
      }
    }
  },
  plugins: []
};
