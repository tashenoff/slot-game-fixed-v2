import React, { useState, useCallback, useEffect } from 'react';
import SlotGame from './components/SlotGame';
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

type AppView = 'lobby' | 'game';

function App({ initialBalance = 10000, player }: AppProps) {
  const [currentView, setCurrentView] = useState<AppView>('game'); // Сразу в игру
  const [selectedTheme, setSelectedTheme] = useState<SlotTheme | null>(null);
  const [balance, setBalance] = useState<number>(initialBalance);

  // Автозагрузка египетской темы при старте
  useEffect(() => {
    loadTheme('egypt').then(theme => {
      if (theme) {
        setSelectedTheme(theme);
      }
    });
  }, []);

  // Обработчик выбора темы в лобби
  const handleSelectTheme = useCallback((theme: SlotTheme) => {
    setSelectedTheme(theme);
    setCurrentView('game');
  }, []);

  // Обработчик возврата в лобби
  const handleBackToLobby = useCallback(() => {
    setCurrentView('lobby');
  }, []);

  // Обработчик изменения баланса (для синхронизации)
  const handleBalanceChange = useCallback((newBalance: number) => {
    setBalance(newBalance);
  }, []);

  return (
    <div className="App min-h-screen text-white">
      {currentView === 'lobby' || !selectedTheme ? (
        <Lobby 
          player={player} 
          balance={balance}
          onSelectTheme={handleSelectTheme} 
        />
      ) : (
        <SlotGame 
          initialBalance={balance} 
          player={player}
          theme={selectedTheme}
          onBackToLobby={handleBackToLobby}
          onBalanceChange={handleBalanceChange}
        />
      )}
    </div>
  );
}

export default App;
