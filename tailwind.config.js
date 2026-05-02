/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:   { DEFAULT: '#0B2447', light: '#1F4E78', lighter: '#2E6DAD' },
        gold:   { DEFAULT: '#D4AF37', light: '#F0D060', dark: '#A88B20' },
        pitch:  '#0A3D1F',
        cream:  '#F6F1E7',
      },
      fontFamily: {
        arabic: ['Tajawal', 'Cairo', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseGold: { '0%,100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(212,175,55,0)' } },
      }
    },
  },
  plugins: [],
}
