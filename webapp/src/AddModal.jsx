import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Продукты','Еда вне дома','Такси','Транспорт','Дом','ЖКУ','Связь','Здоровье',
  'Красота','Спорт','Одежда','Техника','Развлечения','Подписки','Образование',
  'Подарки','Кредиты','Прочее'
];

const INCOME_CATEGORIES = [
  'Зарплата','Аванс','Премия','Стипендия','Фриланс','Бизнес','Дивиденды',
  'Вклады','Кэшбэк','Подарки','Возврат долга','Прочее'
];

export default function AddModal({ isOpen, onClose, onAdd, editingItem }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (editingItem) {
      setAmount(editingItem.amount);
      setType(editingItem.type);
      setCategory(editingItem.category);
      setDescription(editingItem.description);
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onAdd({
      id: editingItem?.id,
      amount: Number(amount),
      type,
      category,
      description
    });
  };

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
      <div className="bg-[#111111] w-full p-6 rounded-t-[32px] border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-xl font-bold">
            {editingItem ? 'Редактировать' : 'Добавить транзакцию'}
          </h2>
          <button onClick={onClose} className="text-gray-400">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="number"
            placeholder="Сумма"
            className="w-full p-3 bg-black text-white rounded-xl border border-white/10"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <select
            className="w-full p-3 bg-black text-white rounded-xl border border-white/10"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
          </select>

          <select
            className="w-full p-3 bg-black text-white rounded-xl border border-white/10"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Категория</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Описание (необязательно)"
            className="w-full p-3 bg-black text-white rounded-xl border border-white/10"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          className="w-full mt-6 bg-[#00E08F] text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-
