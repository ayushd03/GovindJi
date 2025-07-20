/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'primary-bg': '#FFFFFF',
        'primary-text': '#212121',
        'primary-accent': '#F39C12',
        'secondary-accent': '#E67E22',
        'footer-bg': '#1E392A',
        'light-gray': '#F8F9FA',
        'border-color': '#E5E5E5',
        'shadow-color': 'rgba(0, 0, 0, 0.08)',
      },
      fontFamily: {
        'heading': ['Montserrat', 'sans-serif'],
        'body': ['Lato', 'sans-serif'],
      },
      fontSize: {
        'h1': '3rem',
        'h2': '2.2rem',
        'h3': '1.5rem',
        'body': '1rem',
        'small': '0.875rem',
      },
      spacing: {
        'xs': '0.5rem',
        'sm': '1rem',
        'md': '1.5rem',
        'lg': '2rem',
        'xl': '3rem',
        '2xl': '4rem',
      },
      borderRadius: {
        'default': '8px',
      },
      boxShadow: {
        'custom': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'custom-hover': '0 6px 20px rgba(0, 0, 0, 0.12)',
      },
      maxWidth: {
        'container': '1280px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}