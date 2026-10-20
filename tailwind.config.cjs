/** Tailwind の設定：app/ 以下で使っているクラスだけを CSS に含める。
 *  色は意味の名前（page・card・ink・brand・ok・ng など）で、実際の値は app/styles.css の CSS 変数。
 *  明るい／暗いの切り替えは変数だけで行うので、部品側は dark: を書かない。 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        page: v('page'),
        card: v('card'),
        sunken: v('sunken'),
        line: v('line'),
        ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3') },
        brand: { DEFAULT: v('brand'), strong: v('brand-strong'), ink: v('brand-ink'), soft: v('brand-soft') },
        'on-brand': v('on-brand'),
        ok: { DEFAULT: v('ok'), ink: v('ok-ink'), soft: v('ok-soft') },
        ng: { DEFAULT: v('ng'), ink: v('ng-ink'), soft: v('ng-soft') },
        info: { DEFAULT: v('info'), ink: v('info-ink'), soft: v('info-soft') },
        medal: { 1: '#f5b40b', 2: '#a9b8cc', 3: '#f39a55', ink: '#2b1f06' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', '"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Noto Sans JP"', '"Yu Gothic UI"', 'Meiryo', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(var(--c-shadow) / 0.06), 0 6px 20px rgb(var(--c-shadow) / 0.07)',
        btn: '0 2px 0 rgb(var(--c-shadow) / 0.12), 0 6px 14px rgb(var(--c-shadow) / 0.10)',
        up: '0 -6px 24px rgb(var(--c-shadow) / 0.10)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(1)' }, '35%': { transform: 'scale(1.35)', color: '#f59e0b' }, '100%': { transform: 'scale(1)' } },
        'slide-down': { '0%': { transform: 'translateY(-120%)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        rise: { '0%': { transform: 'translateY(40px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'sheet-up': { '0%': { transform: 'translateY(24px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        pop: 'pop 0.55s ease-out',
        'slide-down': 'slide-down 0.35s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        rise: 'rise 0.6s ease-out both',
        'sheet-up': 'sheet-up 0.22s ease-out',
      },
    },
  },
  plugins: [],
};
