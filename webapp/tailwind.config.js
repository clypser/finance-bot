/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Цвета из вашего дизайна
        brand: {
          black: '#000000',      // Глубокий черный фон
          card: '#151517',       // Цвет карточек (чуть светлее)
          green: '#00D65F',      // Тот самый неоновый зеленый
          greenDark: '#00b34f',  // Для нажатия
          gray: '#8E8E93',       // Текст подзаголовков
          danger: '#FF453A',     // Красный для расходов
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 214, 95, 0.15)', // Свечение для зеленой кнопки
      }
    },
  },
  plugins: [],
}