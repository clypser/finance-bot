import React, { useState, useEffect } from 'react';
import { Wallet, PieChart as PieIcon, Plus, ArrowUpRight, ArrowDownLeft, Target, Crown, X, CreditCard, Banknote, BarChart3, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const API_URL = ''; 

// === СТИЛИ ДЛЯ АНИМАЦИИ ===
const shimmerStyle = `
  @keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .animate-shimmer {
    background: linear-gradient(90deg, #FACC15 0%, #FEF08A 50%, #EAB308 100%);
    background-size: 200% 100%;
    animation: shimmer 3s infinite linear;
  }
`;

// === КОМПОНЕНТ ДЛЯ ОТЛОВА ОШИБОК ===
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("React Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) return <div className="p-4 text-red-500">Ошибка. Перезагрузите.</div>;
    return this.props.children;
  }
}

const MainApp = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState({ transactions: [], chartData: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user?.first_name) {
        setUserName(tg.initDataUnsafe.user.first_name);
      }
      tg.setHeaderColor('#000000');
      tg.setBackgroundColor('#000000');
    }
  }, []);

  const getTelegramUserId = () => {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '123456789';
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const userId = getTelegramUserId();
      const response = await fetch(`${API_URL}/stats/${period}`, {
        headers: { 'x-telegram-id': userId }
      });
      
      if (!response.ok) throw new Error('API Error');
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.log("No data or offline");
      setData({ transactions: [], chartData: [], total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stats' || activeTab === 'list') {
      fetchStats();
    }
  }, [activeTab, period]);

  // --- ГЛАВНАЯ СТРАНИЦА ---
  const StatsView = () => {
    const displayBalance = data.transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    const displayExpense = data.chartData.reduce((acc, c) => acc + c.value, 0);
    const displayIncome = data.transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);

    return (
      <div className="p-5 pb-36 space-y-6 animate-fade-in font-sans">
        <style>{shimmerStyle}</style>
        
        {/* Хедер */}
        <div className="flex justify-between items-center pt-2 px-1">
            <button className="text-gray-500 hover:text-white transition-colors p-1" onClick={() => window.Telegram?.WebApp?.close()}>
                <X size={24} />
            </button>
            <div className="text-center">
                <h1 className="text-lg font-bold text-white tracking-wide">Loomy AI</h1>
            </div>
            <div className="w-8"></div>
        </div>

        <div className="text-center mt-4 mb-6">
            <h2 className="text-[32px] font-extrabold text-white mb-1 leading-tight">Привет, {userName}!</h2>
            <p className="text-gray-500 text-sm font-medium">Ваш умный трекер расходов</p>
        </div>

        {/* Желтый переливающийся баннер */}
        <div className="relative overflow-hidden rounded-[32px] p-5 shadow-lg animate-shimmer cursor-pointer active:scale-95 transition-transform">
            <div className="relative z-10 flex items-center gap-4">
                <div className="bg-white/25 p-2.5 rounded-2xl backdrop-blur-md border border-white/20">
                    <Crown className="text-black" size={26} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="font-extrabold text-black text-[15px] leading-tight">Loomy AI Pro — 7 дней бесплатно</h3>
                    <p className="text-black/70 text-[11px] font-bold mt-0.5 uppercase tracking-wide">Без карты • Авто-отмена</p>
                </div>
            </div>
        </div>

        {/* Карточка баланса */}
        <div className="bg-[#111111] rounded-[32px] p-8 text-center border border-white/10 shadow-2xl relative overflow-hidden">
            <p className="text-gray-500 text-[11px] font-bold mb-3 uppercase tracking-widest">Текущий баланс</p>
            <h2 className="text-[40px] font-black text-white tracking-tighter flex justify-center items-center gap-3">
                {displayBalance !== 0 && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                )}
                UZS {displayBalance.toLocaleString()}
            </h2>
        </div>

        {/* Сводка за месяц */}
        <div className="bg-[#111111] rounded-[32px] p-6 border border-white/10">
            <p className="text-center text-gray-500 text-[11px] font-bold mb-8 uppercase tracking-widest">Сводка за период</p>
            
            <div className="flex justify-between items-start mb-2 px-2 relative">
                {/* Разделитель */}
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/10 -translate-x-1/2"></div>

                <div className="text-center w-1/2 pr-4">
                    <p className="text-xl font-bold text-white mb-1.5 tracking-tight">-{displayExpense.toLocaleString()}</p>
                    <div className="flex items-center justify-center gap-1.5 text-red-500 text-[10px] font-black uppercase tracking-wider bg-red-500/10 py-1 px-2 rounded-lg mx-auto w-max">
                        <ArrowDownLeft size={12} strokeWidth={3} /> Расходы
                    </div>
                </div>
                <div className="text-center w-1/2 pl-4">
                    <p className="text-xl font-bold text-white mb-1.5 tracking-tight">+{displayIncome.toLocaleString()}</p>
                    <div className="flex items-center justify-center gap-1.5 text-green-500 text-[10px] font-black uppercase tracking-wider bg-green-500/10 py-1 px-2 rounded-lg mx-auto w-max">
                        <ArrowUpRight size={12} strokeWidth={3} /> Доходы
                    </div>
                </div>
            </div>

            {/* Чистый результат */}
            <div className="text-center pt-6 border-t border-white/10 mt-6">
                 <p className={`text-3xl font-black mb-1 tracking-tight ${displayBalance >= 0 ? 'text-white' : 'text-red-500'}`}>
                    {displayBalance > 0 ? '+' : ''}{displayBalance.toLocaleString()}
                 </p>
                 <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide">Чистый результат • UZS</p>
            </div>
        </div>

        {/* === КНОПКИ НАВИГАЦИИ === */}
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {/* Транзакции (Зеленый) */}
                <button 
                    onClick={() => setActiveTab('list')}
                    className="bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-36 relative overflow-hidden group"
                >
                    <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-black border border-white/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                        <Wallet className="text-green-500" size={28} strokeWidth={2} />
                    </div>
                    <span className="text-white font-bold text-sm tracking-wide">Транзакции</span>
                </button>

                {/* Долги (Оранжевый) */}
                <button className="bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-36 relative overflow-hidden group">
                    <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-black border border-white/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                        <Banknote className="text-orange-500" size={28} strokeWidth={2} />
                    </div>
                    <span className="text-white font-bold text-sm tracking-wide">Долги</span>
                </button>
            </div>

            {/* Аналитика (Фиолетовый) */}
            <button className="w-full bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-32 relative overflow-hidden group">
                <div className="w-12 h-12 rounded-[18px] flex items-center justify-center bg-black border border-white/5 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                    <BarChart3 className="text-purple-500" size={24} strokeWidth={2.5} />
                </div>
                <span className="text-white font-bold text-sm tracking-wide">Аналитика</span>
            </button>
        </div>

        {/* === НЕДАВНЯЯ АКТИВНОСТЬ (НОВЫЙ БЛОК) === */}
        <div className="pt-2">
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-xl font-bold text-white">Недавняя активность</h3>
                <button onClick={() => setActiveTab('list')} className="text-green-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    Смотреть все <ChevronRight size={14} />
                </button>
            </div>

            <div className="space-y-3">
                {data.transactions.length === 0 ? (
                    <div className="bg-[#111111] rounded-[24px] p-6 text-center border border-white/10">
                        <p className="text-gray-500 text-sm">Пока нет операций</p>
                    </div>
                ) : (
                    // Показываем только последние 3 транзакции
                    data.transactions.slice(0, 3).map((t) => (
                        <div key={t.id} className="bg-[#111111] p-4 rounded-[24px] flex justify-between items-center border border-white/10 active:scale-[0.98] transition-transform">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${t.type === 'expense' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                    {t.type === 'expense' ? <ArrowDownLeft size={20} strokeWidth={2.5} /> : <ArrowUpRight size={20} strokeWidth={2.5} />}
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">{t.category}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium uppercase">
                                        {new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                    </p>
                                </div>
                            </div>
                            <span className={`font-black text-[15px] tracking-tight ${t.type === 'expense' ? 'text-white' : 'text-green-500'}`}>
                                {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()} 
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    );
  };

  // --- СПИСОК ТРАНЗАКЦИЙ (ОТДЕЛЬНАЯ СТРАНИЦА) ---
  const TransactionList = () => (
    <div className="p-4 pb-32 space-y-4 animate-fade-in bg-black min-h-screen pt-6">
      <div className="flex justify-between items-center mb-6 px-2">
          <h2 className="text-2xl font-bold text-white">Вся история</h2>
          <button onClick={() => setActiveTab('stats')} className="text-gray-500 p-2 bg-[#111111] rounded-full border border-white/10">
             <X size={20} />
          </button>
      </div>
      
      {data.transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-700 mt-10">
            <div className="bg-[#111111] p-6 rounded-full mb-4 border border-white/5">
                <Wallet size={48} className="opacity-50 text-gray-500" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest">Список пуст</p>
        </div>
      ) : (
        data.transactions.map((t) => (
          <div key={t.id} className="bg-[#111111] p-5 rounded-[24px] flex justify-between items-center border border-white/10 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-5">
              <div className={`p-3.5 rounded-2xl ${t.type === 'expense' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                {t.type === 'expense' ? <ArrowDownLeft size={22} strokeWidth={2.5} /> : <ArrowUpRight size={22} strokeWidth={2.5} />}
              </div>
              <div>
                <p className="font-bold text-white text-[15px]">{t.category}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                    {new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            <span className={`font-black text-[17px] tracking-tight ${t.type === 'expense' ? 'text-white' : 'text-green-500'}`}>
              {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()} 
            </span>
          </div>
        ))
      )}
    </div>
  );

  // --- ГЛАВНАЯ ОБЕРТКА ---
  return (
    <div className="min-h-screen font-sans overflow-x-hidden selection:bg-yellow-500/30"
         style={{ backgroundColor: '#000000', color: '#ffffff' }}>
      
      <div className="max-w-md mx-auto min-h-screen relative pb-28">
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'list' && <TransactionList />}
        {activeTab === 'add' && window.Telegram?.WebApp?.close()} 
        
        {/* Нижняя кнопка-экшен */}
        <div className="fixed bottom-0 left-0 w-full px-5 py-6 bg-gradient-to-t from-black via-black to-transparent z-20">
            <button 
                onClick={() => window.Telegram?.WebApp?.close()} 
                className="w-full bg-[#00E08F] hover:bg-[#00c980] text-black font-extrabold text-[17px] py-4 rounded-[24px] active:scale-95 transition-all shadow-[0_8px_30px_rgba(0,224,143,0.25)] tracking-wide"
            >
                Добавить транзакцию
            </button>
        </div>
      </div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <MainApp />
  </ErrorBoundary>
);

export default App;