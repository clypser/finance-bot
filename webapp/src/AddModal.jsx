import React, { useEffect, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories'; // optional; fallback handled below

// Если у тебя нет отдельного categories.js, не беда: ниже есть локальные списки
const EXP_CATS = ['Продукты','Еда вне дома','Такси','Транспорт','Дом','ЖКУ','Связь','Здоровье','Красота','Спорт','Одежда','Техника','Развлечения','Подписки','Образование','Подарки','Кредиты','Прочее'];
const INC_CATS = ['Зарплата','Аванс','Премия','Стипендия','Фриланс','Бизнес','Дивиденды','Вклады','Кэшбэк','Подарки','Возврат долга','Прочее'];

const AddModal = ({ isOpen, onClose, onAdd, editingItem }) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState(EXP_CATS[0]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      setAmount(editingItem.amount ?? '');
      setType(editingItem.type ?? 'expense');
      setDescription(editingItem.description ?? '');
      setCategory(editingItem.category ?? editingItem.personName ?? (editingItem.type === 'income' ? INC_CATS[0] : EXP_CATS[0]));
    } else {
      setAmount('');
      setType('expense');
      setCategory(EXP_CATS[0]);
      setDescription('');
    }
  }, [isOpen, editingItem]);

  const isDebt = type === 'lent' || type === 'borrowed';

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount) || 0;
    if (isDebt) {
      onAdd({ id: editingItem?.id, amount: parsedAmount, personName: category || 'Кто-то', type });
    } else {
      onAdd({ id: editingItem?.id, amount: parsedAmount, category: category || 'Прочее', type, description });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111111] w-full max-w-md rounded-2xl p-6 border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">{editingItem ? 'Редактировать' : 'Новая запись'}</h3>
          <button onClick={onClose}><X className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => setType('expense')} className={`col-span-2 py-2 rounded ${type==='expense' ? 'bg-white text-black' : 'bg-black text-gray-400 border border-white/10'}`}>Расход</button>
            <button type="button" onClick={() => setType('income')} className={`col-span-1 py-2 rounded ${type==='income' ? 'bg-white text-black' : 'bg-black text-gray-400 border border-white/10'}`}>Доход</button>
            <button type="button" onClick={() => setType('lent')} className={`col-span-1 py-2 rounded ${type==='lent' ? 'bg-red-500/20 text-red-500 border border-red-500' : 'bg-black text-gray-400 border border-white/10'}`}>Я занял</button>
          </div>

          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white text-2xl font-bold" required />

          {isDebt ? (
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Имя человека" className="w-full bg-black border border-white/10 rounded-xl p-3 text-white" required />
          ) : (
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white">
              {(type === 'income' ? INC_CATS : EXP_CATS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {!isDebt && <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Комментарий" className="w-full bg-black border border-white/10 rounded-xl p-3 text-white" />}

          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-[#00E08F] text-black font-bold py-3 rounded-xl">Сохранить</button>
            <button type="button" onClick={onClose} className="flex-1 bg-[#111111] border border-white/10 text-white py-3 rounded-xl">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddModal;
