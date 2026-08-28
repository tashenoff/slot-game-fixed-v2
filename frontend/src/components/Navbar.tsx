import React, { useState } from 'react';

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
  winAmount?: number;
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
  winAmount = 0,
  isMusicOn,
  onToggleMusic,
  player,
  themeName,
  onBackToLobby,
  fps,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

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
            ←
          </button>
        )}
        <span className="navbar-logo">🎰</span>
        <span className="navbar-title">{themeName || 'SLOT GAME'}</span>
        {/* Баланс и выигрыш в навбаре для мобильной версии (ставка показывается отдельно внизу) */}
        <div className="navbar-info-mobile">
          <span className="navbar-info-item">
            <span className="navbar-info-label">БАЛАНС:</span>
            <span className="navbar-info-value">◎{balance.toLocaleString()}</span>
          </span>
          <span className="navbar-info-divider">|</span>
          <span className={`navbar-info-item navbar-win-item ${winAmount > 0 ? 'has-win' : ''}`}>
            <span className="navbar-info-label">ВЫИГРЫШ:</span>
            <span className={`navbar-info-value navbar-win-value ${winAmount > 0 ? 'has-win' : ''}`}>◎{winAmount.toLocaleString()}</span>
          </span>
        </div>
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

      {/* Десктопные кнопки */}
      <div className="navbar-actions navbar-actions-desktop">
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

      {/* Гамбургер меню для мобильных */}
      <div className="navbar-mobile-menu">
        <button 
          className="navbar-hamburger"
          onClick={toggleMenu}
          aria-label="Меню"
        >
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
        </button>

        {/* Выпадающее меню */}
        {isMenuOpen && (
          <>
            <div className="navbar-menu-overlay" onClick={closeMenu}></div>
            <div className="navbar-dropdown">
              <button
                className={`navbar-dropdown-item ${isMusicOn ? '' : 'active'}`}
                onClick={() => { onToggleMusic(); closeMenu(); }}
              >
                {isMusicOn ? '🔊 Выключить звук' : '🔇 Включить звук'}
              </button>
              <button
                className="navbar-dropdown-item"
                onClick={() => { onResetBalance(); closeMenu(); }}
                disabled={isSpinning || isAutoSpin}
              >
                💰 Сбросить баланс
              </button>
              <button
                className="navbar-dropdown-item"
                onClick={() => { onMultiSpin(); closeMenu(); }}
                disabled={isSpinning || balance < bet || isAutoSpin}
              >
                🎲 {isProcessingMultiSpin ? `${multiSpinProgress}%` : '1000 спинов'}
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;