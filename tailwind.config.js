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
        flash: {
          '0%': { backgroundColor: '#ffff99' },
          '100%': { backgroundColor: 'transparent' },
        },
        blink: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '25%, 75%': { backgroundColor: '#ffff99' },
        },
      },
      animation: {
        'flash-once': 'flash 1s ease-out',
        'blink-sharp': 'blink 0.2s steps(1, start) 3',
      },
    },
  },
  plugins: [],
}
