module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'yc-blue': '#0085ad',
        'yc-blue-dark': '#007295',
        'yc-green': '#00b398',
        'yc-green-dark': '#009e85',
      },
      keyframes: {
        pulseMatch: {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.8)' },
        },
      },
      animation: {
        'pulse-match': 'pulseMatch 1.2s ease-in-out 4',
      },
    },
  },
  plugins: [],
};
