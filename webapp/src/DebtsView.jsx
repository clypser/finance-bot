import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Trash2, ChevronRight, X, CheckCircle } from 'lucide-react';
import AddModal from './AddModal';

const DebtsView = ({ user, onBack, currency }) => {
  const [debts, setDebts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => { fetchDebts(); }, []);

  const getId = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '123456';

  const fetchDebts = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/debts`, { headers: { 'x-telegram-id': getId() }});
      if (res.ok) {
        const data = await res.json();
        // normalize amounts just in case
        setDebts((data || []).map(d=> ({ ...d, amount: typeof d.amount === 'number' ? d.amount : parseFloat(d.amount || 0) })));
      }
    } catch (e) {
      // ignore
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm('Удалить?')) return;
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ''}/debts/${id}`, { method: 'DELETE', headers: { 'x-telegram-id': getId() } });
      fetchDebts();
    } catch(e){}
  };

  const handleSave = async (data) => {
    try {
      const url = data.id ? `${process.env.REACT_APP_API_URL || ''}/debts/${data.id}` : `${process.env.REACT_APP_API_URL || ''}/debts`;
      const method = data.id ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'x-telegram-id': getId(), 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      setIsModalOpen(false);
      setEditingItem(null);
      fetchDebts();
    } catch(e){}
  };

  const filtered = debts.filter(d => filter === 'all' || d.type === filter);
  const totalLent = debts.filter(d=>d.type==='lent').reduce((s,d)=>s+(d.amount||0),0);
  const totalBorrowed = debts.filter(d=>d.type==='borrowed').reduce((s,d)=>s+(d.amount||0),0);

  return (
    <div className="p-5 pb-32 font-sans min-h-screen bg-black">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-[#111111] rounded-full text-white"><ChevronRight className="rotate-180" /></button>
        <h2 className="text-xl font-bold text-white">Долги</h2>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 bg-[#111111] p-4 rounded-[24px] border border-white/10">
          <p className="text-red-500 text-xs font-bold mb-1 flex items-center gap-1"><ArrowDownLeft size={12}/> Я занял(а)</p>
          <p className="text-red-500 text-lg font-black">{totalLent.toLocaleString()} <span className="text-xs">{currency}</span></p>
        </div>
        <div className="flex-1 bg-[#111111] p-4 rounded-[24px] border border-white/10">
          <p className="text-green-500 text-xs font-bold mb-1 flex items-center gap-1"><ArrowUpRight size={12}/> Мне должны</p>
          <p className="text-green-500 text-lg font-black">{totalBorrowed.toLocaleString()} <span className="text-xs">{currency}</span></p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[['all','Все'],['lent','Я занял(а)'],['borrowed','Мне должны']].map(([k,label])=>(
          <button key={k} onClick={()=>setFilter(k)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${filter===k ? 'bg-[#00E08F] text-black' : 'bg-[#111111] text-gray-500 border border-white/10'}`}>{label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length===0 ? (
          <div className="bg-[#111111] p-8 rounded-[32px] flex flex-col items-center justify-center text-center border border-white/5">
            <div className="bg-black p-4 rounded-full mb-3"><CheckCircle className="text-gray-600" size={32} /></div>
            <p className="text-white font-bold">Долги не найдены</p>
          </div>
        ) : filtered.map(d=>(
          <div key={d.id} onClick={()=>{ setEditingItem(d); setIsModalOpen(true); }} className="bg-[#111111] p-5 rounded-[24px] flex justify-between items-center border border-white/10">
            <div>
              <p className="text-white font-bold">{d.personName}</p>
              <p className="text-gray-400 text-sm">{d.note || ''}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-white font-bold">{(d.amount||0).toLocaleString()} {currency}</p>
              <button onClick={(e)=>{ e.stopPropagation(); handleDelete(d.id); }} className="text-gray-600 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <AddModal isOpen={isModalOpen} onClose={()=>{ setIsModalOpen(false); setEditingItem(null); }} onAdd={handleSave} editingItem={editingItem} />

      <div className="fixed bottom-0 left-0 w-full px-5 py-6 bg-gradient-to-t from-black via-black to-transparent z-20">
        <button onClick={()=>{ setEditingItem(null); setIsModalOpen(true); }} className="w-full bg-[#00E08F] text-black font-extrabold text-[17px] py-4 rounded-[24px] flex items-center justify-center gap-2">Добавить долг</button>
      </div>
    </div>
  );
};

export default DebtsView;
