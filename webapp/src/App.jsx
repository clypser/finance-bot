import React, { useState, useEffect } from 'react';
import { Wallet, PieChart as PieIcon, Plus, ArrowUpRight, ArrowDownLeft, Target, Crown, X, CreditCard, Banknote, BarChart3, ChevronRight, Trash2, Calendar, FileText, Loader2 } from 'lucide-react';
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

// === СПИСКИ КАТЕГОРИЙ (РУС) ===
const EXPENSE_CATEGORIES = [
  'Продукты', 'Еда вне дома', 'Такси', 'Транспорт', 'Дом', 
  'ЖКУ', 'Связь', 'Здоровье', 'Красота', 'Спорт', 
  'Одежда', 'Техника', 'Развлечения', 'Подписки', 
  'Образование', 'Подарки', 'Кредиты', 'Прочее'
];

const INCOME_CATEGORIES = [
  'Зарплата', 'Аванс', 'Премия', 'Стипендия', 
  'Фриланс', 'Бизнес', 'Дивиденды', 'Вклады', 
  'Кэшбэк', 'Подарки', 'Возврат долга', 'Прочее'
];

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
    if (this.state.hasError) return <div className="p-4 text-red-500 text-center">Что-то пошло не так. Пожалуйста, перезагрузите.</div>;
    return this.props.children;
  }
}

// === ВЫНЕСЕННЫЙ КОМПОНЕНТ МОДАЛКИ ===
const AddModal = ({ isOpen, onClose, onAdd }) => {
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState('expense');
  const [newCategory, setNewCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
      if (isOpen) {
          setNewAmount('');
          setNewDescription('');
          setNewType('expense');
          setNewCategory(EXPENSE_CATEGORIES[0]);
      }
  }, [isOpen]);

  const handleTypeChange = (type) => {
      setNewType(type);
      setNewCategory(type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  };

  const handleSubmit = (e) => {
      e.preventDefault();
      if (!newAmount) return;
      onAdd({ 
          amount: newAmount, 
          category: newCategory, 
          type: newType, 
          description: newDescription 
      });
  };

  if (!isOpen) return null;

  const currentCategories = newType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111111] w-full max-w-sm rounded-[32px] border border-white/10 p-6 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">Новая запись</h3>
                  <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X className="text-gray-500" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Переключатель Типа */}
                  <div className="bg-black p-1 rounded-xl border border-white/10 flex">
                      <button 
                        type="button" 
                        onClick={() => handleTypeChange('expense')} 
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${newType === 'expense' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Расход
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleTypeChange('income')} 
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${newType === 'income' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Доход
                      </button>
                  </div>

                  {/* Сумма */}
                  <div>
                      <label className="text-gray-500 text-[10px] uppercase font-bold tracking-wider ml-1 mb-1 block">Сумма</label>
                      <input 
                          type="number" 
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          placeholder="0"
                          className="w-full bg-black border border-white/10 rounded-xl p-4 text-white text-2xl font-bold focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all placeholder-gray-700"
                          required
                          autoFocus
                      />
                  </div>

                  {/* Категория */}
                  <div>
                      <label className="text-gray-500 text-[10px] uppercase font-bold tracking-wider ml-1 mb-1 block">Категория</label>
                      <div className="relative">
                          <select 
                              value={newCategory}
                              onChange={(e) => setNewCategory(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-xl p-4 text-white font-medium outline-none appearance-none pr-10 focus:border-green-500 transition-colors cursor-pointer"
                          >
                              {currentCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                              ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                              <ChevronRight className="rotate-90" size={20} />
                          </div>
                      </div>
                  </div>

                  {/* Комментарий */}
                  <div>
                      <label className="text-gray-500 text-[10px] uppercase font-bold tracking-wider ml-1 mb-1 block">Комментарий (необязательно)</label>
                      <input 
                          type="text" 
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder={newType === 'expense' ? "Например: такси до дома" : "Например: премия"}
                          className="w-full bg-black border border-white/10 rounded-xl p-4 text-white font-medium focus:border-green-500 outline-none transition-colors placeholder-gray-700"
                      />
                  </div>

                  <button type="submit" className="w-full bg-[#00E08F] hover:bg-[#00c980] text-black font-extrabold text-lg py-4 rounded-[20px] mt-2 shadow-[0_0_20px_rgba(0,224,143,0.2)] active:scale-95 transition-all">
                      Сохранить
                  </button>
              </form>
          </div>
      </div>
  );
};

const MainApp = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState({ transactions: [], chartData: [], total: 0 });
  
  const [currency, setCurrency] = useState(() => {
      if (typeof window !== 'undefined' && window.localStorage) {
          return localStorage.getItem('userCurrency') || 'UZS';
      }
      return 'UZS';
  });

  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('Друг');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
      
      if (result.currency) {
          setCurrency(result.currency);
          localStorage.setItem('userCurrency', result.currency);
      }
    } catch (err) {
      console.log("No data or offline");
      // Оставляем старые данные, если есть, или пустые
      if (!data.transactions.length) setData({ transactions: [], chartData: [], total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
      // Используем нативный confirm, в Telegram WebApp он выглядит нормально
      if(!window.confirm("Удалить эту запись навсегда?")) return;
      try {
          const userId = getTelegramUserId();
          await fetch(`${API_URL}/transaction/${id}`, {
              method: 'DELETE',
              headers: { 'x-telegram-id': userId }
          });
          fetchStats(); // Обновляем список сразу
      } catch (e) {
          alert("Не удалось удалить запись");
      }
  };

  const handleAddTransaction = async (formData) => {
      try {
          const userId = getTelegramUserId();
          await fetch(`${API_URL}/transaction/add`, {
              method: 'POST',
              headers: { 
                  'x-telegram-id': userId,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(formData)
          });
          setIsAddModalOpen(false);
          fetchStats();
      } catch (e) {
          alert("Ошибка добавления. Проверьте интернет.");
      }
  };

  useEffect(() => {
    if (activeTab === 'stats' || activeTab === 'list') {
      fetchStats();
    }
  }, [activeTab, period]);

  // --- ЭКРАН ЗАГРУЗКИ ---
  if (loading && data.transactions.length === 0) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center">
              <Loader2 className="text-[#00E08F] animate-spin" size={48} />
          </div>
      );
  }

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
            <button className="text-gray-500 hover:text-white transition-colors p-1 active:scale-90 transform" onClick={() => window.Telegram?.WebApp?.close()}>
                <X size={24} />
            </button>
            <div className="text-center">
                <h1 className="text-lg font-bold text-white tracking-wide">Theo AI</h1>
            </div>
            <div className="w-8"></div>
        </div>

        <div className="text-center mt-4 mb-6">
            <h2 className="text-[32px] font-extrabold text-white mb-1 leading-tight">Привет, {userName}!</h2>
            <p className="text-gray-500 text-sm font-medium">Твой умный трекер расходов</p>
        </div>

        {/* Желтый переливающийся баннер */}
        <div className="relative overflow-hidden rounded-[32px] p-5 shadow-lg animate-shimmer cursor-pointer active:scale-95 transition-transform">
            <div className="relative z-10 flex items-center gap-4">
                <div className="bg-white/25 p-2.5 rounded-2xl backdrop-blur-md border border-white/20">
                    <Crown className="text-black" size={26} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="font-extrabold text-black text-[15px] leading-tight">Theo AI Pro — 7 дней бесплатно</h3>
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
                {currency} {displayBalance.toLocaleString()}
            </h2>
        </div>

        {/* Сводка за месяц */}
        <div className="bg-[#111111] rounded-[32px] p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6">
                <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">Статистика</p>
                <div className="flex bg-black rounded-lg p-0.5 border border-white/5">
                    {['week', 'month'].map(p => (
                        <button 
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${period === p ? 'bg-white text-black' : 'text-gray-500'}`}
                        >
                            {p === 'week' ? 'Неделя' : 'Месяц'}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="flex justify-between items-start mb-2 px-2 relative">
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

            <div className="text-center pt-6 border-t border-white/10 mt-6">
                 <p className={`text-3xl font-black mb-1 tracking-tight ${displayBalance >= 0 ? 'text-white' : 'text-red-500'}`}>
                    {displayBalance > 0 ? '+' : ''}{displayBalance.toLocaleString()}
                 </p>
                 <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide">Чистый результат • {currency}</p>
            </div>
        </div>

        {/* Кнопки навигации */}
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => setActiveTab('list')}
                    className="bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-36 relative overflow-hidden group"
                >
                    <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-black border border-white/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                        <Wallet className="text-green-500" size={28} strokeWidth={2} />
                    </div>
                    <span className="text-white font-bold text-sm tracking-wide">Транзакции</span>
                </button>

                <button className="bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-36 relative overflow-hidden group">
                    <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-black border border-white/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                        <Banknote className="text-orange-500" size={28} strokeWidth={2} />
                    </div>
                    <span className="text-white font-bold text-sm tracking-wide">Долги</span>
                </button>
            </div>

            <button className="w-full bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-32 relative overflow-hidden group">
                <div className="w-12 h-12 rounded-[18px] flex items-center justify-center bg-black border border-white/5 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                    <BarChart3 className="text-purple-500" size={24} strokeWidth={2.5} />
                </div>
                <span className="text-white font-bold text-sm tracking-wide">Аналитика</span>
            </button>
        </div>

        {/* Недавняя активность */}
        <div className="pt-2">
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-xl font-bold text-white">Недавняя активность</h3>
                <button onClick={() => setActiveTab('list')} className="text-green-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1 active:opacity-70">
                    Смотреть все <ChevronRight size={14} />
                </button>
            </div>

            <div className="space-y-3">
                {data.transactions.length === 0 ? (
                    <div className="bg-[#111111] rounded-[24px] p-8 text-center border border-white/10">
                        <p className="text-gray-500 text-sm font-medium">Пока нет операций</p>
                    </div>
                ) : (
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
                                        {t.description && t.description !== t.category && ` • ${t.description}`}
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

  const TransactionList = () => (
    <div className="p-4 pb-32 space-y-4 animate-fade-in bg-black min-h-screen pt-6">
      <div className="flex justify-between items-center mb-6 px-2">
          <h2 className="text-2xl font-bold text-white">Вся история</h2>
          <button onClick={() => setActiveTab('stats')} className="text-gray-500 p-2 bg-[#111111] rounded-full border border-white/10 active:bg-white/10 transition-colors">
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
          <div key={t.id} className="bg-[#111111] p-5 rounded-[24px] flex justify-between items-center border border-white/10 active:scale-[0.98] transition-transform group">
            <div className="flex items-center gap-5">
              <div className={`p-3.5 rounded-2xl ${t.type === 'expense' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                {t.type === 'expense' ? <ArrowDownLeft size={22} strokeWidth={2.5} /> : <ArrowUpRight size={22} strokeWidth={2.5} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-[15px] truncate">{t.category}</p>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500 font-medium">
                        {new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </p>
                    {t.description && t.description !== t.category && (
                        <p className="text-xs text-gray-600 truncate max-w-[120px]">
                            • {t.description}
                        </p>
                    )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
                <span className={`font-black text-[17px] tracking-tight ${t.type === 'expense' ? 'text-white' : 'text-green-500'}`}>
                {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()} 
                </span>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="text-gray-600 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                    <Trash2 size={18} />
                </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen font-sans overflow-x-hidden selection:bg-yellow-500/30"
         style={{ backgroundColor: '#000000', color: '#ffffff' }}>
      
      <div className="max-w-md mx-auto min-h-screen relative pb-28">
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'list' && <TransactionList />}
        
        {/* Кнопка Добавить работает, не ломая клавиатуру */}
        <AddModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddTransaction} />
        
        {/* Нижняя панель с кнопкой */}
        <div className="fixed bottom-0 left-0 w-full px-5 py-6 bg-gradient-to-t from-black via-black to-transparent z-20">
            <button 
                onClick={() => setIsAddModalOpen(true)} 
                className="w-full bg-[#00E08F] hover:bg-[#00c980] text-black font-extrabold text-[17px] py-4 rounded-[24px] active:scale-95 transition-all shadow-[0_8px_30px_rgba(0,224,143,0.25)] tracking-wide flex items-center justify-center gap-2"
            >
                <Plus strokeWidth={3} size={20} /> Добавить транзакцию
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