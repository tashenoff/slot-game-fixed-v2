import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SlotMachine } from '../game/SlotMachine';
import Navbar from './Navbar';
import Modal from './Modal';
import LowBalanceModal from './LowBalanceModal';
import * as API from '../api';
import { Stats } from '../types';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { SlotTheme, getBackgroundAssetPath, getMusicAssetPath, getDefaultMusicPath } from '../config/themes';
import { SandEffect } from '../game/SandEffect';

const AUTO_SPIN_OPTIONS = [10, 25, 50, 100];
const LOW_BALANCE_THRESHOLD = 300; // Порог для показа модалки с рекламой

interface PlayerInfo {
  name?: string;
  avatar?: string;
}

interface SlotGameProps {
  initialBalance?: number;
  player?: PlayerInfo;
  theme: SlotTheme;
  onBackToLobby?: () => void;
  onBalanceChange?: (balance: number) => void;
}

const SlotGame: React.FC<SlotGameProps> = ({ 
  initialBalance = 10000, 
  player, 
  theme,
  onBackToLobby,
  onBalanceChange,
}) => {
  const slotContainerRef = useRef<HTMLDivElement>(null);
  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const stopSoundRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const eSoundRef = useRef<HTMLAudioElement | null>(null);
  const cSoundRef = useRef<HTMLAudioElement | null>(null);
  const bSoundRef = useRef<HTMLAudioElement | null>(null);
  const fSoundRef = useRef<HTMLAudioElement | null>(null);
  const barabanSoundRef = useRef<HTMLAudioElement | null>(null);
  const musicFadeTimerRef = useRef<number | null>(null);
  const musicFadeIntervalRef = useRef<number | null>(null);
  const [isMusicOn, setIsMusicOn] = useState<boolean>(true);
  const [slotMachine, setSlotMachine] = useState<SlotMachine | null>(null);
  const [balance, setBalance] = useState<number>(initialBalance);
  const [bet, setBet] = useState<number>(100);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winAmount, setWinAmount] = useState<number>(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showLowBalanceModal, setShowLowBalanceModal] = useState<boolean>(false);
  const [isProcessingMultiSpin, setIsProcessingMultiSpin] = useState<boolean>(false);
  const [multiSpinProgress, setMultiSpinProgress] = useState<number>(0);
  const [isSlotLoading, setIsSlotLoading] = useState<boolean>(true); // Состояние загрузки слот-машины
  const lowBalanceShownRef = useRef<boolean>(false); // Чтобы не показывать модалку повторно
  const sandEffectRef = useRef<SandEffect | null>(null);
  const sandContainerRef = useRef<HTMLDivElement>(null);
  
  // Состояния автоспина
  const [isAutoSpin, setIsAutoSpin] = useState<boolean>(false);
  const [autoSpinCount, setAutoSpinCount] = useState<number>(0);
  const [showAutoSpinMenu, setShowAutoSpinMenu] = useState<boolean>(false);
  const autoSpinRef = useRef<boolean>(false); // Для отслеживания состояния автоспина в колбэках
  const betRef = useRef<number>(bet); // Для хранения текущей ставки в колбэках
  const balanceRef = useRef<number>(balance); // Для хранения актуального баланса
  const isSpinningRef = useRef<boolean>(false); // Для защиты от двойного вызова
  
  // История спинов для отладки
  interface SpinHistoryItem {
    spinNumber: number;
    bet: number;
    win: number;
    balanceBefore: number;
    balanceAfter: number;
  }
  const [spinHistory, setSpinHistory] = useState<SpinHistoryItem[]>([]);
  const spinCounterRef = useRef<number>(0);
  
  // FPS для отображения в навбаре
  const [fps, setFps] = useState<number>(60);
  const fpsTickerRef = useRef<(() => void) | null>(null);

  // Анимированное значение выигрыша (от 0 до суммы)
  const animatedWinAmount = useAnimatedNumber(winAmount, 800);
  
  // Состояние для показа выигрыша в мобильной панели (переключение баланс/выигрыш)
  const [showWinDisplay, setShowWinDisplay] = useState<boolean>(false);
  const winDisplayTimerRef = useRef<number | null>(null);
  
  // Эффект для автоматического переключения на баланс после показа выигрыша
  useEffect(() => {
    if (winAmount > 0) {
      // Показываем выигрыш
      setShowWinDisplay(true);
      
      // Очищаем предыдущий таймер
      if (winDisplayTimerRef.current) {
        clearTimeout(winDisplayTimerRef.current);
      }
      
      // Возвращаемся к балансу через 3 секунды
      winDisplayTimerRef.current = window.setTimeout(() => {
        setShowWinDisplay(false);
      }, 3000);
    } else {
      setShowWinDisplay(false);
    }
    
    return () => {
      if (winDisplayTimerRef.current) {
        clearTimeout(winDisplayTimerRef.current);
      }
    };
  }, [winAmount]);
  
  // Обновляем refs при изменении значений
  useEffect(() => {
    betRef.current = bet;
  }, [bet]);
  
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // Отслеживаем низкий баланс и показываем модалку с рекламой
  useEffect(() => {
    // Показываем модалку только если:
    // 1. Баланс <= порога (включая 0)
    // 2. Модалка ещё не была показана в этой сессии (или баланс восстановился)
    // 3. Не идёт спин и не идёт автоспин
    if (
      balance <= LOW_BALANCE_THRESHOLD &&
      balance >= 0 &&
      !lowBalanceShownRef.current &&
      !isSpinning &&
      !isAutoSpin
    ) {
      setShowLowBalanceModal(true);
      lowBalanceShownRef.current = true;
    }
    
    // Сбрасываем флаг если баланс восстановился выше порога
    if (balance > LOW_BALANCE_THRESHOLD * 2) {
      lowBalanceShownRef.current = false;
    }
  }, [balance, isSpinning, isAutoSpin]);

  // Хелпер для обновления баланса с синхронизацией в лобби
  const updateBalance = useCallback((newBalance: number) => {
    setBalance(newBalance);
    balanceRef.current = newBalance;
    onBalanceChange?.(newBalance);
  }, [onBalanceChange]);

  // Обработчик получения награды за рекламу
  const handleAdReward = useCallback(async (amount: number) => {
    try {
      const result = await API.claimAdReward();
      updateBalance(result.balance);
      console.log(`[SlotGame] Получена награда за рекламу: ${result.reward} монет, баланс: ${result.balance}`);
    } catch (error) {
      console.error('[SlotGame] Ошибка получения награды:', error);
      // В случае ошибки всё равно добавляем локально (на случай проблем с сетью)
      const newBalance = balance + amount;
      updateBalance(newBalance);
    }
  }, [balance, updateBalance]);

  // Инициализация слот-машины
  useEffect(() => {
    const initSlotMachine = async () => {
      if (slotContainerRef.current) {
        // Показываем индикатор загрузки
        setIsSlotLoading(true);
        
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
        
        // Создаем экземпляр слот-машины с темой
        const machine = new SlotMachine(theme);
        await machine.init(slotContainerRef.current);
        
        // Устанавливаем колбэк для звука остановки каждого барабана
        machine.setReelStopCallback(() => {
          if (stopSoundRef.current) {
            // Клонируем звук для одновременного воспроизведения нескольких
            const sound = stopSoundRef.current.cloneNode() as HTMLAudioElement;
            sound.play().catch(err => console.log('Audio play error:', err));
          }
        });
        
        setSlotMachine(machine);
        
        // Подписываемся на обновление FPS (раз в 500мс для снижения нагрузки)
        const ticker = machine.getTicker();
        if (ticker) {
          let lastFpsUpdate = 0;
          const fpsCallback = () => {
            const now = Date.now();
            if (now - lastFpsUpdate > 500) {
              setFps(machine.getFPS());
              lastFpsUpdate = now;
            }
          };
          ticker.add(fpsCallback);
          fpsTickerRef.current = fpsCallback;
        }
        
        // Скрываем индикатор загрузки после инициализации
        setIsSlotLoading(false);
        // Баланс уже получен при авторизации и передан через props
      }
    };

    initSlotMachine();

    // Очистка при размонтировании
    return () => {
      // Отписываемся от FPS ticker
      if (slotMachine && fpsTickerRef.current) {
        const ticker = slotMachine.getTicker();
        if (ticker) {
          ticker.remove(fpsTickerRef.current);
        }
        fpsTickerRef.current = null;
      }
      if (slotMachine) {
        slotMachine.destroy();
      }
    };
  }, [theme]); // Пересоздаём при смене темы

  // Устанавливаем класс in-game для body (блокируем скролл)
  useEffect(() => {
    document.body.classList.add('in-game');
    document.body.classList.remove('in-lobby');
    return () => {
      document.body.classList.remove('in-game');
    };
  }, []);

  // Смена фона в зависимости от темы
  useEffect(() => {
    const bgPath = getBackgroundAssetPath(theme);
    const originalBg = document.body.style.backgroundImage;
    
    // Устанавливаем фон темы
    document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('${bgPath}')`;
    
    // Возвращаем исходный фон при размонтировании или смене темы
    return () => {
      document.body.style.backgroundImage = originalBg;
    };
  }, [theme]);

  // Эффект песка для египетской темы
  useEffect(() => {
    // Уничтожаем предыдущий эффект
    if (sandEffectRef.current) {
      sandEffectRef.current.destroy();
      sandEffectRef.current = null;
    }
    
    // Создаём эффект песка только для египетской темы
    if (theme.id === 'egypt' && sandContainerRef.current) {
      const sandEffect = new SandEffect({
        particleCount: 120,
        windDirection: 'right',
        windSpeed: 1.5,        // Медленный, спокойный ветер
        intensity: 0.6,        // Менее заметные частицы
        gustEnabled: true,
        gustInterval: 6000,    // Порывы реже
      });
      sandEffect.init(sandContainerRef.current);
      sandEffectRef.current = sandEffect;
      console.log('[SandEffect] Эффект песка инициализирован для египетской темы');
    }
    
    return () => {
      if (sandEffectRef.current) {
        sandEffectRef.current.destroy();
        sandEffectRef.current = null;
      }
    };
  }, [theme]);

  // Смена музыки в зависимости от темы
  useEffect(() => {
    const musicEl = musicRef.current;
    if (!musicEl) return;
    
    const themeMusicPath = getMusicAssetPath(theme);
    const defaultMusicPath = getDefaultMusicPath();
    
    // Пробуем загрузить музыку темы, если не получится - используем дефолтную
    const wasPlaying = !musicEl.paused;
    
    console.log(`[Music] Загрузка музыки для темы ${theme.id}, путь: ${themeMusicPath}`);
    
    // Проверяем существование файла музыки темы
    fetch(themeMusicPath, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          console.log(`[Music] Найдена музыка темы: ${themeMusicPath}`);
          musicEl.src = themeMusicPath;
        } else {
          console.log(`[Music] Музыка темы не найдена, используем дефолтную: ${defaultMusicPath}`);
          musicEl.src = defaultMusicPath;
        }
        musicEl.load();
        if (wasPlaying && isMusicOn) {
          musicEl.play().catch(err => console.log('Music play error:', err));
        }
      })
      .catch(() => {
        console.log(`[Music] Ошибка загрузки, используем дефолтную: ${defaultMusicPath}`);
        musicEl.src = defaultMusicPath;
        musicEl.load();
        if (wasPlaying && isMusicOn) {
          musicEl.play().catch(err => console.log('Music play error:', err));
        }
      });
  }, [theme, isMusicOn]);

  // Остановка автоспина
  const stopAutoSpin = useCallback(() => {
    autoSpinRef.current = false;
    setIsAutoSpin(false);
    setAutoSpinCount(0);
    setShowAutoSpinMenu(false);
  }, []);

  // Функция для плавного затухания музыки
  const fadeOutMusic = useCallback(() => {
    const musicEl = musicRef.current;
    if (!musicEl || musicEl.paused) return;
    
    if (musicFadeIntervalRef.current) {
      clearInterval(musicFadeIntervalRef.current);
    }
    
    musicFadeIntervalRef.current = window.setInterval(() => {
      if (musicEl.volume > 0.05) {
        musicEl.volume = Math.max(0, musicEl.volume - 0.05);
      } else {
        musicEl.pause();
        musicEl.volume = 1;
        if (musicFadeIntervalRef.current) {
          clearInterval(musicFadeIntervalRef.current);
          musicFadeIntervalRef.current = null;
        }
      }
    }, 50);
  }, []);

  // Функция для запуска музыки при спине
  const startMusicOnSpin = useCallback(() => {
    const musicEl = musicRef.current;
    if (!musicEl || !isMusicOn) return;
    
    if (musicFadeTimerRef.current) {
      clearTimeout(musicFadeTimerRef.current);
      musicFadeTimerRef.current = null;
    }
    if (musicFadeIntervalRef.current) {
      clearInterval(musicFadeIntervalRef.current);
      musicFadeIntervalRef.current = null;
    }
    
    musicEl.volume = 1;
    if (musicEl.paused) {
      musicEl.play().catch(() => console.log('Music play blocked'));
    }
  }, [isMusicOn]);

  // Функция для запуска таймера затухания после окончания спина
  const scheduleMusicFade = useCallback(() => {
    if (!isMusicOn) return;
    
    if (musicFadeTimerRef.current) {
      clearTimeout(musicFadeTimerRef.current);
    }
    
    musicFadeTimerRef.current = window.setTimeout(() => {
      fadeOutMusic();
    }, 2000);
  }, [isMusicOn, fadeOutMusic]);

  // Обработчик спина (поддерживает автоспин)
  const handleSpin = useCallback(async (isFromAutoSpin = false) => {
    // Защита от двойного вызова с помощью ref (синхронная проверка)
    if (isSpinningRef.current) {
      return;
    }
    
    // Используем актуальные значения из refs для автоспина
    const currentBalance = isFromAutoSpin ? balanceRef.current : balance;
    const currentBet = betRef.current;
    
    if (!slotMachine || currentBalance < currentBet) {
      // Если автоспин и баланс недостаточен - останавливаем
      if (isFromAutoSpin && currentBalance < currentBet) {
        stopAutoSpin();
      }
      return;
    }

    // Блокируем повторный вызов
    isSpinningRef.current = true;
    
    // Воспроизводим звук спина
    if (spinSoundRef.current) {
      spinSoundRef.current.currentTime = 0;
      spinSoundRef.current.play().catch(err => console.log('Audio play error:', err));
    }
    
    // Воспроизводим звук вращения барабанов (loop пока крутятся)
    if (barabanSoundRef.current) {
      barabanSoundRef.current.currentTime = 0;
      barabanSoundRef.current.loop = true;
      barabanSoundRef.current.play().catch(err => console.log('Baraban audio play error:', err));
    }
    
    // Запускаем музыку при спине
    startMusicOnSpin();
    
    // Сохраняем баланс до спина
    const balanceBefore = currentBalance;

    setIsSpinning(true);
    setWinAmount(0);
    setShowStatsModal(false);

    try {
      // Запрашиваем результат спина с сервера
      const result = await API.spin(currentBet);
      
      // Устанавливаем результат в слот-машину
      slotMachine.setSpinResult(result);
      
      // Запускаем анимацию вращения
      slotMachine.spin((spinResult) => {
        // Колбэк после завершения анимации
        
        // Останавливаем звук вращения барабанов
        if (barabanSoundRef.current) {
          barabanSoundRef.current.pause();
          barabanSoundRef.current.currentTime = 0;
        }
        
        updateBalance(spinResult.balance);
        setWinAmount(spinResult.win_amount);
        setIsSpinning(false);
        isSpinningRef.current = false; // Разблокируем
        
        // Записываем в историю
        spinCounterRef.current += 1;
        setSpinHistory(prev => [...prev, {
          spinNumber: spinCounterRef.current,
          bet: currentBet,
          win: spinResult.win_amount,
          balanceBefore: balanceBefore,
          balanceAfter: spinResult.balance
        }]);
        
        // Проигрываем звук для символов при выигрыше
        if (spinResult.wins && spinResult.wins.length > 0) {
          const hasEWin = spinResult.wins.some(win => win.symbol === 'E');
          if (hasEWin && eSoundRef.current) {
            eSoundRef.current.currentTime = 0;
            eSoundRef.current.play().catch(err => console.log('E sound play error:', err));
          }
          
          const hasCWin = spinResult.wins.some(win => win.symbol === 'C');
          if (hasCWin && cSoundRef.current) {
            cSoundRef.current.currentTime = 0;
            cSoundRef.current.play().catch(err => console.log('C sound play error:', err));
          }
          
          const hasBWin = spinResult.wins.some(win => win.symbol === 'B');
          if (hasBWin && bSoundRef.current) {
            bSoundRef.current.currentTime = 0;
            bSoundRef.current.play().catch(err => console.log('B sound play error:', err));
          }
          
          const hasFWin = spinResult.wins.some(win => win.symbol === 'F');
          if (hasFWin && fSoundRef.current) {
            fSoundRef.current.currentTime = 0;
            fSoundRef.current.play().catch(err => console.log('F sound play error:', err));
          }
        }
        
        // Если автоспин активен - продолжаем
        if (autoSpinRef.current) {
          setAutoSpinCount(prev => {
            const newCount = prev - 1;
            if (newCount <= 0 || spinResult.balance < betRef.current) {
              // Останавливаем автоспин
              stopAutoSpin();
              // Запускаем затухание музыки после окончания автоспина
              scheduleMusicFade();
              return 0;
            }
            // Задержка перед следующим спином - дольше если был выигрыш
            // чтобы успела проиграться анимация линии и блика
            const hasWin = spinResult.wins && spinResult.wins.length > 0;
            const delay = hasWin ? 2500 : 500;
            setTimeout(() => {
              if (autoSpinRef.current) {
                handleSpin(true);
              }
            }, delay);
            return newCount;
          });
        } else {
          // Для обычного спина - запускаем таймер затухания музыки
          scheduleMusicFade();
        }
      });
    } catch (error) {
      console.error('Spin failed:', error);
      setIsSpinning(false);
      isSpinningRef.current = false; // Разблокируем при ошибке
      // При ошибке останавливаем автоспин
      if (isFromAutoSpin) {
        stopAutoSpin();
      }
    }
  }, [slotMachine, balance, stopAutoSpin, startMusicOnSpin, scheduleMusicFade]);

  // Запуск автоспина
  const startAutoSpin = useCallback((count: number) => {
    if (isSpinning || balance < bet) return;
    
    // Очищаем историю спинов и сбрасываем счётчик
    setSpinHistory([]);
    spinCounterRef.current = 0;
    
    autoSpinRef.current = true;
    setIsAutoSpin(true);
    setAutoSpinCount(count);
    setShowAutoSpinMenu(false);
    
    // Запускаем первый спин
    handleSpin(true);
  }, [isSpinning, balance, bet, handleSpin]);

  // Переключение меню автоспина
  const toggleAutoSpinMenu = useCallback(() => {
    if (isAutoSpin) {
      // Если автоспин активен - останавливаем
      stopAutoSpin();
    } else {
      // Если не активен - показываем меню
      setShowAutoSpinMenu(prev => !prev);
    }
  }, [isAutoSpin, stopAutoSpin]);

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
      updateBalance(result.balance);
      setStats(result.stats);
      setShowStatsModal(true);
      
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
      updateBalance(newBalance);
      setWinAmount(0); // Сбрасываем выигрыш при сбросе баланса
    } catch (error) {
      console.error('Failed to reset balance:', error);
    }
  }, [updateBalance]);

  // Переключение фоновой музыки
  const handleToggleMusic = useCallback(() => {
    setIsMusicOn(prev => !prev);
  }, []);

  // Управление при переключении кнопки музыки
  useEffect(() => {
    const musicEl = musicRef.current;
    if (!musicEl) return;

    if (!isMusicOn) {
      // Сразу останавливаем музыку если выключена
      if (musicFadeTimerRef.current) clearTimeout(musicFadeTimerRef.current);
      if (musicFadeIntervalRef.current) clearInterval(musicFadeIntervalRef.current);
      musicEl.pause();
      musicEl.volume = 1;
    }
  }, [isMusicOn]);

  return (
    <div className="game-container">
      {/* Контейнер для эффекта песка (египетская тема) */}
      <div ref={sandContainerRef} className="sand-effect-container" />
      
      {/* Аудио для звуков */}
      <audio ref={spinSoundRef} src="./assets/audio/start.mp3" preload="auto" />
      <audio ref={stopSoundRef} src="./assets/audio/stop.mp3" preload="auto" />
      <audio ref={musicRef} preload="auto" loop />
      <audio ref={eSoundRef} src="./assets/audio/e-sound.mp3" preload="auto" />
      <audio ref={cSoundRef} src="./assets/audio/c-sound.mp3" preload="auto" />
      <audio ref={bSoundRef} src="./assets/audio/b-sound.mp3" preload="auto" />
      <audio ref={fSoundRef} src="./assets/audio/f-sound.mp3" preload="auto" />
      <audio ref={barabanSoundRef} src="./assets/audio/baraban.mp3" preload="auto" />
      
      {/* Навбар с кнопками управления */}
      <Navbar
        onResetBalance={handleResetBalance}
        onMultiSpin={handleMultiSpin}
        onShowHistory={() => setShowHistoryModal(true)}
        isSpinning={isSpinning}
        isAutoSpin={isAutoSpin}
        isProcessingMultiSpin={isProcessingMultiSpin}
        multiSpinProgress={multiSpinProgress}
        balance={balance}
        bet={bet}
        isMusicOn={isMusicOn}
        onToggleMusic={handleToggleMusic}
        player={player}
        themeName={theme.name}
        onBackToLobby={onBackToLobby}
        fps={fps}
      />
      
      {/* Обёртка слот-контейнера с оверлеем загрузки */}
      <div className="slot-container-wrapper">
        {/* Контейнер для слот-машины (Pixi.js) */}
        <div className="slot-container" ref={slotContainerRef}></div>
        
        {/* Оверлей загрузки слот-машины */}
        {isSlotLoading && (
          <div className="slot-loading-overlay">
            <div className="slot-loading-content">
              <div className="slot-loading-spinner">
                <div className="slot-loading-spinner-ring"></div>
                <div className="slot-loading-spinner-ring"></div>
                <div className="slot-loading-spinner-ring"></div>
              </div>
              <p className="slot-loading-text">Загрузка слота...</p>
            </div>
          </div>
        )}
      </div>

      {/* Основная панель управления */}
      <div className="main-controls">
        {/* Кнопка информации */}
        <button className="control-btn info-btn" title="Информация">
          <span>i</span>
        </button>

        {/* Кнопка уменьшения ставки */}
        <button 
          className="control-btn minus-btn"
          onClick={() => setBet(Math.max(1, bet - 10))}
          disabled={isSpinning || isAutoSpin || bet <= 1}
        >
          −
        </button>

        {/* Панель баланса и ставки (десктоп) */}
        <div className="balance-bet-panel">
          <div className="panel-row">
            <span className="panel-label">БАЛАНС:</span>
            <span className="panel-value">◎{balance.toLocaleString()}</span>
          </div>
          <div className="panel-row">
            <span className="panel-label">ОБЩАЯ СТАВКА:</span>
            <span className="panel-value bet-value">◎{bet}</span>
          </div>
        </div>

        {/* Объединённая панель для мобильных - переключается между балансом и выигрышем */}
        <div className={`info-display-panel-mobile ${showWinDisplay && winAmount > 0 ? 'has-win' : ''}`}>
          <div className="info-display-inner">
            {/* Контент баланса и ставки */}
            <div className={`balance-bet-content ${showWinDisplay ? 'hidden' : ''}`}>
              <div className="panel-row">
                <span className="panel-label">БАЛАНС:</span>
                <span className="panel-value">◎{balance.toLocaleString()}</span>
              </div>
              <div className="panel-row">
                <span className="panel-label">ОБЩАЯ СТАВКА:</span>
                <span className="panel-value bet-value">◎{bet}</span>
              </div>
            </div>
            
            {/* Контент выигрыша */}
            <div className={`win-content ${showWinDisplay ? 'visible' : ''} ${winAmount > 0 ? 'has-win' : ''}`}>
              <span className="win-label-mobile">ВЫИГРЫШ:</span>
              <span className={`win-value-mobile ${winAmount > 0 ? 'has-win' : ''}`}>◎{animatedWinAmount}</span>
            </div>
          </div>
        </div>

        {/* Кнопка увеличения ставки */}
        <button 
          className="control-btn plus-btn"
          onClick={() => setBet(Math.min(500, bet + 10))}
          disabled={isSpinning || isAutoSpin || bet >= 500}
        >
          +
        </button>

        {/* Панель выигрыша (десктоп) */}
        <div className="win-panel">
          <span className="win-label">ВЫИГРЫШ:</span>
          <span className="win-value">◎{animatedWinAmount}</span>
        </div>

        {/* Макс. ставка */}
        <button 
          className="control-btn max-bet-btn"
          onClick={() => setBet(Math.min(500, balance))}
          disabled={isSpinning || isAutoSpin}
        >
          <span className="btn-text-small">МАКС.</span>
          <span className="btn-text-small">СТАВКА</span>
        </button>

        {/* Автоспин */}
        <div className="autospin-wrapper">
          {isAutoSpin ? (
            <button
              className="control-btn autospin-active-btn"
              onClick={toggleAutoSpinMenu}
            >
              <span className="btn-text-small">СТОП</span>
              <span className="btn-text-small">({autoSpinCount})</span>
            </button>
          ) : (
            <button
              className="control-btn auto-btn"
              onClick={toggleAutoSpinMenu}
              disabled={isSpinning || balance < bet}
            >
              <span className="btn-text-small">АВТО</span>
              <span className="btn-text-small">СПИН</span>
            </button>
          )}
          {showAutoSpinMenu && !isAutoSpin && (
            <div className="autospin-menu">
              {AUTO_SPIN_OPTIONS.map((count) => (
                <button
                  key={count}
                  className="autospin-option"
                  onClick={() => startAutoSpin(count)}
                  disabled={balance < bet}
                >
                  {count} спинов
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Главная кнопка СПИН */}
        <button
          className="spin-btn"
          onClick={() => handleSpin(false)}
          disabled={isSpinning || balance < bet || isAutoSpin}
        >
          {isSpinning && !isProcessingMultiSpin && !isAutoSpin ? '...' : 'СПИН'}
        </button>
      </div>
      
      {/* Модальное окно истории спинов */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`История спинов (${spinHistory.length})`}
      >
        {spinHistory.length > 0 ? (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="spin-history-table w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ставка</th>
                  <th>Выигрыш</th>
                  <th>Баланс до</th>
                  <th>Баланс после</th>
                  <th>Изменение</th>
                </tr>
              </thead>
              <tbody>
                {spinHistory.map((item) => {
                  const change = item.balanceAfter - item.balanceBefore;
                  return (
                    <tr key={item.spinNumber}>
                      <td>{item.spinNumber}</td>
                      <td>{item.bet}</td>
                      <td className={item.win > 0 ? 'text-green-400' : ''}>{item.win}</td>
                      <td>{item.balanceBefore}</td>
                      <td>{item.balanceAfter}</td>
                      <td className={change >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {change >= 0 ? '+' : ''}{change}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">
            История спинов пуста. Запустите автоспин или серию спинов.
          </p>
        )}
        {spinHistory.length > 0 && (
          <button
            className="btn btn-secondary mt-4"
            onClick={() => setSpinHistory([])}
          >
            Очистить историю
          </button>
        )}
      </Modal>

      {/* Модальное окно статистики 1000 спинов */}
      <Modal
        isOpen={showStatsModal && !!stats}
        onClose={() => setShowStatsModal(false)}
        title="Статистика 1000 спинов"
      >
        {stats && (
          <>
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
          </>
        )}
      </Modal>

      {/* Модальное окно низкого баланса с предложением рекламы */}
      <LowBalanceModal
        isOpen={showLowBalanceModal}
        onClose={() => setShowLowBalanceModal(false)}
        onRewardReceived={handleAdReward}
        currentBalance={balance}
      />
    </div>
  );
};

export default SlotGame;
