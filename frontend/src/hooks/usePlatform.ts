import { useState, useEffect, useCallback } from 'react';
import { platformManager, IPlatformAdapter, IPlayerInfo, PlatformType } from '../platform';

interface UsePlatformResult {
  /** Платформа инициализирована */
  isReady: boolean;
  /** Ошибка инициализации */
  error: Error | null;
  /** Название текущей платформы */
  platformName: PlatformType | null;
  /** Информация об игроке */
  player: IPlayerInfo | null;
  /** Адаптер платформы (для прямого доступа) */
  platform: IPlatformAdapter | null;
  /** Показать рекламу с наградой */
  showRewardedAd: () => Promise<boolean>;
  /** Показать межстраничную рекламу */
  showInterstitialAd: () => Promise<void>;
}

/**
 * React хук для работы с платформой
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isReady, player, showRewardedAd } = usePlatform();
 *   
 *   if (!isReady) return <Loading />;
 *   
 *   const handleWatchAd = async () => {
 *     const rewarded = await showRewardedAd();
 *     if (rewarded) {
 *       // Начислить награду
 *     }
 *   };
 *   
 *   return <div>Привет, {player?.name}!</div>;
 * }
 * ```
 */
export function usePlatform(): UsePlatformResult {
  const [isReady, setIsReady] = useState(platformManager.isInitialized());
  const [error, setError] = useState<Error | null>(null);
  const [player, setPlayer] = useState<IPlayerInfo | null>(
    platformManager.isInitialized() ? platformManager.getPlayer() : null
  );

  useEffect(() => {
    // Если уже инициализирован — не инициализируем повторно
    if (platformManager.isInitialized()) {
      setIsReady(true);
      setPlayer(platformManager.getPlayer());
      return;
    }

    let cancelled = false;

    const initPlatform = async () => {
      try {
        await platformManager.init();
        if (!cancelled) {
          setPlayer(platformManager.getPlayer());
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      }
    };

    initPlatform();

    return () => {
      cancelled = true;
    };
  }, []);

  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    if (!platformManager.isInitialized()) return false;
    return platformManager.showRewardedAd();
  }, []);

  const showInterstitialAd = useCallback(async (): Promise<void> => {
    if (!platformManager.isInitialized()) return;
    return platformManager.showInterstitialAd();
  }, []);

  return {
    isReady,
    error,
    platformName: platformManager.getPlatformName(),
    player,
    platform: isReady ? platformManager.get() : null,
    showRewardedAd,
    showInterstitialAd,
  };
}

export default usePlatform;
