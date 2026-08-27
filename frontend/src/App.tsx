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

  // Обработчик возврата в лобби
  const handleBackToLobby = useCallback(() => {
    setCurrentView('lobby');
  }, []);

  // Обработчик изменения баланса (для синхронизации)
  const handleBalanceChange = useCallback((newBalance: number) => {
    setBalance(newBalance);
  }, []);

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
