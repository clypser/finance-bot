import React, { useState, useEffect } from 'react';
import { Wallet, PieChart as PieIcon, Plus, ArrowUpRight, ArrowDownLeft, Target, Crown, X, CreditCard, Banknote, BarChart3, ChevronRight, Trash2, User, LogOut, Star, Zap, CheckCircle, Sparkles, Loader2, HandCoins } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import AiAdviceCard from './AiAdviceCard';
import DebtsView from './DebtsView';
import ProfileView from './ProfileView';
import AddModal from './AddModal';
import SubscriptionView from './SubscriptionView';

const API_URL = 'https://loomybot.ru'; // <-- Вставь сюда URL API, например: 'http://localhost:3000'

// === СТИЛИ (можно оставить как есть) ===
const shimmerStyle = `
  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
  .animate-shimmer {
    background: linear-gradient(90deg, #FACC15 0%, #FEF08A 50%, #EAB308 100%);
    background-size: 200% 100%;
    animation: shimmer 3s infinite linear;
  }
`;

const EXPENSE_CATEGORIES = ['Продукты', 'Еда вне дома', 'Такси', 'Транспорт', 'Дом', 'ЖКУ', 'Связь', 'Здоровье', 'Красота', 'Спорт', 'Одежда', 'Техника', 'Развлечения', 'Подписки', 'Образование', 'Подарки', 'Кредиты', 'Прочее'];
const INCOME_CATEGORIES = ['Зарплата', 'Аванс', 'Премия', 'Стипендия', 'Фриланс', 'Бизнес', 'Дивиденды', 'Вклады', 'Кэшбэк', 'Подарки', 'Возврат долга', 'Прочее'];

const ErrorBoundary = ({ children }) => children;
const AiAdviceCardComponent = AiAdviceCard; // чтобы не ломать имя, если где-то используется

const DebtsViewComponent = DebtsView;
const ProfileViewComponent = ProfileView;

const MainApp = () => {
  const [view, setView] = useState('main');
  const [activeTab, setActiveTab] = useState('stats');
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState({ transactions: [], chartData: [], total: 0 });
  const [user, setUser] = useState({ currency: 'UZS', firstName: 'User', username: '', isPro: false });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [limitRemaining, setLimitRemaining] = useState(50);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#000000'); tg.setBackgroundColor('#000000'); fetchUser(); }
  }, []);

  const getTelegramUserId = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '123456789';
  
  const fetchUser = async () => {
      try {
          const userId = getTelegramUserId();
          const res = await fetch(`${API_URL}/user/me`, { headers: { 'x-telegram-id': userId } });
          if (res.ok) setUser(await res.json());
      } catch(e) {}
  };

  const fetchStats = async () => {
    try {
      const userId = getTelegramUserId();
      const res = await fetch(`${API_URL}/stats/${period}`, { headers: { 'x-telegram-id': userId } });
      if (res.ok) { const r = await res.json(); 
          // Защита: удостоверимся, что суммы - числа
          const normalizedTransactions = (r.transactions || []).map(t => ({ ...t, amount: typeof t.amount === 'number' ? t.amount : parseFloat(t.amount || 0) }));
          setData({ ...r, transactions: normalizedTransactions });
          setLimitRemaining(r.limitRemaining);
      }
    } catch (err) { console.error('fetchStats error', err); }
  };

  const handleGetAiAdvice = async () => {
      try {
          const userId = getTelegramUserId();
          const res = await fetch(`${API_URL}/ai/advice`, { headers: { 'x-telegram-id': userId } });
          if (res.ok) { const data = await res.json(); return data.advice; }
      } catch (e) { return "Связь с космосом потеряна :("; }
  };

  // Исправленная логика сохранения
  const handleSaveTransaction = async (formData) => {
      const userId = getTelegramUserId();

      // Если это долг - формируем payload строго для /debts
      if (formData.type === 'lent' || formData.type === 'borrowed') {
          const payload = {
              amount: parseFloat(formData.amount),
              personName: formData.personName || formData.category || 'Кто-то',
              type: formData.type
          };
          const url = formData.id ? `${API_URL}/debts/${formData.id}` : `${API_URL}/debts`;
          const method = formData.id ? 'PUT' : 'POST';
          await fetch(url, { method, headers: { 'x-telegram-id': userId, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
          // Обычная транзакция
          const payload = {
              amount: parseFloat(formData.amount),
              category: formData.category || 'Прочее',
              type: formData.type || 'expense',
              description: formData.description || ''
          };
          const endpoint = formData.id ? `${API_URL}/transaction/${formData.id}` : `${API_URL}/transaction/add`;
          const method = formData.id ? 'PUT' : 'POST';
          await fetch(endpoint, { method, headers: { 'x-telegram-id': userId, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }

      setIsAddModalOpen(false); fetchStats();
  };

  const handleDeleteTransaction = async (id) => {
      if(!window.confirm("Удалить?")) return;
      await fetch(`${API_URL}/transaction/${id}`, { method: 'DELETE', headers: { 'x-telegram-id': getTelegramUserId() } });
      fetchStats();
  };

  // API ACTIONS
  const handleBuyPro = async (planId) => { const userId = getTelegramUserId(); await fetch(`${API_URL}/payment/invoice`, { method: 'POST', headers: { 'x-telegram-id': userId, 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: planId }) }); window.Telegram?.WebApp?.close(); };
  const handleClearData = async () => { if(!window.confirm("Удалить ВСЁ?")) return; const userId = getTelegramUserId(); await fetch(`${API_URL}/transactions/clear`, { method: 'DELETE', headers: { 'x-telegram-id': userId } }); fetchStats(); alert("Очищено"); };
  const handleDeleteAccount = async () => { if(!window.confirm("Удалить аккаунт НАВСЕГДА?")) return; const userId = getTelegramUserId(); await fetch(`${API_URL}/user/delete`, { method: 'DELETE', headers: { 'x-telegram-id': userId } }); window.Telegram?.WebApp?.close(); };
  const handleCurrencyChange = async (newCurr) => {
      const userId = getTelegramUserId();
      setUser(prev => ({ ...prev, currency: newCurr }));
      await fetch(`${API_URL}/user/currency`, { method: 'POST', headers: { 'x-telegram-id': userId, 'Content-Type': 'application/json' }, body: JSON.stringify({ currency: newCurr }) });
      fetchStats();
  };

  useEffect(() => { if (view === 'main') fetchStats(); }, [activeTab, period, view]);

  if (view === 'debts') return <DebtsView onBack={() => setView('main')} currency={user.currency} user={user} />;
  if (view === 'subscription') return <SubscriptionView onBack={() => setView('profile')} user={user} onBuy={handleBuyPro} />;
  if (view === 'profile') return <ProfileView user={user} onBack={() => setView('main')} onOpenSub={() => setView('subscription')} onClearData={handleClearData} onDeleteAccount={handleDeleteAccount} onCurrencyChange={handleCurrencyChange} />;

  const displayBalance = (data.transactions || []).reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
  const displayExpense = (data.chartData || []).reduce((acc, c) => acc + c.value, 0);
  const displayIncome = (data.transactions || []).filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="min-h-screen font-sans bg-black text-white pb-28">
        <style>{shimmerStyle}</style>
        
        {activeTab === 'stats' && (
            <div className="p-5 pb-36 space-y-6 animate-fade-in">
               <div className="flex justify-between items-center pt-2 px-1">
                   <button className="text-gray-500 hover:text-white p-1" onClick={() => window.Telegram?.WebApp?.close()}><X size={24} /></button>
                   <h1 className="text-lg font-bold text-white tracking-wide">Loomy AI</h1>
                   <button onClick={() => setView('profile')} className="w-9 h-9 rounded-full bg-[#111111] flex items-center justify-center text-xs overflow-hidden border border-white/10 hover:border-white/30 transition-all">
                       {user.isPro ? <Crown size={16} className="text-[#00E08F]" fill="currentColor" /> : <User size={18} className="text-gray-400" />}
                   </button>
               </div>

               <div className="text-center mt-4 mb-6">
                   <h2 className="text-[32px] font-extrabold text-white mb-1 leading-tight">Привет, {user.firstName}!</h2>
                   <p className="text-gray-500 text-sm font-medium">Ваш умный трекер расходов</p>
               </div>

               {!user.isPro && (
                   <div className="relative overflow-hidden rounded-[32px] p-5 shadow-lg animate-shimmer cursor-pointer active:scale-95 transition-transform" onClick={() => setView('subscription')}>
                        <div className="relative z-10 flex items-center gap-4">
                           <div className="bg-white/25 p-2.5 rounded-2xl backdrop-blur-md border border-white/20"><Crown className="text-black" size={26} strokeWidth={2.5} /></div>
                           <div><h3 className="font-extrabold text-black text-[15px]">Loomy AI Pro — 7 дней бесплатно</h3><p className="text-black/70 text-[11px] font-bold mt-0.5 uppercase">Осталось записей: {limitRemaining}</p></div>
                       </div>
                   </div>
               )}

               <AiAdviceCard onGetAdvice={handleGetAiAdvice} />

               <div className="bg-[#111111] rounded-[32px] p-8 text-center border border-white/10 shadow-2xl">
                   <p className="text-gray-500 text-[11px] font-bold mb-3 uppercase tracking-widest">Текущий баланс</p>
                   <h2 className="text-[40px] font-black text-white tracking-tighter">{user.currency} {displayBalance.toLocaleString()}</h2>
               </div>
               
               <div className="bg-[#111111] rounded-[32px] p-6 border border-white/10">
                   <div className="flex justify-between items-center mb-4">
                        <p className="text-gray-500 text-[11px] font-bold uppercase">Сводка</p>
                        <div className="flex bg-black rounded-lg p-0.5 border border-white/5">
                            {['week', 'month'].map(p => (
                                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase ${period === p ? 'bg-white text-black' : 'text-gray-500'}`}>{p === 'week' ? 'Неделя' : 'Месяц'}</button>
                            ))}
                        </div>
                   </div>
                   <div className="flex justify-between items-start mb-2 px-2 relative">
                        <div className="text-center w-1/2 pr-4"><p className="text-xl font-bold text-white mb-1.5">-{displayExpense.toLocaleString()}</p><div className="text-red-500 text-[10px] font-black uppercase">Расходы</div></div>
                        <div className="text-center w-1/2 pl-4"><p className="text-xl font-bold text-white mb-1.5">+{displayIncome.toLocaleString()}</p><div className="text-green-500 text-[10px] font-black uppercase">Доходы</div></div>
                   </div>
               </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setActiveTab('list')} className="bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-36"><div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-black border border-white/5"><Wallet className="text-green-500" size={28} /></div><span className="text-white font-bold text-sm">Транзакции</span></button>
                    <button onClick={() => setView('debts')} className="bg-[#111111] rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 border border-white/10 active:bg-[#1a1a1a] transition-all h-36"><div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-black border border-white/5"><Banknote className="text-orange-500" size={28} /></div><span className="text-white font-bold text-sm">Долги</span></button>
                </div>
           </div>
        )}
        
        {activeTab === 'list' && (
             <div className="p-4 pb-32 space-y-4 animate-fade-in bg-black min-h-screen pt-6">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-white">История</h2><button onClick={() => setActiveTab('stats')} className="p-2 bg-[#111111] rounded-full"><X size={20} className="text-gray-500"/></button></div>
                {(data.transactions || []).map(t => (
                    <div key={t.id} onClick={() => { setEditingTransaction(t); setIsAddModalOpen(true); }} className="bg-[#111111] p-4 rounded-[24px] flex justify-between items-center border border-white/10">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${t.type === 'expense' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                            {t.type === 'expense' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{t.category || t.personName}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5 uppercase">{t.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2"><span className={`font-black text-[15px] ${t.type === 'expense' ? 'text-white' : 'text-green-500'}`}>{t.type === 'expense' ? '-' : '+'}{(t.amount || 0).toLocaleString()}</span><button onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(t.id); }}><Trash2 size={16} className="text-gray-600 hover:text-red-500"/></button></div>
                    </div>
                ))}
             </div>
        )}

        <AddModal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setEditingTransaction(null); }} onAdd={handleSaveTransaction} editingItem={editingTransaction} />
        
        {activeTab === 'stats' && <div className="fixed bottom-0 left-0 w-full px-5 py-6 bg-gradient-to-t from-black via-black to-transparent z-20"><button onClick={() => setIsAddModalOpen(true)} className="w-full bg-[#00E08F] text-black font-extrabold text-[17px] py-4 rounded-[24px] flex items-center justify-center gap-2"><Plus strokeWidth={3} size={20} /> Добавить транзакцию</button></div>}
    </div>
  );
}

const App = () => <ErrorBoundary><MainApp /></ErrorBoundary>;
export default App;
