import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:     '#FDFAF6',
        petal:     '#F9EEF0',
        blush:     '#F2D9DF',
        rose:      '#C96070',
        rosedark:  '#A84D5B',
        lavender:  '#EAE6F4',
        lilac:     '#9E8EC2',
        sage:      '#E6EFE4',
        forest:    '#6B9668',
        peach:     '#FAF0E6',
        ink:       '#2E1F1A',
        ink2:      '#7A5C54',
        muted:     '#A89088',
        rule:      '#E8DDD8',
      },
      fontFamily: {
        serif:  ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans:   ['var(--font-jost)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'petal-float': 'petalFloat 9s ease-in-out infinite',
        'fade-up':     'fadeUp 0.9s ease both',
      },
      keyframes: {
        petalFloat: {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '50%':      { transform: 'translate(12px, -16px) rotate(12deg)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
