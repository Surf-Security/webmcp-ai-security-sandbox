/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./app/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        ink: 'var(--ink)',
        text: 'var(--text)',
        mut: 'var(--mut)',
        line: 'var(--line)',
        surf: 'var(--surf)',
        bad: 'var(--bad)',
        ok: 'var(--ok)',
        hold: 'var(--hold)',
        masked: 'var(--masked)',
        'bad-bg': 'var(--bad-bg)',
        'ok-bg': 'var(--ok-bg)',
        'hold-bg': 'var(--hold-bg)',
        'masked-bg': 'var(--masked-bg)',
      },
      fontFamily: {
        mono: ['var(--mono)'],
      },
    },
  },
  plugins: [],
};
