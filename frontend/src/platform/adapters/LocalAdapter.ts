import { IPlatformAdapter, IPlayerInfo } from '../IPlatformAdapter';

/**
 * Адаптер для локальной разработки и собственного сайта
 * Не требует внешних SDK, эмулирует поведение платформы
 */
export class LocalAdapter implements IPlatformAdapter {
  readonly platformName = 'local';
  
  private playerId: string | null = null;

  async init(): Promise<void> {
    console.log('[LocalAdapter] Инициализация локального адаптера');
    
    // Генерируем или восстанавливаем ID игрока из localStorage
    let id = localStorage.getItem('local_player_id');
    if (!id) {
      id = 'local_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('local_player_id', id);
      console.log('[LocalAdapter] Создан новый player_id:', id);
    } else {
      console.log('[LocalAdapter] Восстановлен player_id:', id);
    }
    this.playerId = id;
  }

  async getPlayer(): Promise<IPlayerInfo> {
    if (!this.playerId) {
      throw new Error('LocalAdapter не инициализирован. Вызовите init() сначала.');
    }
    
    return {
      id: this.playerId,
      name: 'Игрок',
      avatar: undefined,
    };
  }

  async showRewardedAd(): Promise<boolean> {
    console.log('[LocalAdapter] Симуляция rewarded рекламы');
    
    // В режиме разработки показываем диалог для тестирования
    if (import.meta.env.DEV) {
      return new Promise((resolve) => {
        const result = window.confirm(
          '🎬 Симуляция рекламы с вознаграждением\n\n' +
          'Нажмите OK — реклама досмотрена (награда)\n' +
          'Нажмите Отмена — реклама пропущена'
        );
        resolve(result);
      });
    }
    
    // В production на своём сайте — можно интегрировать свою рекламу
    // или всегда возвращать true для тестов
    return true;
  }

  async showInterstitialAd(): Promise<void> {
    console.log('[LocalAdapter] Симуляция interstitial рекламы');
    
    if (import.meta.env.DEV) {
      window.alert('📺 Симуляция межстраничной рекламы');
    }
  }

  gameReady(): void {
    console.log('[LocalAdapter] Игра готова');
  }

  async canShowAd(): Promise<boolean> {
    // В локальном режиме всегда можно показать рекламу
    return true;
  }

  trackEvent(eventName: string, data?: Record<string, unknown>): void {
    console.log('[LocalAdapter] Event:', eventName, data);
  }
}
