/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: false, // Completely disable dark mode
  theme: {
    extend: {
      colors: {
        mint: {
          50: '#F3FDFB',
          100: '#E9FBF6',
          400: '#4DCAA1',
          500: '#3EB489',
          600: '#3EB489',
          700: '#359A77',
          800: '#2D7F63',
          900: '#25654F',
        },
        ink: '#111827',
        body: '#374151',
        muted: '#6B7280',
        surface: '#FFFFFF',
        'surface-subtle': '#F8FAFC',
        line: '#E5E7EB',
        'light-bg': '#F9FAFB',
        blue: '#365EBF',
        success: '#02cb97',
        error: '#ef4444',
        warning: '#f59e0b',
        'primary-blue': '#3B82F6',
        'success-green': '#10B981',
        'accent-purple': '#8B5CF6',
      },
      fontFamily: {
        'heading': ['Poppins', 'system-ui', 'sans-serif'],
        'body': ['Figtree', 'system-ui', 'sans-serif'],
        'sans': ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '20px',
        'button': '16px',
      },
      boxShadow: {
        'mint': '0 4px 16px rgba(2, 203, 151, 0.25), 0 2px 8px rgba(2, 203, 151, 0.15)',
        'mint-lg': '0 6px 20px rgba(2, 203, 151, 0.3), 0 4px 12px rgba(2, 203, 151, 0.2)',
        'glass': '0 8px 32px rgba(17, 24, 39, 0.12)',
        'glass-lg': '0 20px 60px rgba(17, 24, 39, 0.15)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.1)',
      },
      backdropBlur: {
        'glass': '16px',
        'glass-sm': '8px',
      },
    },
  },
  plugins: [],
}