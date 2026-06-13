/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#b76dff',
        accent: '#ddb7ff',
        cash: '#FBBF24',
        background: '#FAFAFA',
        textMain: '#111827',
        textSecondary: '#6B7280',
        success: '#b76dff',
        error: '#EF4444',
        
        // Cyber-Epicurean Colors
        'surface-lowest': '#060e20',
        'surface-low': '#131b2e',
        'surface-mid': '#171f33',
        'surface-high': '#222a3d',
        'surface-highest': '#2d3449',
        'brand-purple': '#b76dff',
        'brand-purple-light': '#ddb7ff',
        'brand-purple-dark': '#490080',
        'brand-green': '#4ae176',
        'brand-green-dark': '#003915',
        'on-surface': '#ffffff',
        'on-surface-variant': '#cbd5e1',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
