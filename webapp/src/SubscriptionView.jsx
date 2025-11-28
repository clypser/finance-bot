import React from 'react';
import { ChevronRight } from 'lucide-react';

const SubscriptionView = ({ onBack, user, onBuy }) => {
  return (
    <div className="p-5 pb-32 min-h-screen bg-black">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-[#111111] rounded-full text-white"><ChevronRight className="rotate-180" /></button>
        <h2 className="text-xl font-bold text-white">Подписка</h2>
      </div>

      <div className="bg-[#111111] rounded-2xl p-5 border border-white/10">
        <h3 className="text-white font-bold text-lg">Loomy AI Pro — 7 дней бесплатно</h3>
        <p className="text-gray-400 text-sm mt-2">Больше советов, неограниченный доступ к AI-фичам.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => onBuy('monthly')} className="bg-[#00E08F] text-black font-bold py-3 px-4 rounded">Купить месячно</button>
          <button onClick={() => onBuy('yearly')} className="bg-black border border-white/10 text-white py-3 px-4 rounded">Купить год</button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionView;
