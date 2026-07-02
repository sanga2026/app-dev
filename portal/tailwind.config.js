/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
               'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        // Brand blue — consistent across all components
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'card':     '0 1px 3px 0 rgb(0 0 0 / .04), 0 1px 2px -1px rgb(0 0 0 / .04)',
        'card-md':  '0 4px 16px -4px rgb(0 0 0 / .08), 0 2px 6px -2px rgb(0 0 0 / .05)',
        'brand':    '0 4px 20px -4px rgb(37 99 235 / .35)',
        'brand-sm': '0 2px 8px -2px rgb(37 99 235 / .25)',
      },
      animation: {
        'fade-in-up':   'fadeInUp .35s cubic-bezier(.16,1,.3,1) both',
        'fade-in':      'fadeIn .25s ease both',
        'slide-right':  'slideInRight .3s cubic-bezier(.16,1,.3,1) both',
        'scale-in':     'scaleIn .25s cubic-bezier(.16,1,.3,1) both',
        'shimmer':      'shimmer 1.4s infinite linear',
        'pulse-ring':   'pulseRing 2s cubic-bezier(.455,.03,.515,.955) infinite',
      },
      keyframes: {
        fadeInUp:     { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:      { from: { opacity: '0', transform: 'scale(.96)' },       to: { opacity: '1', transform: 'scale(1)' } },
        shimmer:      { from: { backgroundPosition: '-400px 0' }, to: { backgroundPosition: '400px 0' } },
        pulseRing:    {
          '0%':   { boxShadow: '0 0 0 0   rgb(37 99 235 / .4)' },
          '70%':  { boxShadow: '0 0 0 8px rgb(37 99 235 / 0)'  },
          '100%': { boxShadow: '0 0 0 0   rgb(37 99 235 / 0)'  },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
};
