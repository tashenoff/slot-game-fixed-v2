import React, { useState, useCallback, useEffect } from 'react';
import SlotGame from './components/SlotGame';
import SlotPreloader from './components/SlotPreloader';
import Lobby from './components/Lobby';
import { SlotTheme, loadTheme } from './config/themes';

interface PlayerInfo {
  name?: string;
  avatar?: string;
}

interface AppProps {
  initialBalance?: number;
  player?: PlayerInfo;
}

type AppView = 'lobby' | 'loading' | 'game';

function App({ initialBalance = 10000, player }: AppProps) {
  const [currentView, setCurrentView] = useState<AppView>('lobby'); // Начинаем с лобби
  const [selectedTheme, setSelectedTheme] = useState<SlotTheme | null>(null);
  const [pendingTheme, setPendingTheme] = useState<SlotTheme | null>(null); // Тема в процессе загрузки
  const [balance, setBalance] = useState<number>(initialBalance);

  // Обработчик выбора темы в лобби
  const handleSelectTheme = useCallback((theme: SlotTheme) => {
    // Устанавливаем тему как ожидающую и переходим к прелоадеру
    setPendingTheme(theme);
    setCurrentView('loading');
  }, []);

  // Обработчик завершения загрузки ассетов темы
  const handleLoadComplete = useCallback(() => {
    if (pendingTheme) {
      setSelectedTheme(pendingTheme);
      setPendingTheme(null);
      setCurrentView('game');
    }
  }, [pendingTheme]);

  // Обработчик ошибки загрузки
  const handleLoadError = useCallback((error: Error) => {
    console.error('Failed to load theme assets:', error);
    // При ошибке возвращаемся в лобби
    setPendingTheme(null);
    setCurrentView('lobby');
  }, []);

  // Функция выхода из полноэкранного режима и разблокировки ориентации
  const exitFullscreenAndUnlockOrientation = useCallback(async () => {
    // Выходим из полноэкранного режима если он активен
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (isCurrentlyFullscreen) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      } catch (e) {
        console.log('Не удалось выйти из полноэкранного режима:', e);
      }
    }

    // Разблокируем ориентацию (в лобби должна быть вертикальная)
    try {
      if (screen.orientation && typeof screen.orientation.unlock === 'function') {
        screen.orientation.unlock();
      }
    } catch (e) {
      // API может быть недоступен
    }
  }, []);

  // Обработчик возврата в лобби
  const handleBackToLobby = useCallback(async () => {
    await exitFullscreenAndUnlockOrientation();
    setCurrentView('lobby');
  }, [exitFullscreenAndUnlockOrientation]);

  // Обработчик изменения баланса (для синхронизации)
  const handleBalanceChange = useCallback((newBalance: number) => {
    setBalance(newBalance);
  }, []);

  // Обработка кнопки "назад" браузера и телефона - возврат в лобби
  useEffect(() => {
    // Добавляем запись в историю при входе в игру
    if (currentView === 'game') {
      window.history.pushState({ view: 'game' }, '');
    }

    // Обработчик события "назад" браузера (работает и для Android back button в WebView)
    const handlePopState = async (event: PopStateEvent) => {
      // Если мы в игре, возвращаемся в лобби
      if (currentView === 'game') {
        event.preventDefault();
        await exitFullscreenAndUnlockOrientation();
        setCurrentView('lobby');
      }
    };

    // Обработчик для Cordova/Capacitor backbutton (Android hardware back button)
    const handleBackButton = async (event: Event) => {
      if (currentView === 'game') {
        event.preventDefault();
        await exitFullscreenAndUnlockOrientation();
        setCurrentView('lobby');
      }
    };

    // Обработчик клавиши Escape (для десктопа) и Back (KeyCode 27 на некоторых устройствах)
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Escape или Android Back (код 4 в некоторых WebView)
      if ((event.key === 'Escape' || event.keyCode === 27 || event.keyCode === 4) && currentView === 'game') {
        event.preventDefault();
        await exitFullscreenAndUnlockOrientation();
        setCurrentView('lobby');
      }
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('backbutton', handleBackButton); // Cordova/Capacitor
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('backbutton', handleBackButton);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentView, exitFullscreenAndUnlockOrientation]);

  // Рендер текущего представления
  const renderCurrentView = () => {
    // Показываем прелоадер если есть ожидающая тема
    if (currentView === 'loading' && pendingTheme) {
      return (
        <SlotPreloader
          theme={pendingTheme}
          onLoadComplete={handleLoadComplete}
          onLoadError={handleLoadError}
        />
      );
    }

    // Показываем игру если есть выбранная тема
    if (currentView === 'game' && selectedTheme) {
      return (
        <SlotGame 
          initialBalance={balance} 
          player={player}
          theme={selectedTheme}
          onBackToLobby={handleBackToLobby}
          onBalanceChange={handleBalanceChange}
        />
      );
    }

    // По умолчанию показываем лобби
    return (
      <Lobby 
        player={player} 
        balance={balance}
        onSelectTheme={handleSelectTheme} 
      />
    );
  };

  return (
    <div className="App min-h-screen text-white">
      {renderCurrentView()}
    </div>
  );
}

export default App;
