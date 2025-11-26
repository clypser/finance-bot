import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Wallet, PieChart as PieIcon, Plus, ArrowUpRight, ArrowDownLeft, Sun, Moon } from 'lucide-react';

const API_URL = ''; 

// === КОМПОНЕНТ ДЛЯ ОТЛОВА ОШИБОК ===
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#ff5555', background: '#1a1a1a', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>💥 Приложение упало</h2>
          <p style={{ marginBottom: '20px' }}>Пожалуйста, сделайте скриншот и отправьте разработчику.</p>
          <div style={{ background: '#000', padding: '10px', borderRadius: '8px', overflow: 'auto' }}>
            <strong>Error:</strong> {this.state.error && this.state.error.toString()}
            <br /><br />
            <strong>Details:</strong>
            <pre style={{ fontSize: '11px' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px' }}
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
// ===================================

const MOCK_DATA = {
  transactions: [],
  chartData: [],
  total: 0
};

const MainApp = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState({ transactions: [], chartData: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  
  // Безопасная инициализация темы
  const [theme, setTheme] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) return savedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch (e) {
      console.warn("Theme init error", e);
    }
    return 'dark';
  });

  useEffect(() => {
    try {
      const root = window.document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        // Красим хедер и фон самого Телеграма
        window.Telegram?.WebApp?.setHeaderColor('#030712');
        window.Telegram?.WebApp?.setBackgroundColor('#030712');
      } else {
        root.classList.remove('dark');
        // Красим хедер и фон самого Телеграма
        window.Telegram?.WebApp?.setHeaderColor('#FFFFFF');
        window.Telegram?.WebApp?.setBackgroundColor('#FFFFFF');
      }
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.error("Theme effect error", e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const getTelegramUserId = () => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
    }
    return '123456789';
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
      setIsDemo(false);
    } catch (err) {
      console.log("Ошибка подключения:", err);
      setData(MOCK_DATA);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    if (activeTab === 'stats' || activeTab === 'list') {
      fetchStats();
    }
  }, [activeTab, period]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // --- КОМПОНЕНТЫ ---

  const TabBar = () => (
    <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-900 flex justify-around p-3 pb-6 z-10 safe-area-bottom transition-colors duration-200">
      <button 
        onClick={() => setActiveTab('stats')} 
        className={`flex flex-col items-center transition-colors ${activeTab === 'stats' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}
      >
        <PieIcon size={24} />
        <span className="text-[10px] mt-1">Обзор</span>
      </button>
      <button 
        onClick={() => setActiveTab('add')} 
        className="bg-blue-500 text-white p-3 rounded-full -mt-8 shadow-lg hover:bg-blue-600 active:scale-95 transition-all dark:shadow-blue-900/30 dark:bg-blue-600"
      >
        <Plus size={24} />
      </button>
      <button 
        onClick={() => setActiveTab('list')} 
        className={`flex flex-col items-center transition-colors ${activeTab === 'list' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}
      >
        <Wallet size={24} />
        <span className="text-[10px] mt-1">История</span>
      </button>
    </div>
  );

  const Header = ({ title, showThemeToggle = false }) => (
    <div className="flex justify-between items-center mb-6 px-2">
      <h1 className="text-2xl font-bold" style={{ color: theme === 'dark' ? '#fff' : '#111827' }}>{title}</h1>
      {showThemeToggle && (
        <button 
          onClick={toggleTheme} 
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      )}
    </div>
  );

  const StatsView = () => (
    <div className="p-4 pb-28 space-y-6 animate-fade-in">
      <Header title="Мои Финансы" showThemeToggle={true} />

      {isDemo && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-xs mb-4">
          ⚠️ Нет связи с сервером.
        </div>
      )}

      <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-900 p-1 rounded-xl transition-colors">
        {['day', 'week', 'month'].map(p => (
          <button 
            key={p} 
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${period === p ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
            style={{ 
              color: period === p 
                ? (theme === 'dark' ? '#fff' : '#111827') 
                : (theme === 'dark' ? '#9CA3AF' : '#6B7280') 
            }}
          >
            {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
          </button>
        ))}
      </div>

      <div className="bg-blue-500 dark:bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-500/20 dark:shadow-blue-900/30 text-center text-white transition-colors">
        <p className="text-blue-100 text-sm mb-1 font-medium">Всего расходов за период</p>
        <h2 className="text-4xl font-extrabold tracking-tight">
          {data.chartData.reduce((acc, curr) => acc + curr.value, 0).toLocaleString()} <span className="text-xl text-blue-200 font-semibold">UZS</span>
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl shadow-sm transition-colors h-80 flex flex-col">
        <h3 className="text-base font-bold mb-4 text-gray-900 dark:text-white">Структура расходов</h3>
        <div className="flex-1 min-h-0 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">Загрузка...</div>
          ) : data.chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 text-sm">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={6}
                >
                  {data.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="drop-shadow-sm" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `${value.toLocaleString()} UZS`}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    color: theme === 'dark' ? '#FFFFFF' : '#111827'
                  }}
                  itemStyle={{ color: theme === 'dark' ? '#FFFFFF' : '#111827' }}
                  labelStyle={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
             <span className="text-3xl font-bold text-gray-900 dark:text-white">
                 {data.chartData.reduce((acc, curr) => acc + curr.value, 0) > 0 ? 
                    (data.chartData.reduce((acc, curr) => acc + curr.value, 0) / 1000).toFixed(0) + 'k' 
                    : '0'}
             </span>
             <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Всего</span>
          </div>
        </div>
      </div>
    </div>
  );

  const TransactionList = () => (
    <div className="p-4 pb-28 space-y-4 animate-fade-in">
      <Header title="История операций" showThemeToggle={true} />
      {data.transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-600">
            <Wallet size={48} className="mb-4 opacity-50" />
            <p>История пуста</p>
        </div>
      ) : (
        data.transactions.map((t) => (
          <div key={t.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm flex justify-between items-center transition-all active:scale-[0.99]">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${t.type === 'expense' ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/30 text-green-500 dark:text-green-400'} transition-colors`}>
                {t.type === 'expense' ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-base">{t.category}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                    {new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    {t.description && t.description !== t.category && ` • ${t.description}`}
                </p>
              </div>
            </div>
            <span className={`font-bold text-lg whitespace-nowrap ${t.type === 'expense' ? 'text-gray-900 dark:text-white' : 'text-green-600 dark:text-green-500'}`}>
              {t.type === 'expense' ? '- ' : '+ '}{t.amount.toLocaleString()} 
            </span>
          </div>
        ))
      )}
    </div>
  );

  const AddForm = () => {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[80vh] pb-28 text-center animate-fade-in">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-6 rounded-full mb-6 transition-colors">
          <Wallet size={56} className="text-blue-500 dark:text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Быстрая запись</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-[280px] text-base leading-relaxed">
          Вернитесь в чат и напишите боту сумму и категорию (например, "Такси 25к") или отправьте фото чека.
        </p>
        <button 
          onClick={() => window.Telegram?.WebApp?.close()} 
          className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-10 py-4 rounded-2xl w-full font-bold text-lg active:scale-95 transition-all shadow-lg dark:shadow-white/20"
        >
          Вернуться в чат
        </button>
      </div>
    );
  };

  return (
    // ПРИНУДИТЕЛЬНО УСТАНАВЛИВАЕМ ФОН через style, чтобы перебить любые глюки CSS
    <div 
      className="min-h-screen font-sans transition-colors duration-200 overflow-x-hidden"
      style={{ 
        backgroundColor: theme === 'dark' ? '#030712' : '#ffffff',
        color: theme === 'dark' ? '#ffffff' : '#111827'
      }}
    >
      <div className="max-w-md mx-auto min-h-screen relative">
         {/* Градиент показываем только если тема светлая */}
         {activeTab === 'stats' && theme === 'light' && (
           <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none" />
         )}

        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'list' && <TransactionList />}
        {activeTab === 'add' && <AddForm />}
        
        <TabBar />
      </div>
    </div>
  );
}

// Оборачиваем все приложение в ловец ошибок
const App = () => (
  <ErrorBoundary>
    <MainApp />
  </ErrorBoundary>
);

export default App;