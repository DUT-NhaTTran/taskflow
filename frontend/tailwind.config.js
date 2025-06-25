/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",   // Nếu bạn dùng src folder
    "./app/**/*.{js,ts,jsx,tsx}",    // Nếu bạn dùng app folder của Next.js 13+
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
