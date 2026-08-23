import React from 'react';
import SlotGame from './components/SlotGame';

interface AppProps {
  initialBalance?: number;
}

function App({ initialBalance }: AppProps) {
  return (
    <div className="App min-h-screen text-white">
      <SlotGame initialBalance={initialBalance} />
    </div>
  );
}

export default App;
