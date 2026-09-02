import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SlotMachine } from '../game/SlotMachine';
import Navbar from './Navbar';
import Modal from './Modal';
import LowBalanceModal from './LowBalanceModal';
import DiceLadder from './DiceLadder';
import WinModal from './WinModal';
import * as API from '../api';
import { Stats, DiceLevel } from '../types';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { SlotTheme, getBackgroundAssetPath, getMusicAssetPath, getDefaultMusicPath, isMobileDevice, isAppleMobileDevice, isRunningStandalone } from '../config/themes';
import { SharedPixiApp } from '../game/core';
import { SandEffect } from '../game/SandEffect';
import { StarEffect, FireflyEffect } from '../game/effects';

const AUTO_SPIN_OPTIONS = [10, 25, 50, 100];
const BET_OPTIONS = [500, 1000, 2000];
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
  const stopEgyptSoundRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const eSoundRef = useRef<HTMLAudioElement | null>(null);
  const cSoundRef = useRef<HTMLAudioElement | null>(null);
  const bSoundRef = useRef<HTMLAudioElement | null>(null);
  const fSoundRef = useRef<HTMLAudioElement | null>(null);
  const barabanSoundRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const musicFadeTimerRef = useRef<number | null>(null);
  const musicFadeIntervalRef = useRef<number | null>(null);
  const [isMusicOn, setIsMusicOn] = useState<boolean>(true);
  const [slotMachine, setSlotMachine] = useState<SlotMachine | null>(null);
  const [balance, setBalance] = useState<number>(initialBalance);
  const [bet, setBet] = useState<number>(500);
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
  const effectsContainerRef = useRef<HTMLDivElement>(null);
  const sharedPixiAppRef = useRef<SharedPixiApp | null>(null);
  
  // Состояния автоспина
  const [isAutoSpin, setIsAutoSpin] = useState<boolean>(false);
  const [autoSpinCount, setAutoSpinCount] = useState<number>(0);
  const [showAutoSpinMenu, setShowAutoSpinMenu] = useState<boolean>(false);
  const [showBetMenu, setShowBetMenu] = useState<boolean>(false);
  const autoSpinRef = useRef<boolean>(false); // Для отслеживания состояния автоспина в колбэках
  const testBonusRef = useRef<boolean>(false); // Флаг для тестового бонуса Dice Ladder
  const betRef = useRef<number>(bet); // Для хранения текущей ставки в колбэках
  
  // Состояния фриспинов
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState<number>(0);
  const [freeSpinsTotal, setFreeSpinsTotal] = useState<number>(0);
  const [freeSpinsMultiplier, setFreeSpinsMultiplier] = useState<number>(3);
  const [isFreeSpin, setIsFreeSpin] = useState<boolean>(false);
  const [showFreeSpinsNotification, setShowFreeSpinsNotification] = useState<boolean>(false);
  const [freeSpinsTriggeredCount, setFreeSpinsTriggeredCount] = useState<number>(0);
  const [showFreeSpinsResult, setShowFreeSpinsResult] = useState<boolean>(false);
  const [freeSpinsTotalWin, setFreeSpinsTotalWin] = useState<number>(0);
  const freeSpinsTotalWinRef = useRef<number>(0); // Для накопления в колбэках
  const freeSpinsTriggerPendingRef = useRef<boolean>(false); // Для отслеживания ожидания нотификации
  const freeSpinsResultRef = useRef<boolean>(false); // Блокировка спинов во время модалки результатов
  const freeSpinsRemainingRef = useRef<number>(0); // Для хранения фриспинов в колбэках
  const freeSpinsMultiplierRef = useRef<number>(1); // Для хранения множителя фриспинов в колбэках
  // Состояния бонусной игры Dice Ladder
  const [showBonusNotification, setShowBonusNotification] = useState<boolean>(false);
  const [bonusTriggeredCount, setBonusTriggeredCount] = useState<number>(3);
  const [showDiceLadder, setShowDiceLadder] = useState<boolean>(false);
  const [diceLadderData, setDiceLadderData] = useState<{
    bet: number;
    balance: number;
    levels: DiceLevel[];
  } | null>(null);
  const bonusPausedFreeSpinsRef = useRef<number>(0); // Сколько фриспинов осталось при входе в бонус
  const [mobileWinData, setMobileWinData] = useState<{ symbol: string; amount: number; count: number; rarity: string; rarityColor: string }[]>([]);
  const [showWinModal, setShowWinModal] = useState<boolean>(false);
  const [winModalData, setWinModalData] = useState<{ totalWin: number; bet: number; symbols: { symbol: string; count: number; amount: number }[] } | null>(null);
  const winModalCollectRef = useRef<(() => void) | null>(null); // Колбэк после закрытия модалки
  const balanceRef = useRef<number>(balance); // Для хранения актуального баланса
  const isSpinningRef = useRef<boolean>(false); // Для защиты от двойного вызова
  const isMountedRef = useRef<boolean>(true); // Для отслеживания размонтирования компонента
  const freeSpinTimerRef = useRef<number | null>(null); // Таймер автоматического фриспина
  const freeSpinNotificationTimerRef = useRef<number | null>(null); // Таймер уведомления о фриспинах
  const autoSpinTimerRef = useRef<number | null>(null); // Таймер автоспина
  
  // Отслеживание размонтирования компонента для предотвращения утечек памяти
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Очищаем все таймеры при размонтировании
      if (freeSpinTimerRef.current) {
        clearTimeout(freeSpinTimerRef.current);
        freeSpinTimerRef.current = null;
      }
      if (freeSpinNotificationTimerRef.current) {
        clearTimeout(freeSpinNotificationTimerRef.current);
        freeSpinNotificationTimerRef.current = null;
      }
      if (autoSpinTimerRef.current) {
        clearTimeout(autoSpinTimerRef.current);
        autoSpinTimerRef.current = null;
      }
    };
  }, []);
  
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
          // Для египетской темы используем специальный звук остановки
          const stopRef = theme.id === 'egypt' ? stopEgyptSoundRef : stopSoundRef;
          if (stopRef.current) {
            // Клонируем звук для одновременного воспроизведения нескольких
            const sound = stopRef.current.cloneNode() as HTMLAudioElement;
            sound.volume = theme.id === 'egypt' ? 0.4 : 1;
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

  // Состояние и эффект принудительной альбомной ориентации на мобильных
  // Только для классической темы
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const isMobileRef = useRef<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const isIOSRef = useRef<boolean>(false);
  const isStandaloneRef = useRef<boolean>(false);

  // Функция входа в полноэкранный режим и блокировки ориентации
  const enterFullscreenAndLockOrientation = useCallback(async () => {
    // На iOS (iPhone/iPad) стандартный Fullscreen API не работает для DOM-элементов
    if (isIOSRef.current) {
      if (isStandaloneRef.current) {
        // Уже в PWA-режиме на iOS — экран и так в fullscreen
        // Просто проверяем и скрываем оверлей
        const portrait = window.innerHeight > window.innerWidth;
        setIsPortrait(portrait);
      } else {
        // На iOS без PWA — показываем инструкцию пользователю
        setIsPortrait(true); // Оставляем оверлей с инструкцией
      }
      return;
    }

    const docEl = document.documentElement;
    
    try {
      // Пытаемся войти в полноэкранный режим
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if ((docEl as any).webkitRequestFullscreen) {
        await (docEl as any).webkitRequestFullscreen();
      } else if ((docEl as any).mozRequestFullScreen) {
        await (docEl as any).mozRequestFullScreen();
      } else if ((docEl as any).msRequestFullscreen) {
        await (docEl as any).msRequestFullscreen();
      }
      
      setIsFullscreen(true);
      
      // После входа в полноэкранный режим пытаемся заблокировать ориентацию
      // Небольшая задержка чтобы fullscreen успел активироваться
      setTimeout(async () => {
        try {
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            await screen.orientation.lock('landscape');
            // После успешной блокировки проверяем ориентацию
            const portrait = window.innerHeight > window.innerWidth;
            setIsPortrait(portrait);
          }
        } catch (e) {
          console.log('Не удалось заблокировать ориентацию:', e);
        }
      }, 100);
      
    } catch (e) {
      console.log('Не удалось войти в полноэкранный режим:', e);
    }
  }, []);

  // Функция выхода из fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
      
      // Разблокируем ориентацию
      try {
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
          screen.orientation.unlock();
        }
      } catch (e) {}
    } catch (e) {
      console.log('Не удалось выйти из полноэкранного режима:', e);
    }
  }, []);

  // Обёртка для onBackToLobby — для классической темы сначала выходим из fullscreen
  const handleBackToLobbyWithFullscreenExit = useCallback(async () => {
    if (theme.id === 'classic' && isFullscreen) {
      await exitFullscreen();
    }
    onBackToLobby?.();
  }, [theme.id, isFullscreen, exitFullscreen, onBackToLobby]);

  // Принудительная альбомная ориентация на мобильных устройствах
  // Только для классической темы
  useEffect(() => {
    if (theme.id !== 'classic') return;
    
    // Проверяем текущую ориентацию
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    };
    
    // Обработчик изменения fullscreen
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).mozFullScreenElement || 
        (document as any).msFullscreenElement);
      setIsFullscreen(isFs);
      
      // Если вышли из fullscreen, проверяем ориентацию
      if (!isFs) {
        setTimeout(checkOrientation, 300);
      }
    };
    
    const checkMobile = () => {
      isMobileRef.current = isMobileDevice();
      isIOSRef.current = isAppleMobileDevice();
      isStandaloneRef.current = isRunningStandalone();
      if (isMobileRef.current) {
        checkOrientation();
        
        // Пытаемся заблокировать ориентацию на альбомную (работает только в fullscreen)
        try {
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock('landscape').catch(() => {
              // Браузер блокирует API без fullscreen — это нормально
            });
          }
        } catch (e) {
          // API может быть недоступен
        }
        
        // Слушаем изменения ориентации
        const orientationHandler = () => {
          setTimeout(checkOrientation, 300);
        };
        window.addEventListener('orientationchange', orientationHandler);
        window.addEventListener('resize', checkOrientation);
        
        // Слушаем изменения fullscreen
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        
        return () => {
          window.removeEventListener('orientationchange', orientationHandler);
          window.removeEventListener('resize', checkOrientation);
          document.removeEventListener('fullscreenchange', handleFullscreenChange);
          document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
          document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
          document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
          
          // Разблокируем ориентацию при выходе
          try {
            if (screen.orientation && typeof screen.orientation.unlock === 'function') {
              screen.orientation.unlock();
            }
          } catch (e) {}
        };
      }
    };
    
    checkMobile();
  }, [theme.id]);
  // Единый эффект для всех фоновых визуальных эффектов
  // Использует SharedPixiApp — один PIXI.Application для всех эффектов,
  // вместо того чтобы каждый эффект создавал свой WebGL контекст.
  useEffect(() => {
    // Инициализируем SharedPixiApp (один WebGL контекст для всех эффектов)
    if (!sharedPixiAppRef.current) {
      const shared = SharedPixiApp.getInstance();
      if (effectsContainerRef.current) {
        shared.init(effectsContainerRef.current);
      }
      sharedPixiAppRef.current = shared;
    }
    
    const context = {
      stage: sharedPixiAppRef.current.stage,
      ticker: sharedPixiAppRef.current.ticker,
    };
    
    const activeEffects: { destroy: () => void }[] = [];
    
    // Создаём нужные эффекты в зависимости от темы
    if (theme.id === 'egypt') {
      // Эффект песка (египет)
      const sandEffect = new SandEffect({
        particleCount: 80,        // Уменьшили для мобильных
        windDirection: 'right',
        windSpeed: 1.5,
        intensity: 0.6,
        gustEnabled: true,
        gustInterval: 6000,
      });
      sandEffect.initOnStage(context);
      activeEffects.push(sandEffect);
      
      // Эффект звёзд (египет)
      const isMobile = isMobileDevice();
      const starEffect = new StarEffect({
        starCount: isMobile ? 35 : 55,  // Уменьшили
      });
      starEffect.initOnStage(context);
      activeEffects.push(starEffect);
    } else if (theme.id === 'aztec') {
      // Эффект светлячков (ацтеки)
      const isMobile = isMobileDevice();
      const fireflyEffect = new FireflyEffect({
        count: isMobile ? 10 : 25,  // Уменьшили
      });
      fireflyEffect.initOnStage(context);
      activeEffects.push(fireflyEffect);
    }
    
    return () => {
      activeEffects.forEach(e => e.destroy());
    };
  }, [theme.id]);

// Очистка SharedPixiApp при размонтировании компонента
  useEffect(() => {
    return () => {
      if (sharedPixiAppRef.current) {
        sharedPixiAppRef.current.destroy();
        sharedPixiAppRef.current = null;
      }
    };
  }, []);
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

  // Фоновый звук (primary.mp3) для темы ацтеков - играет пока не нажата кнопка спин
  useEffect(() => {
    const ambientEl = ambientRef.current;
    if (!ambientEl || !isMusicOn) return;

    if (theme.id === 'aztec') {
      ambientEl.volume = 0.2; // 20% громкость
      ambientEl.loop = true;
      ambientEl.play().catch(err => console.log('[Ambient] Play error:', err));
      console.log('[Ambient] Запущен фоновый звук primary.mp3 для темы ацтеков');
    } else {
      ambientEl.pause();
      ambientEl.currentTime = 0;
    }

    return () => {
      if (ambientEl) {
        ambientEl.pause();
        ambientEl.currentTime = 0;
      }
    };
  }, [theme, isMusicOn]);

  // Остановка автоспина
  const stopAutoSpin = useCallback(() => {
    autoSpinRef.current = false;
    setIsAutoSpin(false);
    setAutoSpinCount(0);
    setShowAutoSpinMenu(false);
    // Очищаем таймер автоспина при остановке
    if (autoSpinTimerRef.current) {
      clearTimeout(autoSpinTimerRef.current);
      autoSpinTimerRef.current = null;
    }
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
        musicEl.volume = 0.2;
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
    
    // Музыка сразу на полную громкость
    musicEl.volume = 0.2;
    if (musicEl.paused) {
      musicEl.play().catch(() => console.log('Music play blocked'));
    }
    
    // Для темы ацтеков — плавно затухает только ambient
    if (theme.id === 'aztec') {
      const ambientEl = ambientRef.current;
      if (!ambientEl || ambientEl.paused) return;
      
      let ambientVol = ambientEl.volume || 0.2;
      const fadeInterval = window.setInterval(() => {
        ambientVol = Math.max(0, ambientVol - 0.05);
        ambientEl.volume = ambientVol;
        
        if (ambientVol <= 0) {
          ambientEl.pause();
          console.log('[Ambient] Затухание завершено при спине');
          clearInterval(fadeInterval);
        }
      }, 50);
    }
  }, [isMusicOn, theme.id]);

  // Функция для запуска таймера затухания после окончания спина
  const scheduleMusicFade = useCallback(() => {
    if (!isMusicOn) return;
    
    if (musicFadeTimerRef.current) {
      clearTimeout(musicFadeTimerRef.current);
    }
    
    musicFadeTimerRef.current = window.setTimeout(() => {
      fadeOutMusic();
      // После затухания музыки возобновляем фоновый звук для темы ацтеков
      if (theme.id === 'aztec') {
        const ambientEl = ambientRef.current;
        const musicEl = musicRef.current;
        if (!ambientEl || !musicEl) return;
        
        // Crossfade: музыка затухает до 0, ambient возрастает до 0.2
        ambientEl.volume = 0;
        ambientEl.play().catch(err => console.log('[Ambient] Resume error:', err));
        
        let musicVol = musicEl.volume;
        let ambientVol = 0;
        const fadeInterval = window.setInterval(() => {
          musicVol = Math.max(0, musicVol - 0.008);
          ambientVol = Math.min(0.2, ambientVol + 0.012);
          musicEl.volume = musicVol;
          ambientEl.volume = ambientVol;
          
          if (musicVol <= 0 && ambientVol >= 0.2) {
            musicEl.pause();
            clearInterval(fadeInterval);
          }
        }, 50);
      }
    }, 2000);
  }, [isMusicOn, fadeOutMusic, theme.id]);

  // Обработчик спина (поддерживает автоспин)
  const handleSpin = useCallback(async (isFromAutoSpin = false) => {
    // Защита от двойного вызова с помощью ref (синхронная проверка)
    if (isSpinningRef.current) {
      return;
    }
    
    // Если висит модалка фриспинов — не запускаем новый спин
    if (freeSpinsTriggerPendingRef.current) {
      console.log('[Spin] Модалка фриспинов активна, спин заблокирован');
      return;
    }
    // Если висит модалка результатов фриспинов
    if (freeSpinsResultRef.current) {
      console.log('[Spin] Модалка результатов фриспинов активна, спин заблокирован');
      return;
    }
    // Если активна бонусная игра Dice Ladder
    if (showBonusNotification || showDiceLadder) {
      console.log('[Spin] Бонусная игра активна, спин заблокирован');
      return;
    }

    // Используем актуальные значения из refs для автоспина
    const currentBalance = isFromAutoSpin ? balanceRef.current : balanceRef.current;
    const currentBet = betRef.current;
    const currentFreeSpinsRemaining = freeSpinsRemainingRef.current;
    const currentIsFreeSpin = currentFreeSpinsRemaining > 0;
    
    // Фриспины — не проверяем баланс и не блокируем
    if (!currentIsFreeSpin) {
      if (!slotMachine || currentBalance < currentBet) {
        // Если автоспин и баланс недостаточен - останавливаем
        if (isFromAutoSpin && currentBalance < currentBet) {
          stopAutoSpin();
        }
        return;
      }
    }

    // Блокируем повторный вызов (ref — не вызывает рендер)
    isSpinningRef.current = true;
    
    // Воспроизводим звук спина (для египетской темы отключён)
    if (theme.id !== 'egypt' && spinSoundRef.current) {
      spinSoundRef.current.currentTime = 0;
      spinSoundRef.current.play().catch(err => console.log('Audio play error:', err));
    }
    
    // Воспроизводим звук вращения барабанов (loop пока крутятся; для египетской темы отключён)
    if (theme.id !== 'egypt' && barabanSoundRef.current) {
      barabanSoundRef.current.currentTime = 0;
      barabanSoundRef.current.loop = true;
      barabanSoundRef.current.play().catch(err => console.log('Baraban audio play error:', err));
    }
    
    // Запускаем музыку при спине
    startMusicOnSpin();
    
    // Сохраняем баланс до спина
    const balanceBefore = currentBalance;

    try {
      // Запрашиваем результат спина с сервера
      const result = await API.spin(currentBet, currentFreeSpinsRemaining, currentIsFreeSpin, false, testBonusRef.current);
      testBonusRef.current = false; // Сбрасываем флаг после спина
      
      // Только после ответа сервера — блокируем UI визуально
      setIsSpinning(true);
      setWinAmount(0);
      setShowStatsModal(false);
      
      // Устанавливаем результат в слот-машину
      slotMachine.setSpinResult(result);
      
      // Запускаем анимацию вращения — НЕМЕДЛЕННО, без лишних setState
      slotMachine.spin((spinResult) => {
        // ====== ВСЁ, ЧТО ПОСЛЕ АНИМАЦИИ ======

        // === БОНУСНАЯ ИГРА DICE LADDER ===
        // Выпало 3+ символа G — запускаем бонус вместо обычной логики фриспинов/автоспина
        if (spinResult.bonus_triggered) {
          // Записываем в историю
          spinCounterRef.current += 1;
          setSpinHistory(prev => [...prev, {
            spinNumber: spinCounterRef.current,
            bet: currentBet,
            win: spinResult.win_amount,
            balanceBefore: balanceBefore,
            balanceAfter: spinResult.balance,
          }]);
          // Обновляем баланс и выигрыш (обычные линии на спин-триггере тоже платятся)
          updateBalance(spinResult.balance);
          setWinAmount(spinResult.win_amount);
          if (spinResult.is_free_spin && spinResult.win_amount > 0) {
            freeSpinsTotalWinRef.current += spinResult.win_amount;
          }

          // Останавливаем звук вращения барабанов
          if (barabanSoundRef.current) {
            barabanSoundRef.current.pause();
            barabanSoundRef.current.currentTime = 0;
          }

          // Останавливаем автоспин и таймеры
          if (autoSpinRef.current) {
            stopAutoSpin();
          }
          if (freeSpinTimerRef.current) {
            clearTimeout(freeSpinTimerRef.current);
            freeSpinTimerRef.current = null;
          }
          // Если бонус сработал во время фриспинов — запоминаем остаток
          if (spinResult.is_free_spin) {
            freeSpinsRemainingRef.current = spinResult.free_spins_remaining;
            bonusPausedFreeSpinsRef.current = spinResult.free_spins_remaining;
          } else {
            bonusPausedFreeSpinsRef.current = 0;
          }

          // Разблокируем UI
          setIsSpinning(false);
          isSpinningRef.current = false;
          slotMachine.clear();

          // Открываем уведомление о бонусе
          setBonusTriggeredCount(spinResult.bonus_symbol_count ?? 3);
          setDiceLadderData({
            bet: currentBet,
            balance: spinResult.balance,
            levels: spinResult.bonus_levels ?? [],
          });
          setShowBonusNotification(true);
          return;
        }

        // Обрабатываем фриспины
        if (result.free_spins_triggered > 0) {
          // Активированы фриспины!
          setFreeSpinsTriggeredCount(result.free_spins_triggered);
          setFreeSpinsTotal(result.free_spins_remaining);
          setFreeSpinsMultiplier(result.free_spins_multiplier);
          freeSpinsMultiplierRef.current = result.free_spins_multiplier;
          setIsFreeSpin(true);
          setFreeSpinsRemaining(result.free_spins_remaining);
          setShowFreeSpinsNotification(true);
          freeSpinsTriggerPendingRef.current = true;
          freeSpinsRemainingRef.current = result.free_spins_remaining;
          // Сбрасываем накопленный выигрыш
          freeSpinsTotalWinRef.current = 0;
          setIsSpinning(false);
          isSpinningRef.current = false;
          // Принудительно останавливаем аниматор слот-машины (важно для drop/cascade)
          slotMachine.clear();
          // Останавливаем автоспин, если он был активен
          if (autoSpinRef.current) {
            stopAutoSpin();
          }
          // Таймер НЕ ставим — ждём кнопку от пользователя
        } else if (result.is_free_spin) {
          // Фриспин без ре-триггера — обновляем остаток
          setFreeSpinsRemaining(result.free_spins_remaining);
          freeSpinsRemainingRef.current = result.free_spins_remaining;
        }
        
        // Останавливаем звук вращения барабанов
        if (barabanSoundRef.current) {
          barabanSoundRef.current.pause();
          barabanSoundRef.current.currentTime = 0;
        }
        
        updateBalance(spinResult.balance);
        setWinAmount(spinResult.win_amount);
        // Накопляем выигрыш за фриспины
        if (result.is_free_spin && spinResult.win_amount > 0) {
          freeSpinsTotalWinRef.current += spinResult.win_amount;
        }
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
        
        // === ЛОГИКА АВТОМАТИЧЕСКИХ СПИНОВ ===
        // Приоритет: мобильная модалка выигрыша > фриспины > автоспин
        
        // Показываем модалку с выигрышем (только если нет других модалок)
        if (((spinResult.wins && spinResult.wins.length > 0) || spinResult.win_amount > 0) && !showFreeSpinsResult && !showFreeSpinsNotification) {
          // Задержка 500мс — даём WinDisplayManager подсветить символы
          setTimeout(() => {
            if (!isMountedRef.current) return;
            // Создаём тост для КАЖДОГО выигрыша
            const rarityMap: Record<string, { label: string; color: string }> = {
              A: { label: 'ЛЕГЕНДАРНАЯ', color: '#FF1744' },
              B: { label: 'ЭПИЧЕСКАЯ', color: '#E91E63' },
              C: { label: 'РЕДКАЯ', color: '#2979FF' },
              D: { label: 'НЕОБЫЧНАЯ', color: '#00E676' },
              E: { label: 'ОБЫЧНАЯ', color: '#94a3b8' },
              F: { label: 'ОБЫЧНАЯ', color: '#94a3b8' },
              S: { label: 'SCATTER', color: '#ffd700' },
            };
            
            // Каждый выигрыш -> свой тост
            const newToasts = spinResult.wins.map(w => {
              const r = rarityMap[w.symbol] || { label: 'ОБЫЧНАЯ', color: '#94a3b8' };
              return {
                symbol: w.symbol,
                amount: w.win * (betRef.current || 1) * (freeSpinsMultiplierRef.current || 1),
                count: w.count,
                rarity: r.label,
                rarityColor: r.color,
              };
            });
            
            // Добавляем тосты поочередно с задержкой 600ms между ними
            newToasts.forEach((toast, i) => {
              setTimeout(() => {
                if (!isMountedRef.current) return;
                setMobileWinData(prev => [...prev, toast]);
                
                // Удаляем этот тост через 2 секунды после его появления
                setTimeout(() => {
                  if (!isMountedRef.current) return;
                  setMobileWinData(prev => {
                    const next = [...prev];
                    next.shift();
                    return next;
                  });
                }, 2000);
              }, i * 600);
            });

            // Расчёт множителя для определения уровня выигрыша
            const totalWinAmount = spinResult.win_amount * (freeSpinsMultiplierRef.current || 1);
            const winMultiplier = betRef.current > 0 ? totalWinAmount / betRef.current : 0;

            // Функция продолжения после тостов/модалки
            const continueAfterWinDisplay = () => {
              // Продолжаем фриспины/автоспин после показа выигрыша
              if (result.free_spins_remaining > 0 && !freeSpinsTriggerPendingRef.current) {
                const hasWin = true;
                const delay = 2500; // Фриспины с задержкой для просмотра выигрыша
                if (freeSpinTimerRef.current) {
                  clearTimeout(freeSpinTimerRef.current);
                }
                freeSpinTimerRef.current = window.setTimeout(() => {
                  if (!isMountedRef.current) return;
                  if (isSpinningRef.current) return;
                  freeSpinTimerRef.current = null;
                  freeSpinsRemainingRef.current = result.free_spins_remaining;
                  handleSpin(false);
                }, delay);
              } else if (autoSpinRef.current && !freeSpinsTriggerPendingRef.current) {
                setAutoSpinCount(prev => {
                  const newCount = prev - 1;
                  if (newCount <= 0 || spinResult.balance < betRef.current) {
                    stopAutoSpin();
                    scheduleMusicFade();
                    return 0;
                  }
                  const delay = 2500;
                  if (autoSpinTimerRef.current) {
                    clearTimeout(autoSpinTimerRef.current);
                  }
                  autoSpinTimerRef.current = window.setTimeout(() => {
                    if (!isMountedRef.current) return;
                    autoSpinTimerRef.current = null;
                    if (autoSpinRef.current) {
                      handleSpin(true);
                    }
                  }, delay);
                  return newCount;
                });
              } else if (result.is_free_spin && result.free_spins_remaining <= 0) {
                setIsFreeSpin(false);
                setFreeSpinsTotal(0);
                setFreeSpinsMultiplier(1);
                freeSpinsMultiplierRef.current = 1;
                setFreeSpinsTotalWin(freeSpinsTotalWinRef.current);
                setShowFreeSpinsResult(true);
                freeSpinsResultRef.current = true;
                scheduleMusicFade();
              } else {
                scheduleMusicFade();
              }
            };

            // Если значительный выигрыш (>= 5x от ставки) — показываем WinModal
            if (winMultiplier >= 5) {
              winModalCollectRef.current = continueAfterWinDisplay;
              setWinModalData({
                totalWin: totalWinAmount,
                bet: betRef.current || 0,
                symbols: spinResult.wins && spinResult.wins.length > 0
                ? spinResult.wins.map(w => ({
                    symbol: w.symbol,
                    count: w.count,
                    amount: w.win * (betRef.current || 1) * (freeSpinsMultiplierRef.current || 1),
                  }))
                : [{ symbol: '?', count: 0, amount: totalWinAmount }],
              });
              setShowWinModal(true);
            } else {
              // Обычный выигрыш — продолжаем сразу
              continueAfterWinDisplay();
            }
            }, 500);
        } else if (result.free_spins_remaining > 0 && !freeSpinsTriggerPendingRef.current) {
          // Есть ещё фриспины — запускаем следующий автоматически
          const hasWin = spinResult.wins && spinResult.wins.length > 0;
          const delay = hasWin ? 2500 : 1200; // Фриспины с чуть большей задержкой
          // Очищаем предыдущий таймер фриспина
          if (freeSpinTimerRef.current) {
            clearTimeout(freeSpinTimerRef.current);
          }
          freeSpinTimerRef.current = window.setTimeout(() => {
            if (!isMountedRef.current) return; // Защита от вызова после размонтирования
            if (isSpinningRef.current) return; // Защита от двойного вызова
            freeSpinTimerRef.current = null;
            // Обновляем ref-ы для следующего фриспина
            freeSpinsRemainingRef.current = result.free_spins_remaining;
            handleSpin(false); // Запускаем следующий фриспин
          }, delay);
        } else if (result.is_free_spin && result.free_spins_remaining <= 0) {
          // Фриспины закончились
          setIsFreeSpin(false);
          setFreeSpinsTotal(0);
          setFreeSpinsMultiplier(1);
          freeSpinsMultiplierRef.current = 1;
          // Показываем модалку с итоговым выигрышем
          setFreeSpinsTotalWin(freeSpinsTotalWinRef.current);
          setShowFreeSpinsResult(true);
          freeSpinsResultRef.current = true;
          scheduleMusicFade();
        } else if (autoSpinRef.current && !freeSpinsTriggerPendingRef.current) {
          // Обычный автоспин
          setAutoSpinCount(prev => {
            const newCount = prev - 1;
            if (newCount <= 0 || spinResult.balance < betRef.current) {
              stopAutoSpin();
              scheduleMusicFade();
              return 0;
            }
            const hasWin = spinResult.wins && spinResult.wins.length > 0;
            const delay = hasWin ? 2500 : 500;
            // Очищаем предыдущий таймер автоспина
            if (autoSpinTimerRef.current) {
              clearTimeout(autoSpinTimerRef.current);
            }
            autoSpinTimerRef.current = window.setTimeout(() => {
              if (!isMountedRef.current) return; // Защита от вызова после размонтирования
              autoSpinTimerRef.current = null;
              if (autoSpinRef.current) {
                handleSpin(true);
              }
            }, delay);
            return newCount;
          });
        } else {
          // Обычный спин
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
  }, [slotMachine, stopAutoSpin, startMusicOnSpin, scheduleMusicFade, showBonusNotification, showDiceLadder]);

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

  // Закрытие бонусной игры (обновление баланса и продолжение)
  const handleDiceLadderClose = useCallback((result: { win: number; balance: number }) => {
    setShowDiceLadder(false);
    setDiceLadderData(null);
    setShowBonusNotification(false);
    updateBalance(result.balance);
    setWinAmount(result.win);
    scheduleMusicFade();

    // Если бонус прервал фриспины — продолжаем их
    if (bonusPausedFreeSpinsRef.current > 0) {
      const remaining = bonusPausedFreeSpinsRef.current;
      bonusPausedFreeSpinsRef.current = 0;
      setTimeout(() => {
        if (isMountedRef.current) {
          handleSpin(false);
        }
      }, 1200);
    }
  }, [handleSpin, updateBalance, scheduleMusicFade]);

  // Переключение меню автоспина
  const toggleAutoSpinMenu = useCallback(() => {
    if (isAutoSpin) {
      // Если автоспин активен - останавливаем
      stopAutoSpin();
    } else {
      // Если не активен - показываем меню
      setShowBetMenu(false); // закрываем меню ставки, если открыто
      setShowAutoSpinMenu(prev => !prev);
    }
  }, [isAutoSpin, stopAutoSpin]);

  // Переключение меню выбора ставки
  const toggleBetMenu = useCallback(() => {
    setShowAutoSpinMenu(false); // закрываем меню автоспина, если открыто
    setShowBetMenu(prev => !prev);
  }, []);

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
      
      // Обновляем статистику (баланс НЕ МЕНЯЕТСЯ — симуляция на виртуальном балансе)
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
      musicEl.volume = 0.2;
      // Также останавливаем фоновый звук для темы ацтеков
      const ambientEl = ambientRef.current;
      if (ambientEl && !ambientEl.paused) {
        ambientEl.pause();
      }
    }
  }, [isMusicOn]);

  return (
    <div className="game-container">
      {/* Единый контейнер для всех фоновых эффектов (песок, звёзды, светлячки) */}
      <div ref={effectsContainerRef} className="effects-container" />
      
      {/* Аудио для звуков */}
      <audio ref={spinSoundRef} src="./assets/audio/start.mp3" preload="auto" />
      <audio ref={stopSoundRef} src="./assets/audio/stop.mp3" preload="auto" />
      <audio ref={stopEgyptSoundRef} src="./assets/audio/stop_egypt.mp3" preload="auto" />
      <audio ref={musicRef} preload="auto" loop />
      <audio ref={eSoundRef} src="./assets/audio/e-sound.mp3" preload="auto" />
      <audio ref={cSoundRef} src="./assets/audio/c-sound.mp3" preload="auto" />
      <audio ref={bSoundRef} src="./assets/audio/b-sound.mp3" preload="auto" />
      <audio ref={fSoundRef} src="./assets/audio/f-sound.mp3" preload="auto" />
      <audio ref={barabanSoundRef} src="./assets/audio/baraban.mp3" preload="auto" />
      <audio ref={ambientRef} src="./assets/themes/aztec/primary.mp3" preload="auto" loop />
      
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
        winAmount={animatedWinAmount}
        isMusicOn={isMusicOn}
        onToggleMusic={handleToggleMusic}
        player={player}
        themeName={theme.name}
        onBackToLobby={handleBackToLobbyWithFullscreenExit}
        fps={fps}
      />
      
      {/* Обёртка слот-контейнера с оверлеем загрузки */}
      <div className="slot-container-wrapper">
        {/* Контейнер для слот-машины (Pixi.js) */}
        <div className="slot-container" ref={slotContainerRef}></div>
        
        {/* Панель ставки для мобильных (на нижней рамке слота) */}
        <div className="mobile-bet-panel">
          <span className="mobile-bet-label">СТАВКА:</span>
          <span className="mobile-bet-value">◎{bet}</span>
        </div>
        
        {/* Уведомление о активации фриспинов */}
        {showFreeSpinsNotification && (
          <div className="free-spins-overlay">
            <div className="free-spins-notification">
              <div className="free-spins-icon">🎰</div>
              <h2 className="free-spins-title">БЕСПЛАТНЫЕ ВРАЩЕНИЯ!</h2>
              <div className="free-spins-count-big">x{freeSpinsTriggeredCount}</div>
              <p className="free-spins-subtitle">Множитель x{freeSpinsMultiplier}</p>
              <button 
                className="free-spins-start-btn"
                onClick={() => {
                  setShowFreeSpinsNotification(false);
                  freeSpinsTriggerPendingRef.current = false;
                  // Запускаем первый фриспин
                  handleSpin(false);
                }}
              >
                НАЧАТЬ
              </button>
            </div>
          </div>
        )}

        {/* Уведомление о активации бонусной игры Dice Ladder */}
        {showBonusNotification && (
          <div className="free-spins-overlay">
            <div className="free-spins-notification">
              <div className="free-spins-icon">🎁</div>
              <h2 className="free-spins-title">БОНУС! ЛЕСТНИЦА УДАЧИ</h2>
              <div className="free-spins-count-big">x{bonusTriggeredCount} 🎲</div>
              <p className="free-spins-subtitle">Бесплатная бонусная игра</p>
              <button
                className="free-spins-start-btn"
                onClick={() => {
                  setShowBonusNotification(false);
                  setShowDiceLadder(true);
                }}
              >
                ИГРАТЬ
              </button>
            </div>
          </div>
        )}

        {/* Бонусная игра Dice Ladder */}
        {showDiceLadder && diceLadderData && (
          <DiceLadder
            bet={diceLadderData.bet}
            balance={diceLadderData.balance}
            levels={diceLadderData.levels}
            onClose={handleDiceLadderClose}
          />
        )}

        {/* Панель фриспинов (счётчик) */}
        {isFreeSpin && freeSpinsTotal > 0 && !showFreeSpinsNotification && (
          <div className="free-spins-panel">
            <div className="free-spins-panel-inner">
              <span className="free-spins-label">FREE SPINS</span>
              <span className="free-spins-counter">
                {freeSpinsRemaining}/{freeSpinsTotal}
              </span>
              <span className="free-spins-multiplier">x{freeSpinsMultiplier}</span>
            </div>
          </div>
        )}

        {/* Toast-уведомления о выигрышах — в правом верхнем углу, не блокируют экран */}
        {mobileWinData.map((toast, i) => (
          <div key={`${toast.symbol}-${toast.amount}-${i}`} className="win-toast" style={{ top: `${60 + i * 72}px` }}>
            <div className="win-toast-icon" style={{ borderColor: toast.rarityColor }}>
              <img 
                src={`${theme.assetsPath}/symbols/${toast.symbol.toLowerCase()}.svg`}
                alt={toast.symbol}
                className="win-toast-symbol-img"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src.endsWith('.svg')) {
                    img.src = `${theme.assetsPath}/symbols/${toast.symbol.toLowerCase()}.png`;
                  } else {
                    img.style.display = 'none';
                    const parent = img.parentElement;
                    if (parent) {
                      parent.textContent = toast.symbol;
                    }
                  }
                }}
              />
            </div>
            <div className="win-toast-info">
              <div className="win-toast-rarity" style={{ color: toast.rarityColor }}>
                {toast.rarity}
              </div>
              {toast.count >= 3 && (
                <div className="win-toast-combo">{toast.symbol} x{toast.count}</div>
              )}
              <div className="win-toast-amount">+{toast.amount.toLocaleString()} ◎</div>
            </div>
          </div>
        ))}

        {/* Модалка результатов фриспинов */}
        {showFreeSpinsResult && (
          <div className="free-spins-overlay">
            <div className="free-spins-notification">
              <div className="free-spins-icon">💰</div>
              <h2 className="free-spins-title">ФРИСПИНЫ ЗАВЕРШЕНЫ!</h2>
              <div className="free-spins-result-amount">+{freeSpinsTotalWin.toLocaleString()}</div>
              <p className="free-spins-subtitle">Выигрыш за все фриспины</p>
              <button 
                className="free-spins-start-btn"
                onClick={() => {
                  setShowFreeSpinsResult(false);
                  freeSpinsResultRef.current = false;
                  setFreeSpinsTotalWin(0);
                }}
              >
                ЗАБРАТЬ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Обёртка для панели управления с отступами */}
      <div className="controls-wrapper">
        {/* Основная панель управления */}
        <div className="main-controls">
        {/* Кнопка информации */}
        <button className="control-btn info-btn" title="Информация">
          <span>i</span>
        </button>

        {/* Кнопка уменьшения ставки */}
        <button 
          className="control-btn minus-btn"
          onClick={() => {
            const idx = BET_OPTIONS.indexOf(bet);
            const prevIdx = idx <= 0 ? BET_OPTIONS.length - 1 : idx - 1;
            setBet(BET_OPTIONS[prevIdx]);
          }}
          disabled={isSpinning || isAutoSpin || isFreeSpin}
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

        {/* Объединённая панель для мобильных - переключается между ставкой и выигрышем */}
        <div className={`info-display-panel-mobile ${showWinDisplay && winAmount > 0 ? 'has-win' : ''}`}>
          <div className="info-display-inner">
            {/* Контент ставки */}
            <div className={`balance-bet-content ${showWinDisplay ? 'hidden' : ''}`}>
              <div className="panel-row">
                <span className="panel-label">СТАВКА:</span>
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
        <div className="bet-menu-wrapper">
          <button 
            className="control-btn plus-btn"
            onClick={toggleBetMenu}
            disabled={isSpinning || isAutoSpin || isFreeSpin}
          >
            +
          </button>
          {showBetMenu && !isAutoSpin && (
            <div className="bet-menu">
              {BET_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`bet-option ${bet === option ? 'bet-option-active' : ''}`}
                  onClick={() => {
                    setBet(option);
                    setShowBetMenu(false);
                  }}
                  disabled={balance < option}
                >
                  ◎{option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Панель выигрыша (десктоп) */}
        <div className="win-panel">
          <span className="win-label">ВЫИГРЫШ:</span>
          <span className="win-value">◎{animatedWinAmount}</span>
        </div>

        {/* Макс. ставка */}
        <button 
          className="control-btn max-bet-btn"
          onClick={() => setBet(Math.min(2000, balance))}
          disabled={isSpinning || isAutoSpin}
          title="Максимальная ставка"
        >
          <svg className="max-bet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 11l5-5 5 5" />
            <path d="M7 17l5-5 5 5" />
          </svg>
        </button>

        {/* Главная кнопка СПИН */}
        <button
          className={`spin-btn ${isFreeSpin ? 'free-spin-btn' : ''}`}
          onClick={() => handleSpin(false)}
          disabled={(isSpinning || isAutoSpin) && !isFreeSpin}
        >
          {isFreeSpin && freeSpinsRemaining > 0 ? (
            <span className="spin-btn-content">
              <span className="spin-btn-label">FREE SPIN</span>
              <span className="spin-btn-sub">x{freeSpinsMultiplier}</span>
            </span>
          ) : isSpinning && !isProcessingMultiSpin && !isAutoSpin ? '...' : 'СПИН'}
        </button>

        {/* Автоспин */}
        <div className="autospin-wrapper">
          {isAutoSpin ? (
            <button
              className="control-btn autospin-active-btn"
              onClick={toggleAutoSpinMenu}
              title="Остановить автоспин"
            >
              <span className="autospin-count">{autoSpinCount}</span>
              <svg className="autospin-icon autospin-icon-stop" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              className="control-btn auto-btn"
              onClick={toggleAutoSpinMenu}
              disabled={isSpinning || balance < bet}
              title="Автоспин"
            >
              <svg className="autospin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
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

        {/* Кнопка тестового бонуса Dice Ladder (следующий спин гарантированно активирует бонус) */}
        <button
          className="control-btn bonus-test-btn"
          onClick={() => {
            testBonusRef.current = true;
            handleSpin(false); // сразу запускаем спин
          }}
          disabled={isSpinning || isAutoSpin || balance < bet}
          title="🎲 Test Bonus — следующий спин с бонусом"
        >
          🎲
        </button>
</div>
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
                <p><span className="font-bold">Фриспинов сыграно:</span> {stats.free_spins_played ?? 0}</p>
                <p><span className="font-bold">Частота выигрышей:</span> {(stats.win_frequency * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p><span className="font-bold">Самый большой выигрыш:</span> {stats.biggest_win}</p>
                <p><span className="font-bold">RTP:</span> {(stats.rtp * 100).toFixed(2)}%</p>
                <p><span className="font-bold">Триггеров Scatter:</span> {stats.scatter_triggers ?? 0}</p>
                <p><span className="font-bold">Триггеров Dice-бонуса:</span> {stats.bonus_triggers ?? 0}</p>
                <p><span className="font-bold">Виртуальный баланс:</span> {stats.balance}</p>
                <p className={stats.balance_change !== undefined && stats.balance_change >= 0 ? 'text-green-400' : 'text-red-400'}>
                  <span className="font-bold">Изменение:</span> {stats.balance_change !== undefined ? (stats.balance_change >= 0 ? '+' : '') + stats.balance_change : '—'}
                </p>
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

      {/**** Модальное окно уровня выигрыша ****/}
      {showWinModal && winModalData && (
        <WinModal
          isOpen={showWinModal}
          totalWin={winModalData.totalWin}
          bet={winModalData.bet}
          winningSymbols={winModalData.symbols}
          onCollect={() => {
            setShowWinModal(false);
            setWinModalData(null);
            // Вызываем сохранённый колбэк продолжения
            if (winModalCollectRef.current) {
              winModalCollectRef.current();
              winModalCollectRef.current = null;
            }
          }}
        />
      )}

      {/* Оверлей поворота экрана для мобильных устройств в портретном режиме */}
      {isPortrait && isMobileRef.current && theme.id === 'classic' && (
        <div className="orientation-overlay">
          <div className="orientation-overlay-content">
            <div className="orientation-icon">📱</div>
            <div className="orientation-arrow">↻</div>
            <p className="orientation-text">Поверните устройство</p>
            <p className="orientation-subtext">Для игры используйте альбомную ориентацию</p>
            
            {isIOSRef.current && !isStandaloneRef.current ? (
              <>
                {/* iOS без PWA — fullscreen API не работает, показываем инструкцию */}
                <div className="orientation-ios-info">
                  <p className="orientation-ios-text">
                    На iPhone полноэкранный режим доступен после добавления на главный экран:
                  </p>
                  <ol className="orientation-ios-steps">
                    <li>Нажмите <strong>Share</strong> (квадрат со стрелкой)</li>
                    <li>Выберите <strong>На экран «Домой»</strong></li>
                    <li>Запускайте игру с главного экрана</li>
                  </ol>
                </div>
              </>
            ) : (
              <>
                {/* Кнопка для автоматического переключения в landscape через fullscreen (Android) */}
                <button 
                  className="orientation-fullscreen-btn"
                  onClick={enterFullscreenAndLockOrientation}
                >
                  <span className="fullscreen-btn-icon">⛶</span>
                  <span>Полноэкранный режим</span>
                </button>
              </>
            )}
            <p className="orientation-hint">
              {isIOSRef.current && !isStandaloneRef.current
                ? 'Или включите автоповорот в настройках телефона'
                : 'Или включите автоповорот в настройках телефона'
              }
            </p>
          </div>
        </div>
      )}

      {/* Оверлей загрузки слот-машины — через portal в body, поверх всего экрана */}
      {isSlotLoading && createPortal(
        <div className="slot-loading-overlay">
          <div className="slot-loading-content">
            <div className="slot-loading-spinner">
              <div className="slot-loading-spinner-ring"></div>
              <div className="slot-loading-spinner-ring"></div>
              <div className="slot-loading-spinner-ring"></div>
            </div>
            <p className="slot-loading-text">Загрузка слота...</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SlotGame;
