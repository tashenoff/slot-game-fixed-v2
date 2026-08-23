import { IPlatformAdapter, IPlayerInfo, IEnvironment } from '../IPlatformAdapter';

/**
 * Типы для Yandex Games SDK
 * Документация: https://yandex.ru/dev/games/doc/ru/
 */
declare global {
  interface Window {
    YaGames?: {
      init(): Promise<YandexSDK>;
    };
  }
}

interface YandexSDK {
  getPlayer(options?: { scopes?: boolean }): Promise<YandexPlayer>;
  environment: {
    i18n: {
      lang: string;  // 'ru', 'en', 'tr', etc.
      tld: string;   // 'ru', 'com', etc.
    };
  };
  adv: {
    showFullscreenAdv(params: {
      callbacks: {
        onOpen?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (error: Error) => void;
        onOffline?: () => void;
      };
    }): void;
    showRewardedVideo(params: {
      callbacks: {
        onOpen?: () => void;
        onClose?: () => void;
        onRewarded?: () => void;
        onError?: (error: Error) => void;
      };
    }): void;
  };
  features?: {
    LoadingAPI?: {
      ready(): void;
    };
  };
}

interface YandexPlayer {
  getUniqueID(): string;
  getName(): string;
  getPhoto(size: 'small' | 'medium' | 'large'): string;
  getMode(): 'lite' | '';
}

const YANDEX_SDK_URL = 'https://yandex.ru/games/sdk/v2';

/**
 * Динамическая загрузка Yandex SDK
 */
function loadYandexSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Если SDK уже загружен
    if (window.YaGames) {
      resolve();
      return;
    }
    
    // Проверяем, не загружается ли уже скрипт
    const existingScript = document.querySelector(`script[src="${YANDEX_SDK_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Не удалось загрузить Yandex SDK')));
      return;
    }
    
    // Создаём и добавляем скрипт
    const script = document.createElement('script');
    script.src = YANDEX_SDK_URL;
    script.async = true;
    
    script.onload = () => {
      console.log('[YandexAdapter] SDK скрипт загружен');
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error('Не удалось загрузить Yandex Games SDK'));
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Адаптер для Яндекс.Игры
 */
export class YandexAdapter implements IPlatformAdapter {
  readonly platformName = 'yandex';
  
  private ysdk: YandexSDK | null = null;
  private player: YandexPlayer | null = null;
  private lang: string = 'ru';

  async init(): Promise<void> {
    console.log('[YandexAdapter] Инициализация Yandex Games SDK...');
    
    // Динамически загружаем SDK если его нет
    await loadYandexSDK();
    
    if (!window.YaGames) {
      throw new Error('Yandex Games SDK не загружен');
    }
    
    this.ysdk = await window.YaGames.init();
    console.log('[YandexAdapter] SDK инициализирован');
    
    // Получаем язык из SDK (требование п. 2.14)
    this.lang = this.ysdk.environment.i18n.lang;
    console.log('[YandexAdapter] Язык пользователя:', this.lang);
    
    // scopes: false — не запрашиваем доступ к персональным данным
    this.player = await this.ysdk.getPlayer({ scopes: false });
    console.log('[YandexAdapter] Игрок получен, ID:', this.player.getUniqueID());
  }

  async getPlayer(): Promise<IPlayerInfo> {
    if (!this.player) throw new Error('YandexAdapter не инициализирован');
    
    const isLite = this.player.getMode() === 'lite';
    return {
      id: this.player.getUniqueID(),
      name: isLite ? 'Игрок' : (this.player.getName() || 'Игрок'),
      avatar: isLite ? undefined : this.player.getPhoto('medium') || undefined,
    };
  }

  async showRewardedAd(): Promise<boolean> {
    if (!this.ysdk) return false;
    
    return new Promise((resolve) => {
      let rewarded = false;
      this.ysdk!.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => { rewarded = true; },
          onClose: () => resolve(rewarded),
          onError: () => resolve(false),
        },
      });
    });
  }

  async showInterstitialAd(): Promise<void> {
    if (!this.ysdk) return;
    
    return new Promise((resolve) => {
      this.ysdk!.adv.showFullscreenAdv({
        callbacks: {
          onClose: () => resolve(),
          onError: () => resolve(),
          onOffline: () => resolve(),
        },
      });
    });
  }

  gameReady(): void {
    this.ysdk?.features?.LoadingAPI?.ready();
  }

  async canShowAd(): Promise<boolean> {
    return true;
  }

  getEnvironment(): IEnvironment {
    return {
      lang: this.lang
    };
  }

  trackEvent(eventName: string, data?: Record<string, unknown>): void {
    console.log('[YandexAdapter] Event:', eventName, data);
  }
}
