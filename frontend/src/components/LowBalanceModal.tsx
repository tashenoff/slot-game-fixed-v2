import React, { useState } from 'react';
import Modal from './Modal';
import { platformManager } from '../platform';

interface LowBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardReceived: (amount: number) => void;
  currentBalance: number;
}

/**
 * Модальное окно для низкого баланса.
 * Предлагает посмотреть рекламу за 1000 монет.
 */
const LowBalanceModal: React.FC<LowBalanceModalProps> = ({
  isOpen,
  onClose,
  onRewardReceived,
  currentBalance,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWatchAd = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Показываем rewarded рекламу через платформу
      const rewarded = await platformManager.showRewardedAd();

      if (rewarded) {
        // Реклама просмотрена — начисляем награду
        onRewardReceived(1000);
        onClose();
      } else {
        // Пользователь закрыл рекламу раньше времени
        setError('Просмотрите рекламу полностью, чтобы получить награду');
      }
    } catch (err) {
      console.error('[LowBalanceModal] Ошибка показа рекламы:', err);
      setError('Не удалось загрузить рекламу. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💰 Закончились монеты?">
      <div className="low-balance-modal-content">
        <div className="low-balance-icon">
          <span role="img" aria-label="coins">🪙</span>
        </div>
        
        <p className="low-balance-text">
          Ваш баланс: <strong>{currentBalance}</strong> монет
        </p>
        
        <p className="low-balance-description">
          Посмотрите короткое видео и получите <strong className="reward-amount">1000 монет</strong> бесплатно!
        </p>

        {error && (
          <p className="low-balance-error">{error}</p>
        )}

        <div className="low-balance-buttons">
          <button
            className="btn-watch-ad"
            onClick={handleWatchAd}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Загрузка...
              </>
            ) : (
              <>
                <span role="img" aria-label="play">▶️</span>
                Смотреть рекламу
              </>
            )}
          </button>
          
          <button
            className="btn-close-modal"
            onClick={onClose}
            disabled={isLoading}
          >
            Позже
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LowBalanceModal;
