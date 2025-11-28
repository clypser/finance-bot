import React from 'react';
import { ChevronRight, CreditCard, Banknote, Trash2, LogOut } from 'lucide-react';

const ProfileView = ({ user, onBack, onOpenSub, onClearData, onDeleteAccount, onCurrencyChange }) => {
  const currencies = ['UZS', 'USD', 'RUB', 'KZT', 'EUR'];
  return (
    <div className="p-5 pb-32 font-sans min-h-screen bg-black">
      <div className="flex items-center gap-4 mb-6"><button onClick={onBack} className="p-2 bg-[#111111] rounded-full text-white"><ChevronRight className="rotate-180" /></button><h2 className="text-xl font-bold text-white">Профиль</h2></div>
      <div className="bg-[#111111] p-5 rounded-[24px] border border-white/10 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-2xl">😎</div>
          <div>
            <h3 className="text-white font-bold text-lg">{user.firstName}</h3>
            <p className="text-gray-500 text-sm">@{user.username}</p>
          </div>
        </div>
        <div onClick={onOpenSub} className="cursor-pointer bg-green-500/10 text-green-500 px-3 py-1.5 rounded-full text-xs font-bold border border-green-500/20">{user.isPro ? 'PRO' : 'FREE'}</div>
      </div>

      <div className="bg-[#111111] rounded-[24px] border border-white/10 overflow-hidden mb-6">
        <div onClick={onOpenSub} className="p-4 flex justify-between items-center border-b border-white/5 cursor-pointer">
          <div className="flex items-center gap-3"><CreditCard size={20} className="text-[#00E08F]" /><span className="text-white font-bold">Управление подпиской</span></div>
          <ChevronRight className="text-gray-600" size={20} />
        </div>
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3"><Banknote size={20} className="text-gray-400" /><span className="text-white font-medium">Валюта</span></div>
          <select value={user.currency} onChange={(e) => onCurrencyChange(e.target.value)} className="bg-black text-white text-sm p-1 rounded border border-white/20 outline-none">
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <button onClick={onClearData} className="w-full bg-[#111111] border border-white/10 text-white font-bold py-4 rounded-[20px]"><Trash2 size={18} /> Очистить все транзакции</button>
        <button onClick={onDeleteAccount} className="w-full bg-red-600/10 border border-red-600/30 text-red-500 font-bold py-4 rounded-[20px] flex items-center justify-center gap-2"><LogOut size={18} /> Удалить аккаунт</button>
      </div>
    </div>
  );
};

export default ProfileView;
