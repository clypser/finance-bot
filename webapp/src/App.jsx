import React, { useState, useEffect } from 'react';

const API_URL = ''; // укажи здесь URL, например: 'https://api.example.com'

const EXPENSE_CATEGORIES = ['Продукты','Еда вне дома','Такси','Транспорт','Дом','ЖКУ','Связь','Здоровье','Красота','Спорт','Одежда','Техника','Развлечения','Подписки','Образование','Подарки','Кредиты','Прочее'];
const INCOME_CATEGORIES = ['Зарплата','Аванс','Премия','Стипендия','Фриланс','Бизнес','Дивиденды','Вклады','Кэшбэк','Подарки','Возврат долга','Прочее'];

function AddModal({ isOpen, onClose, onAdd, editingItem }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      setAmount(editingItem.amount || '');
      setType(editingItem.type || 'expense');
      setCategory(editingItem.personName || editingItem.category || (editingItem.type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]));
      setDescription(editingItem.description || '');
    } else {
      setAmount(''); setType('expense'); setCategory(EXPENSE_CATEGORIES[0]); setDescription('');
    }
  }, [isOpen, editingItem]);

  const isDebt = type === 'lent' || type === 'borrowed';

  const handleSubmit = (e) => {
    e.preventDefault();
    // Подготовим полезную нагрузку так, чтобы backend получил personName для долгов
    const payload = {
      id: editingItem?.id,
      amount: parseFloat(amount) || 0,
      type,
      personName: isDebt ? (category || 'Кто-то') : null,
      category: isDebt ? null : (category || 'Прочее'),
      description: isDebt ? null : (description || '')
    };
    onAdd(payload);
  };

  if (!isOpen) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
      <div style={{width:360,background:'#111',padding:20,borderRadius:18}}>
        <h3 style={{color:'#fff'}}>Новая запись</h3>
        <form onSubmit={handleSubmit}>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <button type='button' onClick={() => setType('expense')}>Расход</button>
            <button type='button' onClick={() => setType('income')}>Доход</button>
            <button type='button' onClick={() => setType('lent')}>Я занял</button>
            <button type='button' onClick={() => setType('borrowed')}>Мне должны</button>
          </div>
          <input type='number' value={amount} onChange={e=>setAmount(e.target.value)} required style={{width:'100%',padding:12,borderRadius:8,marginBottom:8}} />
          {isDebt ? (
            <input type='text' value={category} onChange={e=>setCategory(e.target.value)} placeholder='Имя' required style={{width:'100%',padding:12,borderRadius:8,marginBottom:8}} />
          ) : (
            <select value={category} onChange={e=>setCategory(e.target.value)} style={{width:'100%',padding:12,borderRadius:8,marginBottom:8}}>
              {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {!isDebt && <input type='text' value={description} onChange={e=>setDescription(e.target.value)} placeholder='Комментарий' style={{width:'100%',padding:12,borderRadius:8,marginBottom:8}} />}
          <div style={{display:'flex',gap:8}}>
            <button type='submit' style={{flex:1,background:'#0f0',padding:12,borderRadius:10}}>Сохранить</button>
            <button type='button' onClick={onClose} style={{flex:1,background:'#222',padding:12,borderRadius:10}}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DebtsView({ onBack, userCurrency }) {
  const [debts, setDebts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchDebts = async () => {
    try {
      const res = await fetch(`${API_URL}/debts`, { headers: { 'x-telegram-id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id } });
      if (res.ok) setDebts(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchDebts(); }, []);

  const handleSave = async (data) => {
    try {
      const url = data.id ? `${API_URL}/debts/${data.id}` : `${API_URL}/debts`;
      const method = data.id ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'x-telegram-id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      setIsModalOpen(false); fetchDebts();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => { if (!window.confirm('Удалить?')) return; await fetch(`${API_URL}/debts/${id}`, { method: 'DELETE', headers: { 'x-telegram-id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id } }); fetchDebts(); };

  return (
    <div style={{padding:16}}>
      <button onClick={onBack}>Назад</button>
      <h2>Долги</h2>
      {debts.length === 0 ? <div>Долги не найдены</div> : debts.map(d => (
        <div key={d.id} style={{background:'#222',padding:12,borderRadius:10,marginBottom:8}} onClick={() => { setEditing(d); setIsModalOpen(true); }}>
          <div style={{display:'flex',justifyContent:'space-between'}}><b>{d.personName}</b><span>{d.amount} {d.currency || userCurrency}</span></div>
        </div>
      ))}
      <button onClick={() => { setEditing(null); setIsModalOpen(true); }}>Добавить долг</button>

      <AddModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={(payload) => {
        // Приведём payload к формату /debts ожидает: { amount, personName, type }
        const body = { amount: payload.amount, personName: payload.personName, type: payload.type || 'lent' };
        handleSave(body);
      }} editingItem={editing} />
    </div>
  );
}

export default function App(){
  const [view, setView] = useState('main');
  const [transactions, setTransactions] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats/month`, { headers: { 'x-telegram-id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id } });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleAddTransaction = async (payload) => {
    try {
      // Если это долг — POST /debts, иначе /transaction/add
      if (payload.type === 'lent' || payload.type === 'borrowed' || payload.personName) {
        await fetch(`${API_URL}/debts`, { method: 'POST', headers: { 'x-telegram-id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: payload.amount, personName: payload.personName, type: payload.type }) });
      } else {
        await fetch(`${API_URL}/transaction/add`, { method: 'POST', headers: { 'x-telegram-id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: payload.amount, type: payload.type, category: payload.category, description: payload.description }) });
      }
      setIsAddOpen(false); fetchStats();
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{background:'#000',minHeight:'100vh',color:'#fff'}}>
      <header style={{padding:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}><h1>Loomy AI</h1><div><button onClick={() => setView('main')}>Главная</button><button onClick={() => setView('debts')}>Долги</button></div></header>
      {view === 'main' && (
        <main style={{padding:16}}>
          <h2>Баланс</h2>
          <div style={{marginBottom:12}}>
            <button onClick={() => setIsAddOpen(true)}>Добавить транзакцию</button>
          </div>
          <section>
            {transactions.map(t => (
              <div key={t.id} style={{background:'#111',padding:12,borderRadius:10,marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <div><b>{t.category || t.personName}</b><div style={{fontSize:12,color:'#aaa'}}>{t.description}</div></div>
                  <div>{t.type === 'expense' ? '-' : '+'}{t.amount} {t.currency}</div>
                </div>
              </div>
            ))}
          </section>
        </main>
      )}

      {view === 'debts' && <DebtsView onBack={() => setView('main')} userCurrency={'UZS'} />}

      <AddModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onAdd={handleAddTransaction} />
    </div>
  );
}
