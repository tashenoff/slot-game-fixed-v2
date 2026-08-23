import React from 'react';
import SlotGame from './components/SlotGame';

interface PlayerInfo {
  name?: string;
  avatar?: string;
}

interface AppProps {
  initialBalance?: number;
  player?: PlayerInfo;
}

function App({ initialBalance, player }: AppProps) {
  return (
    <div className="App min-h-screen text-white">
      <SlotGame initialBalance={initialBalance} player={player} />
    </div>
  );
}

export default App;
