import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  PieChart as PieIcon, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Crown, 
  Target, 
  LayoutGrid, 
  MoreHorizontal,
  X
} from 'lucide-react';

const API_URL = ''; 

const MOCK_DATA = {
  transactions: [],
  chartData: [],
  total: 0
};

const App = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const [data, setData] = useState({ transactions: [], chartData: [], total: 0 });
  const [loading, setLoading] = useState(false);
  
  // Принудительно включаем темную тему для этого дизайна
  useEffect(() => {
    document.documentElement.classList.add('dark');
    window.Telegram?.WebApp?.setHeaderColor('#000000');
    window.Telegram?.WebApp?.setBackgroundColor('#000000');
    window.Telegram?.WebApp?.expand(); // Раскрыть на весь экран
  }, []);

  const getTelegramUser = () => {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || { first_name: 'Пользователь', id: '123456789' };
  };

  const user = getTelegramUser();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stats/month`, {
        headers: { 'x-telegram-id': user.id.toString() }
      });
      if (!response.ok) throw new Error('API Error');
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.log(err);
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Расчет доходов и расходов для сводки
  const expenseTotal = data.transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);
    
  const incomeTotal = data.transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = incomeTotal - expenseTotal;

  // --- ГЛАВНЫЙ ЭКРАН (Как на макете) ---
  const HomeView = () => (
    <div className="p-5 pb-32 min-h-screen bg-brand-black text-white">
      
      {/* Хедер: Закрыть и Theo AI */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => window.Telegram?.WebApp?.close()} className="flex items-center gap-2 text-gray-400 bg-brand-card px-3 py-1.5 rounded-full text-sm font-medium active:opacity-70">
          <X size={16} /> Закрыть
        </button>
        <div className="flex items-center gap-1">
          <span className="text-brand-green font-bold text-xl">Theo</span>
          <span className="text-white font-bold text-xl">AI</span>
        </div>
        <button className="text-gray-400 bg-brand-card p-1.5 rounded-full active:opacity-70">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Приветствие */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-1">Привет, {user.first_name}!</h1>
        <p className="text-brand-gray text-sm">Ваш умный трекер расходов</p>
      </div>

      {/* Карточка PRO (Баннер) */}
      <div className="bg-gradient-to-r from-[#00D65F] to-[#05b354] rounded-[24px] p-4 mb-6 flex items-center gap-4 shadow-glow relative overflow-hidden">
        {/* Декор */}
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
        
        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
          <Crown className="text-white" size={24} />
        </div>
        <div>
          <h3 className="font-bold text-black text-base">Theo AI Pro — 7 дней бесплатно</h3>
          <p className="text-black/70 text-xs">Без карты • Завершится автоматически</p>
        </div>
      </div>

      {/* Текущий баланс */}
      <div className="bg-brand-card rounded-[30px] p-6 mb-4 text-center border border-white/5">
        <p className="text-brand-gray text-sm mb-2">Текущий баланс</p>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-green shadow-[0_0_10px_#00D65F]"></div>
          <h2 className="text-3xl font-bold tracking-wide">
            UZS {balance.toLocaleString()}
          </h2>
        </div>
      </div>

      {/* Сводка за сегодня */}
      <div className="bg-brand-card rounded-[30px] p-6 mb-4 border border-white/5">
        <p className="text-brand-gray text-center text-sm mb-6">Сводка за месяц</p>
        
        <div className="flex justify-between items-center mb-6 px-4">
          <div className="text-center">
            <p className="text-brand-danger font-bold text-xl mb-1">
              {expenseTotal > 0 ? '-' : ''}{expenseTotal.toLocaleString()}
            </p>
            <div className="flex items-center justify-center gap-1 text-brand-danger text-xs">
              <ArrowDownLeft size={14} /> Расходы
            </div>
          </div>

          <div className="w-px h-10 bg-white/10"></div>

          <div className="text-center">
            <p className="text-brand-green font-bold text-xl mb-1">
              +{incomeTotal.toLocaleString()}
            </p>
            <div className="flex items-center justify-center gap-1 text-brand-green text-xs">
              <ArrowUpRight size={14} /> Доходы
            </div>
          </div>
        </div>

        <div className="text-center pt-4 border-t border-white/10">
          <p className={`text-lg font-bold ${balance >= 0 ? 'text-brand-green' : 'text-brand-danger'}`}>
            {balance > 0 ? '+' : ''}{balance.toLocaleString()}
          </p>
          <p className="text-brand-gray text-xs mt-1">Чистый результат • UZS</p>
        </div>
      </div>

      {/* Грид кнопок (Лимиты / Категории) */}
      <div className="grid grid-cols-2 gap-4 mb-24">
        <button className="bg-brand-card p-5 rounded-[24px] flex flex-col items-center justify-center gap-3 border border-white/5 active:scale-95 transition-transform h-32">
          <div className="w-10 h-10 rounded-full border-2 border-yellow-500 flex items-center justify-center text-yellow-500">
            <Target size={20} />
          </div>
          <span className="font-medium text-sm">Лимиты</span>
        </button>

        <button className="bg-brand-card p-5 rounded-[24px] flex flex-col items-center justify-center gap-3 border border-white/5 active:scale-95 transition-transform h-32">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-500">
            <LayoutGrid size={20} />
          </div>
          <span className="font-medium text-sm">Категории</span>
        </button>
      </div>

      {/* Большая зеленая кнопка (Fixed Bottom) */}
      <div className="fixed bottom-6 left-4 right-4 z-20">
        <button 
          onClick={() => window.Telegram?.WebApp?.close()}
          className="w-full bg-brand-green text-black font-bold text-lg py-4 rounded-[20px] shadow-glow active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          Добавить транзакцию
        </button>
      </div>

    </div>
  );

  return (
    <div className="min-h-screen bg-brand-black font-sans text-white selection:bg-brand-green selection:text-black">
      <HomeView />
    </div>
  );
}

export default App;