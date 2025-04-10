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
        pulseHighlight: {
        '0%, 100%': { backgroundColor: 'transparent' },
        '50%': { backgroundColor: '#ffff99' },
        },
      },
      animation: {
        'flash-once': 'flash 1s ease-out',
        'pulse-soft': 'pulseHighlight 1.2s ease-in-out 2',
      },
    },
  },
  plugins: [],
}
