import React, { useEffect, useState, useCallback } from 'react';
import { SlotTheme, preloadThemeAssets, PreloadProgress } from '../config/themes';

interface SlotPreloaderProps {
  theme: SlotTheme;
  onLoadComplete: () => void;
  onLoadError?: (error: Error) => void;
}

/**
 * Прелоадер для загрузки ассетов тематического слота
 * Показывает прогресс загрузки с анимацией в стиле казино
 */
const SlotPreloader: React.FC<SlotPreloaderProps> = ({ 
  theme, 
  onLoadComplete,
  onLoadError 
}) => {
  const [progress, setProgress] = useState<PreloadProgress>({
    loaded: 0,
    total: 0,
    percent: 0,
    currentAsset: '',
  });
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Колбэк для обновления прогресса
  const handleProgress = useCallback((p: PreloadProgress) => {
    setProgress(p);
  }, []);

  // Запуск прелоада при монтировании
  useEffect(() => {
    let isMounted = true;

    const loadAssets = async () => {
      try {
        await preloadThemeAssets(theme, handleProgress);
        
        if (isMounted) {
          setIsComplete(true);
          // Небольшая задержка перед переходом для плавности
          setTimeout(() => {
            if (isMounted) {
              onLoadComplete();
            }
          }, 500);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки';
          setError(errorMessage);
          onLoadError?.(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    };

    loadAssets();

    return () => {
      isMounted = false;
    };
  }, [theme, handleProgress, onLoadComplete, onLoadError]);

  return (
    <div 
      className="slot-preloader"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.8)), url(${theme.preview})`,
      }}
    >
      <div className="preloader-content">
        {/* Логотип/Превью темы */}
        <div className="preloader-logo">
          <img 
            src={theme.preview} 
            alt={theme.name}
            className="preloader-preview-image"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Название темы */}
        <h2 className="preloader-title">{theme.name}</h2>
        <p className="preloader-description">{theme.description}</p>

        {/* Прогресс-бар */}
        {!error ? (
          <div className="preloader-progress-container">
            <div className="preloader-progress-bar">
              <div 
                className="preloader-progress-fill"
                style={{ width: `${progress.percent}%` }}
              />
              {/* Анимированные искры на прогресс-баре */}
              <div 
                className="preloader-progress-shine"
                style={{ left: `${Math.min(progress.percent, 95)}%` }}
              />
            </div>
            
            <div className="preloader-progress-info">
              <span className="preloader-progress-text">
                {isComplete ? 'Готово!' : `Загрузка... ${progress.percent}%`}
              </span>
              {progress.currentAsset && !isComplete && (
                <span className="preloader-current-asset">
                  {progress.currentAsset}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="preloader-error">
            <span className="preloader-error-icon">⚠️</span>
            <p className="preloader-error-text">{error}</p>
            <button 
              className="preloader-retry-btn"
              onClick={() => window.location.reload()}
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* Анимированные элементы казино */}
        <div className="preloader-decorations">
          <div className="preloader-slot-icon preloader-slot-icon-1">🎰</div>
          <div className="preloader-slot-icon preloader-slot-icon-2">💎</div>
          <div className="preloader-slot-icon preloader-slot-icon-3">🍀</div>
          <div className="preloader-slot-icon preloader-slot-icon-4">⭐</div>
        </div>
      </div>

      {/* Спиннер загрузки */}
      {!isComplete && !error && (
        <div className="preloader-spinner-container">
          <div className="preloader-spinner">
            <div className="preloader-spinner-segment"></div>
            <div className="preloader-spinner-segment"></div>
            <div className="preloader-spinner-segment"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotPreloader;
