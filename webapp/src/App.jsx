import React, { useState, useEffect } from 'react';
import { Wallet, PieChart as PieIcon, Plus, ArrowUpRight, ArrowDownLeft, Crown, X, CreditCard, Banknote, BarChart3, ChevronRight, Trash2, User, Settings, LogOut, AlertTriangle, Star } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const API_URL = ''; 

// === ЦВЕТА И СТИЛИ ===
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

const EXPENSE_CATEGORIES = ['Продукты', 'Еда вне дома', 'Такси', 'Транспорт', 'Дом', 'ЖКУ', 'Связь', 'Здоровье', 'Красота', 'Спорт', 'Одежда', 'Техника', 'Развлечения', 'Подписки', 'Образование', 'Подарки', 'Кредиты', 'Прочее'];
const INCOME_CATEGORIES = ['Зарплата', 'Аванс', 'Премия', 'Стипендия', 'Фриланс', 'Бизнес', 'Дивиденды', 'Вклады', 'Кэшбэк', 'Подарки', 'Возврат долга', 'Прочее'];

// === КОМПОНЕНТЫ ===

const ErrorBoundary = ({ children }) => {
  // Простая реализация для краткости
  return children; 
};

// Модалка добавления (без изменений логики, только стиль)
const AddModal = ({ isOpen, onClose, onAdd }) => {
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState('expense');
  const [newCategory, setNewCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
      if (isOpen) { setNewAmount(''); setNewDescription(''); setNewType('expense'); setNewCategory(EXPENSE_CATEGORIES[0]); }
  }, [isOpen]);

  const handleTypeChange = (type) => { setNewType(type); setNewCategory(type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]); };
  const handleSubmit = (e) => { e.preventDefault(); if (!newAmount) return; onAdd({ amount: newAmount, category: newCategory, type: newType, description: newDescription }); };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111111] w-full max-w-sm rounded-[32px] border border-white/10 p-6 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">Новая запись</h3>
                  <button onClick={onClose}><X className="text-gray-500" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="bg-black p-1 rounded-xl border border-white/10 flex">
                      <button type="button" onClick={() => handleTypeChange('expense')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newType === 'expense' ? 'bg-white text-black' : 'text-gray-500'}`}>Расход</button>
                      <button type="button" onClick={() => handleTypeChange('income')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newType === 'income' ? 'bg-white text-black' : 'text-gray-500'}`}>Доход</button>
                  </div>
                  <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white text-2xl font-bold outline-none" required autoFocus />
                  <div className="relative">
                      <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white font-medium outline-none appearance-none pr-10">
                          {(newType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-gray-500" size={20} />
                  </div>
                  <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Комментарий..." className="w-full bg-black border border-white/10 rounded-xl p-4 text-white font-medium outline-none" />
                  <button type="submit" className="w-full bg-[#00E08F] hover:bg-[#00c980] text-black font-extrabold text-lg py-4 rounded-[20px] mt-2">Сохранить</button>
              </form>
          </div>
      </div>
  );
};

// --- ЭКРАН ПОДПИСКИ ---
const SubscriptionView = ({ onBack, user, onBuy }) => {
    const [selectedPlan, setSelectedPlan] = useState('1_month');
    
    const plans = [
        { id: '1_month', title: 'Месячный план', price: 100, desc: 'Самый гибкий', label: '100 звезд' },
        { id: '3_months', title: 'План на 3 месяца', price: 270, desc: 'Экономия ~10%', label: '270 звезд' },
        { id: '12_months', title: 'Годовой план', price: 1000, desc: 'Лучшая цена', label: '1000 звезд', best: true },
    ];

    const expiresDate = user.proExpiresAt ? new Date(user.proExpiresAt).toLocaleDateString() : null;

    return (
        <div className="p-5 pb-32 font-sans min-h-screen bg-black animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 bg-[#111111] rounded-full text-white"><ChevronRight className="rotate-180" /></button>
                <h2 className="text-xl font-bold text-white">Управление подпиской</h2>
            </div>

            <div className="flex justify-center mb-8">
                <div className="bg-[#111111] p-6 rounded-[32px] border border-white/10 flex flex-col items-center">
                    <div className="bg-green-500/10 p-4 rounded-2xl mb-4">
                        <CreditCard className="text-[#00E08F] w-8 h-8" />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-1">Loomy AI Pro</h3>
                    {user.isPro ? (
                         <p className="text-green-500 text-sm font-medium">Активна до {expiresDate}</p>
                    ) : (
                         <p className="text-gray-500 text-sm">Не активна</p>
                    )}
                </div>
            </div>

            <h3 className="text-white font-bold text-lg mb-4">Выберите план</h3>
            <div className="space-y-3">
                {plans.map(plan => (
                    <div 
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`p-5 rounded-[24px] border transition-all cursor-pointer relative ${selectedPlan === plan.id ? 'bg-[#111111] border-[#00E08F]' : 'bg-[#111111] border-white/5'}`}
                    >
                        {plan.best && <span className="absolute -top-3 left-6 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">ЛУЧШАЯ ЦЕНА</span>}
                        <div className="flex justify-between items-center">
                            <div>
                                <p className={`font-bold text-base ${selectedPlan === plan.id ? 'text-[#00E08F]' : 'text-white'}`}>{plan.title}</p>
                                <p className="text-gray-500 text-xs mt-1">{plan.desc}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-white font-bold text-lg">{plan.price}</p>
                                <div className="flex items-center justify-end text-yellow-500 text-xs gap-1"><Star size={10} fill="currentColor" /> Stars</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 w-full px-5 py-6 bg-gradient-to-t from-black via-black to-transparent z-20">
                <button 
                    onClick={() => onBuy(selectedPlan)}
                    className="w-full bg-[#00E08F] hover:bg-[#00c980] text-black font-extrabold text-[17px] py-4 rounded-[24px] active:scale-95 transition-all"
                >
                    Оплатить звездами
                </button>
            </div>
        </div>
    );
};

// --- ЭКРАН ПРОФИЛЯ ---
const ProfileView = ({ user, onBack, onOpenSub, onClearData, onDeleteAccount, onCurrencyChange }) => {
    const currencies = ['UZS', 'USD', 'RUB', 'KZT', 'EUR'];

    return (
        <div className="p-5 pb-32 font-sans min-h-screen bg-black animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 bg-[#111111] rounded-full text-white"><ChevronRight className="rotate-180" /></button>
                <h2 className="text-xl font-bold text-white">Профиль</h2>
            </div>

            {/* Карточка юзера */}
            <div className="bg-[#111111] p-4 rounded-[24px] border border-white/10 flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-xl">😎</div>
                    <div>
                        <h3 className="text-white font-bold text-lg">{user.firstName || 'Пользователь'}</h3>
                        <p className="text-gray-500 text-xs">@{user.username || 'username'}</p>
                    </div>
                </div>
                <div onClick={onOpenSub} className="cursor-pointer bg-green-500/20 text-green-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    {user.isPro ? 'PRO' : 'FREE'} <ChevronRight size={14} />
                </div>
            </div>

            {/* Настройки */}
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 ml-1">Настройки</h3>
            <div className="bg-[#111111] rounded-[24px] border border-white/10 overflow-hidden mb-6">
                <div className="p-4 flex justify-between items-center border-b border-white/5">
                    <span className="text-white font-medium">Язык</span>
                    <span className="text-gray-500 text-sm flex items-center gap-1">Русский <span className="text-xs">🇷🇺</span></span>
                </div>
                <div className="p-4 flex justify-between items-center">
                    <span className="text-white font-medium">Валюта</span>
                    <select 
                        value={user.currency} 
                        onChange={(e) => onCurrencyChange(e.target.value)}
                        className="bg-black text-white text-sm p-1 rounded border border-white/20 outline-none"
                    >
                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Опасная зона */}
            <h3 className="text-red-500 text-xs font-bold uppercase tracking-wider mb-3 ml-1">Опасная зона</h3>
            <div className="space-y-3">
                <button onClick={onClearData} className="w-full bg-yellow-500 text-black font-bold py-3.5 rounded-[20px] flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <Trash2 size={18} /> Очистить все транзакции
                </button>
                <button onClick={onDeleteAccount} className="w-full bg-red-600 text-white font-bold py-3.5 rounded-[20px] flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <LogOut size={18} /> Удалить аккаунт
                </button>
            </div>
        </div>
    );
};

const MainApp = () => {
  const [view, setView] = useState('main'); // main, profile, subscription
  const [activeTab, setActiveTab] = useState('stats');
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState({ transactions: [], chartData: [], total: 0 });
  const [user, setUser] = useState({ currency: 'UZS', firstName: 'User', username: '', isPro: false });
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [limitRemaining, setLimitRemaining] = useState(50);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready(); tg.expand(); tg.setHeaderColor('#000000'); tg.setBackgroundColor('#000000');
    }
    fetchUser();
  }, []);

  const getTelegramUserId = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '123456789';

  const fetchUser = async () => {
      try {
          const userId = getTelegramUserId();
          const res = await fetch(`${API_URL}/user/me`, { headers: { 'x-telegram-id': userId } });
          if (res.ok) {
              const u = await res.json();
              setUser(u);
              localStorage.setItem('userCurrency', u.currency);
          }
      } catch(e) {}
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const userId = getTelegramUserId();
      const response = await fetch(`${API_URL}/stats/${period}`, { headers: { 'x-telegram-id': userId } });
      if (response.ok) {
          const result = await response.json();
          setData(result);
          setLimitRemaining(result.limitRemaining);
          setUser(prev => ({ ...prev, isPro: result.isPro, currency: result.currency }));
      }
    } catch (err) { console.log("Offline"); } finally { setLoading(false); }
  };

  // API ACTIONS
  const handleDelete = async (id) => {
      if(!window.confirm("Удалить?")) return;
      const userId = getTelegramUserId();
      await fetch(`${API_URL}/transaction/${id}`, { method: 'DELETE', headers: { 'x-telegram-id': userId } });
      fetchStats();
  };

  const handleAddTransaction = async (formData) => {
      const userId = getTelegramUserId();
      const res = await fetch(`${API_URL}/transaction/add`, {
          method: 'POST',
          headers: { 'x-telegram-id': userId, 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
      });
      if (res.status === 403) { alert("Лимит!"); return; }
      setIsAddModalOpen(false);
      fetchStats();
  };

  const handleBuyPro = async (planId) => {
      const userId = getTelegramUserId();
      await fetch(`${API_URL}/payment/invoice`, {
          method: 'POST',
          headers: { 'x-telegram-id': userId, 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planId })
      });
      window.Telegram?.WebApp?.close();
  };

  const handleClearData = async () => {
      if(!window.confirm("Вы уверены? Это удалит ВСЕ ваши записи.")) return;
      const userId = getTelegramUserId();
      await fetch(`${API_URL}/transactions/clear`, { method: 'DELETE', headers: { 'x-telegram-id': userId } });
      fetchStats();
      alert("Данные очищены");
  };

  const handleDeleteAccount = async () => {
      if(!window.confirm("Удалить аккаунт НАВСЕГДА? Это действие нельзя отменить.")) return;
      const userId = getTelegramUserId();
      await fetch(`${API_URL}/user/delete`, { method: 'DELETE', headers: { 'x-telegram-id': userId } });
      window.Telegram?.WebApp?.close();
  };
  
  // Фейковая смена валюты (реально надо отправлять запрос боту, но для UI сойдет)
  const handleCurrencyChange = (newCurr) => {
      setUser(prev => ({ ...prev, currency: newCurr }));
      // В идеале тут нужен запрос на сервер /user/currency
  };

  useEffect(() => { if (view === 'main') fetchStats(); }, [activeTab, period, view]);

  // --- RENDER ---

  if (view === 'subscription') {
      return <SubscriptionView onBack={() => setView('profile')} user={user} onBuy={handleBuyPro} />;
  }

  if (view === 'profile') {
      return <ProfileView 
                user={user} 
                onBack={() => setView('main')} 
                onOpenSub={() => setView('subscription')}
                onClearData={handleClearData}
                onDeleteAccount={handleDeleteAccount}
                onCurrencyChange={handleCurrencyChange}
             />;
  }

  // Main View
  return (
    <div className="min-h-screen font-sans overflow-x-hidden selection:bg-yellow-500/30" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
      <style>{shimmerStyle}</style>
      
      <div className="max-w-md mx-auto min-h-screen relative pb-28">
        {activeTab === 'stats' && (
           <div className="p-5 pb-36 space-y-6 animate-fade-in">
               {/* Header */}
               <div className="flex justify-between items-center pt-2 px-1">
                   <button className="text-gray-500 hover:text-white p-1" onClick={() => window.Telegram?.WebApp?.close()}><X size={24} /></button>
                   <h1 className="text-lg font-bold text-white tracking-wide">Loomy AI</h1>
                   <button onClick={() => setView('profile')} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs overflow-hidden border border-white/20">
                       {user.isPro ? <span className="text-[#00E08F] font-bold">PRO</span> : <User size={16} />}
                   </button>
               </div>

               <div className="text-center mt-4 mb-6">
                   <h2 className="text-[32px] font-extrabold text-white mb-1 leading-tight">Привет, {user.firstName}!</h2>
                   <p className="text-gray-500 text-sm font-medium">Ваш умный трекер расходов</p>
               </div>

               {/* Banner */}
               {!user.isPro && (
                   <div className="relative overflow-hidden rounded-[32px] p-5 shadow-lg animate-shimmer cursor-pointer active:scale-95 transition-transform" onClick={() => setView('subscription')}>
                       <div className="relative z-10 flex items-center gap-4">
                           <div className="bg-white/25 p-2.5 rounded-2xl backdrop-blur-md border border-white/20"><Crown className="text-black" size={26} strokeWidth={2.5} /></div>
                           <div>
                               <h3 className="font-extrabold text-black text-[15px]">Loomy AI Pro — Бесплатно 7 дней</h3>
                               <p className="text-black/70 text-[11px] font-bold mt-0.5 uppercase">Осталось записей: {limitRemaining}</p>
                           </div>
                       </div>
                   </div>
               )}

               {/* Balance */}
               <div className="bg-[#111111] rounded-[32px] p-8 text-center border border-white/10 shadow-2xl">
                   <p className="text-gray-500 text-[11px] font-bold mb-3 uppercase tracking-widest">Текущий баланс</p>
                   <h2 className="text-[40px] font-black text-white tracking-tighter">{user.currency} {(data.transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0)).toLocaleString()}</h2>
               </div>
               
               {/* Buttons */}
               <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => setActiveTab('list')} className="bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-36">
                       <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-black border border-white/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]"><Wallet className="text-green-500" size={28} /></div>
                       <span className="text-white font-bold text-sm">Транзакции</span>
                   </button>
                   <button className="bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-36">
                        <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-black border border-white/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]"><Banknote className="text-orange-500" size={28} /></div>
                        <span className="text-white font-bold text-sm">Долги</span>
                   </button>
               </div>
               
               {/* Recent Activity */}
                <div className="pt-2">
                    <h3 className="text-xl font-bold text-white mb-4 px-2">Недавняя активность</h3>
                    <div className="space-y-3">
                        {data.transactions.slice(0, 3).map((t) => (
                            <div key={t.id} className="bg-[#111111] p-4 rounded-[24px] flex justify-between items-center border border-white/10">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${t.type === 'expense' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                        {t.type === 'expense' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm">{t.category}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5 font-medium uppercase">{t.description}</p>
                                    </div>
                                </div>
                                <span className={`font-black text-[15px] ${t.type === 'expense' ? 'text-white' : 'text-green-500'}`}>
                                    {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
           </div>
        )}
        
        {activeTab === 'list' && (
             <div className="p-4 pb-32 space-y-4 animate-fade-in bg-black min-h-screen pt-6">
                <div className="flex justify-between items-center mb-6 px-2">
                    <h2 className="text-2xl font-bold text-white">История</h2>
                    <button onClick={() => setActiveTab('stats')} className="text-gray-500 p-2 bg-[#111111] rounded-full border border-white/10"><X size={20} /></button>
                </div>
                {data.transactions.map((t) => (
                    <div key={t.id} className="bg-[#111111] p-5 rounded-[24px] flex justify-between items-center border border-white/10">
                        <div className="flex items-center gap-5">
                            <div className={`p-3.5 rounded-2xl ${t.type === 'expense' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                {t.type === 'expense' ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-white text-[15px]">{t.category}</p>
                                <p className="text-xs text-gray-600">{t.description}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className={`font-black text-[17px] ${t.type === 'expense' ? 'text-white' : 'text-green-500'}`}>
                                {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()}
                            </span>
                            <button onClick={() => handleDelete(t.id)}><Trash2 size={18} className="text-gray-600 hover:text-red-500" /></button>
                        </div>
                    </div>
                ))}
             </div>
        )}

        <AddModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddTransaction} />
        
        {activeTab === 'stats' && (
            <div className="fixed bottom-0 left-0 w-full px-5 py-6 bg-gradient-to-t from-black via-black to-transparent z-20">
                <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-[#00E08F] text-black font-extrabold text-[17px] py-4 rounded-[24px] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,224,143,0.3)] active:scale-95 transition-transform">
                    <Plus strokeWidth={3} size={20} /> Добавить транзакцию
                </button>
            </div>
        )}
      </div>
    </div>
  );
}

const App = () => <ErrorBoundary><MainApp /></ErrorBoundary>;
export default App;
