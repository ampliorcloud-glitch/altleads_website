/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Exact AltLeads CRM palette (new-code/web/src/index.css)
        primary: {
          DEFAULT: '#1A7EE8', // CRM brand blue
          hover: '#1668C4',
          light: '#E8F1FD',
          dark: '#125AA8',
        },
        brand: '#1A7EE8',
        ink: {
          DEFAULT: '#111827', // gray-900
          soft: '#374151',    // gray-700
          mute: '#6B7280',    // gray-500
          faint: '#717784',   // gray-400
        },
        line: '#E5E7EB',      // border
        surface: '#FFFFFF',
        canvas: '#F9FAFB',    // gray-50 page bg
        mist: '#F3F4F6',      // gray-100
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16,24,40,0.04), 0 1px 3px 0 rgba(16,24,40,0.06)',
        pop: '0 4px 16px -2px rgba(16,24,40,0.10)',
      },
    },
  },
  plugins: [],
}
