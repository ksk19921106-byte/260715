/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213d",
        muted: "#5b6b84",
        line: "#d9e3f2",
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          900: "#102a5c"
        }
      },
      boxShadow: {
        soft: "0 18px 45px rgba(26, 58, 112, 0.08)"
      }
    }
  },
  plugins: []
};
