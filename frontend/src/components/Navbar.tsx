import React from 'react';

interface PlayerInfo {
  name?: string;
  avatar?: string;
}

interface NavbarProps {
  onResetBalance: () => void;
  onMultiSpin: () => void;
  onShowHistory: () => void;
  isSpinning: boolean;
  isAutoSpin: boolean;
  isProcessingMultiSpin: boolean;
  multiSpinProgress: number;
  balance: number;
  bet: number;
  isMusicOn: boolean;
  onToggleMusic: () => void;
  player?: PlayerInfo;
  themeName?: string;
  onBackToLobby?: () => void;
  fps?: number;
}

const Navbar: React.FC<NavbarProps> = ({
  onResetBalance,
  onMultiSpin,
  onShowHistory,
  isSpinning,
  isAutoSpin,
  isProcessingMultiSpin,
  multiSpinProgress,
  balance,
  bet,
  isMusicOn,
  onToggleMusic,
  player,
  themeName,
  onBackToLobby,
  fps,
}) => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        {onBackToLobby && (
          <button 
            className="navbar-btn navbar-btn-back"
            onClick={onBackToLobby}
            disabled={isSpinning || isAutoSpin}
            title="Вернуться в лобби"
          >
            ← Лобби
          </button>
        )}
        <span className="navbar-logo">🎰</span>
        <span className="navbar-title">{themeName || 'SLOT GAME'}</span>
        {fps !== undefined && (
          <span 
            className="navbar-fps" 
            style={{ 
              marginLeft: '12px',
              padding: '2px 8px',
              backgroundColor: fps >= 50 ? 'rgba(34, 197, 94, 0.3)' : fps >= 30 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: fps >= 50 ? '#22c55e' : fps >= 30 ? '#eab308' : '#ef4444',
            }}
            title="Frames Per Second"
          >
            {Math.round(fps)} FPS
          </span>
        )}
      </div>
      
      {/* Информация о игроке */}
      {player && (
        <div className="navbar-player">
          {player.avatar ? (
            <img 
              src={player.avatar} 
              alt={player.name || 'Игрок'} 
              className="navbar-player-avatar"
            />
          ) : (
            <div className="navbar-player-avatar navbar-player-avatar-default">
              👤
            </div>
          )}
          <span className="navbar-player-name">{player.name || 'Игрок'}</span>
        </div>
      )}
      <div className="navbar-actions">
        <button
          className={`navbar-btn navbar-btn-music ${isMusicOn ? 'music-on' : 'music-off'}`}
          onClick={onToggleMusic}
          title={isMusicOn ? 'Выключить музыку' : 'Включить музыку'}
        >
          {isMusicOn ? '🔊' : '🔇'}
        </button>
        <button
          className="navbar-btn navbar-btn-history"
          onClick={onShowHistory}
        >
          История
        </button>
        <button
          className="navbar-btn navbar-btn-reset"
          onClick={onResetBalance}
          disabled={isSpinning || isAutoSpin}
        >
          Сбросить баланс
        </button>
        <button
          className="navbar-btn navbar-btn-spins"
          onClick={onMultiSpin}
          disabled={isSpinning || balance < bet || isAutoSpin}
        >
          {isProcessingMultiSpin ? `${multiSpinProgress}%` : '1000 спинов'}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;