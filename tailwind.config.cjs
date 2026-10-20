/** Tailwind の設定：app/ 以下で使っているクラスだけを CSS に含める */
module.exports = {
  content: ['./app/**/*.{js,jsx}'],
  theme: {
    extend: {
      keyframes: {
        pop: { '0%': { transform: 'scale(1)' }, '35%': { transform: 'scale(1.35)', color: '#f59e0b' }, '100%': { transform: 'scale(1)' } },
        'slide-down': { '0%': { transform: 'translateY(-120%)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        rise: { '0%': { transform: 'translateY(40px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        pop: 'pop 0.55s ease-out',
        'slide-down': 'slide-down 0.35s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        rise: 'rise 0.6s ease-out both',
      },
    },
  },
  plugins: [],
};
