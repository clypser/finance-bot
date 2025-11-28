import React, { useState } from 'react';
import { Sparkles, X, Loader2, ChevronRight } from 'lucide-react';

const AiAdviceCard = ({ onGetAdvice }) => {
    const [advice, setAdvice] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleGetAdvice = async () => {
        setLoading(true);
        try {
            const text = await onGetAdvice();
            setAdvice(text);
        } finally {
            setLoading(false);
        }
    };

    if (advice) {
        return (
            <div className="bg-gradient-to-br from-indigo-900/80 to-purple-900/80 p-5 rounded-[28px] border border-indigo-500/30 shadow-lg mb-4 relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                        <Sparkles size={14} /> Совет от Loomy
                    </div>
                    <button onClick={() => setAdvice(null)} className="text-indigo-300/50 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
                <p className="text-white text-sm leading-relaxed font-medium">{advice}</p>
            </div>
        );
    }

    return (
        <div
            onClick={handleGetAdvice}
            className="bg-[#111111] p-4 rounded-[24px] border border-white/10 mb-4 flex items-center justify-between cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all"
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    {loading ? <Loader2 className="text-white animate-spin" size={20} /> : <Sparkles className="text-white" size={20} />}
                </div>
                <div>
                    <p className="text-white font-bold text-sm">Получить фин. совет</p>
                    <p className="text-gray-500 text-[10px]">AI проанализирует ваши траты</p>
                </div>
            </div>
            <ChevronRight className="text-gray-600" size={20} />
        </div>
    );
};

export default AiAdviceCard;
