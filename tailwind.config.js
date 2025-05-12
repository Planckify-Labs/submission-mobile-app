/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        light: {
          DEFAULT: "#fff",
          "main-container": "#f5f6f9",
          "primary-red": "#c71c4b",
          "matte-black": "#20222c",
        },
      },
    },
  },
  plugins: [],
  presets: [require("nativewind/preset")],
};
