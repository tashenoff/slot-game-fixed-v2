import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SlotMachine } from '../game/SlotMachine';
import * as API from '../api';
import { Stats } from '../types';

const SlotGame: React.FC = () => {
  const slotContainerRef = useRef<HTMLDivElement>(null);
  const [slotMachine, setSlotMachine] = useState<SlotMachine | null>(null);
  const [balance, setBalance] = useState<number>(1000);
  const [bet, setBet] = useState<number>(1);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winAmount, setWinAmount] = useState<number>(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [isProcessingMultiSpin, setIsProcessingMultiSpin] = useState<boolean>(false);
  const [multiSpinProgress, setMultiSpinProgress] = useState<number>(0);

  // Инициализация слот-машины
  useEffect(() => {
    const initSlotMachine = async () => {
      if (slotContainerRef.current) {
        // Очищаем контейнер перед созданием нового экземпляра слот-машины
        if (slotContainerRef.current.firstChild) {
          while (slotContainerRef.current.firstChild) {
            slotContainerRef.current.removeChild(slotContainerRef.current.firstChild);
          }
        }
        
        // Уничтожаем предыдущий экземпляр, если он существует
        if (slotMachine) {
          slotMachine.destroy();
        }
        
        // Создаем экземпляр слот-машины
        const machine = new SlotMachine();
        machine.init(slotContainerRef.current);
        setSlotMachine(machine);

        // Получаем начальный баланс
        try {
          const initialBalance = await API.fetchBalance();
          setBalance(initialBalance);
        } catch (error) {
          console.error('Failed to fetch initial balance:', error);
        }
      }
    };

    initSlotMachine();

    // Очистка при размонтировании
    return () => {
      if (slotMachine) {
        slotMachine.destroy();
      }
    };
  }, []); // Пустой массив зависимостей для выполнения только при монтировании

  // Обработчик спина
  const handleSpin = useCallback(async () => {
    if (!slotMachine || isSpinning || balance < bet) return;

    setIsSpinning(true);
    setWinAmount(0);
    setShowStats(false);

    try {
      // Запрашиваем результат спина с сервера
      const result = await API.spin(bet);
      
      // Устанавливаем результат в слот-машину
      slotMachine.setSpinResult(result);
      
      // Запускаем анимацию вращения
      slotMachine.spin((spinResult) => {
        // Колбэк после завершения анимации
        setBalance(spinResult.balance);
        setWinAmount(spinResult.win_amount);
        setIsSpinning(false); // Важно: разблокируем кнопку
      });
    } catch (error) {
      console.error('Spin failed:', error);
      setIsSpinning(false); // Разблокируем кнопку в случае ошибки
    }
  }, [slotMachine, isSpinning, balance, bet]);

  // Обработчик 1000 спинов
  const handleMultiSpin = useCallback(async () => {
    if (!slotMachine || isSpinning || balance < bet) return;

    setIsSpinning(true);
    setIsProcessingMultiSpin(true);
    setWinAmount(0);
    setMultiSpinProgress(0);

    try {
      // Запрашиваем результат 1000 спинов с сервера
      const result = await API.multiSpin(bet);
      
      // Обновляем баланс и статистику
      setBalance(result.balance);
      setStats(result.stats);
      setShowStats(true);
      
      // Имитируем прогресс для UI
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        setMultiSpinProgress(Math.min(progress, 100));
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          setIsProcessingMultiSpin(false);
          setIsSpinning(false); // Разблокируем кнопку после завершения
        }
      }, 50);
    } catch (error) {
      console.error('Multi-spin failed:', error);
      setIsProcessingMultiSpin(false);
      setIsSpinning(false); // Разблокируем кнопку в случае ошибки
    }
  }, [slotMachine, isSpinning, balance, bet]);

  // Обработчик изменения ставки
  const handleBetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newBet = parseInt(e.target.value);
    if (!isNaN(newBet) && newBet > 0 && newBet <= balance) {
      setBet(newBet);
    }
  }, [balance]);

  // Обработчик сброса баланса
  const handleResetBalance = useCallback(async () => {
    try {
      const newBalance = await API.resetBalance();
      setBalance(newBalance);
      setWinAmount(0); // Сбрасываем выигрыш при сбросе баланса
    } catch (error) {
      console.error('Failed to reset balance:', error);
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-6">Слот-машина 5x3</h1>
      
      {/* Информация о балансе и ставке */}
      <div className="flex justify-between mb-4">
        <div className="text-xl">
          <span className="font-bold">Баланс:</span> {balance}
        </div>
        <div className="text-xl">
          <span className="font-bold">Ставка:</span>
          <input
            type="number"
            min="1"
            max={balance}
            value={bet}
            onChange={handleBetChange}
            disabled={isSpinning}
            className="ml-2 w-20 px-2 py-1 text-black rounded"
          />
        </div>
        {winAmount > 0 && (
          <div className="text-xl text-green-500">
            <span className="font-bold">Выигрыш:</span> {winAmount}
          </div>
        )}
      </div>
      
      {/* Контейнер для слот-машины */}
      <div className="slot-container mb-6" ref={slotContainerRef}></div>
      
      {/* Кнопки управления */}
      <div className="controls">
        <button
          className="btn btn-primary"
          onClick={handleSpin}
          disabled={isSpinning || balance < bet}
        >
          {isSpinning && !isProcessingMultiSpin ? 'Вращение...' : 'Спин'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleMultiSpin}
          disabled={isSpinning || balance < bet}
        >
          {isProcessingMultiSpin ? `Обработка... ${multiSpinProgress}%` : '1000 спинов'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleResetBalance}
          disabled={isSpinning}
        >
          Сбросить баланс
        </button>
      </div>
      
      {/* Статистика после 1000 спинов */}
      {showStats && stats && (
        <div className="stats-container mt-6">
          <h2 className="text-2xl font-bold mb-4">Статистика 1000 спинов</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><span className="font-bold">Всего ставок:</span> {stats.total_bet}</p>
              <p><span className="font-bold">Всего выигрышей:</span> {stats.total_win}</p>
              <p><span className="font-bold">Количество спинов:</span> {stats.spins}</p>
              <p><span className="font-bold">Частота выигрышей:</span> {(stats.win_frequency * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p><span className="font-bold">Самый большой выигрыш:</span> {stats.biggest_win}</p>
              <p><span className="font-bold">RTP:</span> {(stats.rtp * 100).toFixed(2)}%</p>
              <p><span className="font-bold">Баланс после тестов:</span> {stats.balance}</p>
            </div>
          </div>
          
          <h3 className="text-xl font-bold mt-4 mb-2">Частота символов</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(stats.symbol_frequency).map(([symbol, frequency]) => (
              <div key={symbol} className="bg-gray-800 p-2 rounded">
                <p><span className="font-bold">{symbol}:</span> {frequency}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotGame;
