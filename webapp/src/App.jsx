import React, { useState, useEffect } from 'react';
import { Wallet, PieChart as PieIcon, Plus, ArrowUpRight, ArrowDownLeft, Target, Crown, X, CreditCard, Banknote, BarChart3, ChevronRight, Trash2, User, LogOut, Star, Zap, CheckCircle, Sparkles, Loader2, HandCoins } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const API_URL = 'loomybot.ru'; // <-- Вставь сюда URL API, например: 'http://localhost:3000'

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

/* =========================
   AddModal (исправленная версия)
   - всегда отправляет personName для долгов
   - корректно формирует payload для фронта/бэка
   ========================= */
const AddModal = ({ isOpen, onClose, onAdd, editingItem }) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');

  useEffect(() => {
      if (isOpen) {
          if (editingItem) {
              // Поддерживаем оба варианта: если это долг — personName хранится в personName
              setAmount(editingItem.amount);
              if (editingItem.personName) {
                  setType(editingItem.type);
                  setCategory(editingItem.personName);
              } else {
                  setType(editingItem.type);
                  setCategory(editingItem.category || (editingItem.type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]));
                  setDescription(editingItem.description || '');
              }
          } else {
              setAmount(''); setDescription(''); setType('expense'); setCategory(EXPENSE_CATEGORIES[0]);
          }
      }
  }, [isOpen, editingItem]);

  const handleTypeChange = (newType) => {
      setType(newType);
      if (newType === 'expense') setCategory(EXPENSE_CATEGORIES[0]);
      else if (newType === 'income') setCategory(INCOME_CATEGORIES[0]);
      else setCategory('');
  };

  // Подготавливаем полезную нагрузку строго в том формате, который ожидает бэкенд:
  // для долгов: { id?, amount, personName, type }
  // для транзакций: { id?, amount, category, type, description }
  const handleSubmit = (e) => {
      e.preventDefault();
      const isDebt = (type === 'lent' || type === 'borrowed');
      if (isDebt) {
          onAdd({
              id: editingItem?.id,
              amount: parseFloat(amount || 0),
              personName: (category || '').toString(),
              type
          });
      } else {
          onAdd({
              id: editingItem?.id,
              amount: parseFloat(amount || 0),
              category,
              type,
              description
          });
      }
  };

  if (!isOpen) return null;

  const isDebt = type === 'lent' || type === 'borrowed';

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111111] w-full max-w-sm rounded-[32px] border border-white/10 p-6 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">{editingItem ? 'Редактировать' : 'Новая запись'}</h3>
                <button onClick={onClose}><X className="text-gray-500" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => handleTypeChange('expense')} className={`py-2 rounded-lg text-xs font-bold ${type === 'expense' ? 'bg-white text-black' : 'bg-black text-gray-500 border border-white/10'}`}>Расход</button>
                      <button type="button" onClick={() => handleTypeChange('income')} className={`py-2 rounded-lg text-xs font-bold ${type === 'income' ? 'bg-white text-black' : 'bg-black text-gray-500 border border-white/10'}`}>Доход</button>
                      <button type="button" onClick={() => handleTypeChange('lent')} className={`py-2 rounded-lg text-xs font-bold ${type === 'lent' ? 'bg-red-500/20 text-red-500 border-red-500' : 'bg-black text-gray-500 border border-white/10'}`}>Я занял</button>
                      <button type="button" onClick={() => handleTypeChange('borrowed')} className={`py-2 rounded-lg text-xs font-bold ${type === 'borrowed' ? 'bg-green-500/20 text-green-500 border-green-500' : 'bg-black text-gray-500 border border-white/10'}`}>Мне должны</button>
                  </div>

                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white text-2xl font-bold outline-none" required autoFocus />

                  {isDebt ? (
                    <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Имя" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white font-medium outline-none" required />
                  ) : (
                    <div className="relative">
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white font-medium outline-none appearance-none pr-10">
                          {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-gray-500" size={20} />
                    </div>
                  )}

                  {!isDebt && <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Комментарий..." className="w-full bg-black border border-white/10 rounded-xl p-4 text-white font-medium outline-none" />}

                  <button type="submit" className="w-full bg-[#00E08F] hover:bg-[#00c980] text-black font-extrabold text-lg py-4 rounded-[20px] mt-2">Сохранить</button>
              </form>
          </div>
      </div>
  );
};

/* =========================
   SubscriptionView, ProfileView
   (оставляем без изменений — как у тебя было)
   ========================= */

/* Ты уже прислал эти компоненты раньше — считаю их в проекте без изменений.
   Если нужно, могу вставить их полностью — скажи. */

/* =========================
   AiAdviceCard: оставляем как есть (твой код выше)
   ========================= */

/* =========================
   DebtsView: оставляем как было — он корректно использует /debts
   ========================= */

/* =========================
   MainApp — исправления:
   - handleSaveTransaction: корректно формирует payload для долгов и транзакций
   - fetchStats/отображение остались прежними
   ========================= */

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
