import React, { useEffect, useState } from 'react';
import { SlotTheme, loadAllThemes } from '../config/themes';

// Добавляем класс для body при монтировании лобби
const useLobbyBodyClass = () => {
  useEffect(() => {
    document.body.classList.add('in-lobby');
    document.body.classList.remove('in-game');
    return () => {
      document.body.classList.remove('in-lobby');
    };
  }, []);
};

interface PlayerInfo {
  name?: string;
  avatar?: string;
}

interface LobbyProps {
  player?: PlayerInfo;
  balance: number;
  onSelectTheme: (theme: SlotTheme) => void;
}

const Lobby: React.FC<LobbyProps> = ({ player, balance, onSelectTheme }) => {
  const [themes, setThemes] = useState<SlotTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Добавляем класс для body (разрешаем скролл)
  useLobbyBodyClass();

  // Загрузка тем при монтировании
  useEffect(() => {
    loadAllThemes()
      .then(loadedThemes => {
        setThemes(loadedThemes);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load themes:', err);
        setError('Не удалось загрузить игры');
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="lobby-container lobby-loading">
        <div className="lobby-spinner"></div>
        <p>Загрузка игр...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lobby-container lobby-error">
        <p>❌ {error}</p>
        <button onClick={() => window.location.reload()}>Перезагрузить</button>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      {/* Заголовок лобби */}
      <header className="lobby-header">
        <div className="lobby-header-content">
          <div className="lobby-player-info">
            {player?.avatar ? (
              <img 
                src={player.avatar} 
                alt={player.name || 'Player'} 
                className="lobby-avatar"
              />
            ) : (
              <div className="lobby-avatar lobby-avatar-placeholder">👤</div>
            )}
            <div className="lobby-player-details">
              <span className="lobby-player-name">{player?.name || 'Гость'}</span>
              <span className="lobby-balance">💰 {balance.toLocaleString()}</span>
            </div>
          </div>
          <h1 className="lobby-title">🎰 Казино Слотов</h1>
        </div>
      </header>

      {/* Сетка слотов */}
      <main className="lobby-main">
        <h2 className="lobby-section-title">Выберите игру</h2>
        <div className="slots-grid">
          {themes.map((theme) => (
            <div
              key={theme.id}
              className={`slot-card ${theme.isLocked ? 'slot-card-locked' : ''}`}
              onClick={() => !theme.isLocked && onSelectTheme(theme)}
            >
              {/* Превью слота */}
              <div className="slot-card-preview">
                <img
                  src={theme.preview}
                  alt={theme.name}
                  className="slot-card-image"
                  onError={(e) => {
                    // Fallback если превью не загрузилось
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,' + encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
                        <rect fill="#1a1a2e" width="300" height="200"/>
                        <text x="150" y="100" text-anchor="middle" fill="#ffd700" font-size="48">🎰</text>
                        <text x="150" y="140" text-anchor="middle" fill="#fff" font-size="16">${theme.name}</text>
                      </svg>
                    `);
                  }}
                />
                
                {/* Бейджи */}
                {theme.isNew && <span className="slot-badge slot-badge-new">NEW</span>}
                {theme.isHot && <span className="slot-badge slot-badge-hot">🔥 HOT</span>}
                {theme.isLocked && (
                  <div className="slot-locked-overlay">
                    <span className="slot-locked-icon">🔒</span>
                    <span className="slot-locked-text">Скоро</span>
                  </div>
                )}
              </div>

              {/* Информация о слоте */}
              <div className="slot-card-info">
                <h3 className="slot-card-title">{theme.name}</h3>
                <p className="slot-card-description">{theme.description}</p>
              </div>

              {/* Кнопка играть */}
              {!theme.isLocked && (
                <button className="slot-card-play-btn">
                  ▶ ИГРАТЬ
                </button>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Футер */}
      <footer className="lobby-footer">
        <p>© 2024 Казино Слотов. Играйте ответственно! 18+</p>
      </footer>
    </div>
  );
};

export default Lobby;
