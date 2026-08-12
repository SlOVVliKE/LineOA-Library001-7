import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f2937',
        paper: '#faf9f7',
        accent: '#0f766e',
      },
    },
  },
  plugins: [],
} satisfies Config
