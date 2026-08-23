import { IPlatformAdapter, IPlayerInfo } from '../IPlatformAdapter';

/**
 * Типы для VK Bridge
 * Документация: https://dev.vk.com/ru/bridge/overview
 */
declare global {
  interface Window {
    vkBridge?: VKBridge;
  }
}

interface VKBridge {
  send<T extends keyof VKBridgeMethods>(
    method: T,
    params?: VKBridgeMethods[T]['params']
  ): Promise<VKBridgeMethods[T]['result']>;
  subscribe(callback: (event: VKBridgeEvent) => void): void;
}

interface VKBridgeMethods {
  'VKWebAppInit': { params?: undefined; result: { result: boolean } };
  'VKWebAppGetUserInfo': { 
    params?: undefined; 
    result: { 
      id: number; 
      first_name: string; 
      last_name: string;
      photo_100: string;
      photo_200: string;
    } 
  };
  'VKWebAppShowNativeAds': { 
    params: { ad_format: 'interstitial' | 'reward' }; 
    result: { result: boolean } 
  };
  'VKWebAppCheckNativeAds': {
    params: { ad_format: 'interstitial' | 'reward' };
    result: { result: boolean };
  };
}

interface VKBridgeEvent {
  detail: {
    type: string;
    data: unknown;
  };
}

/**
 * Адаптер для VK Games / VK Mini Apps
 * Документация: https://dev.vk.com/ru/mini-apps/overview
 */
export class VKAdapter implements IPlatformAdapter {
  readonly platformName = 'vk';
  
  private bridge: VKBridge | null = null;
  private userInfo: VKBridgeMethods['VKWebAppGetUserInfo']['result'] | null = null;

  async init(): Promise<void> {
    console.log('[VKAdapter] Инициализация VK Bridge...');
    
    if (!window.vkBridge) {
      throw new Error('VK Bridge не загружен. Добавьте скрипт в index.html');
    }
    
    this.bridge = window.vkBridge;
    
    try {
      // Инициализируем VK Mini App
      await this.bridge.send('VKWebAppInit');
      console.log('[VKAdapter] VK Bridge инициализирован');
      
      // Получаем информацию о пользователе
      this.userInfo = await this.bridge.send('VKWebAppGetUserInfo');
      console.log('[VKAdapter] Пользователь:', this.userInfo.first_name);
    } catch (error) {
      console.error('[VKAdapter] Ошибка инициализации:', error);
      throw error;
    }
  }

  async getPlayer(): Promise<IPlayerInfo> {
    if (!this.userInfo) {
      throw new Error('VKAdapter не инициализирован');
    }
    
    return {
      id: this.userInfo.id.toString(),
      name: `${this.userInfo.first_name} ${this.userInfo.last_name}`.trim(),
      avatar: this.userInfo.photo_200 || this.userInfo.photo_100 || undefined,
    };
  }

  async showRewardedAd(): Promise<boolean> {
    if (!this.bridge) {
      console.error('[VKAdapter] Bridge не инициализирован');
      return false;
    }
    
    try {
      console.log('[VKAdapter] Показываем rewarded рекламу...');
      const result = await this.bridge.send('VKWebAppShowNativeAds', {
        ad_format: 'reward',
      });
      console.log('[VKAdapter] Rewarded результат:', result);
      return result.result;
    } catch (error) {
      console.error('[VKAdapter] Ошибка rewarded рекламы:', error);
      return false;
    }
  }

  async showInterstitialAd(): Promise<void> {
    if (!this.bridge) {
      console.error('[VKAdapter] Bridge не инициализирован');
      return;
    }
    
    try {
      console.log('[VKAdapter] Показываем interstitial рекламу...');
      await this.bridge.send('VKWebAppShowNativeAds', {
        ad_format: 'interstitial',
      });
      console.log('[VKAdapter] Interstitial показана');
    } catch (error) {
      console.error('[VKAdapter] Ошибка interstitial:', error);
    }
  }

  gameReady(): void {
    console.log('[VKAdapter] Игра готова');
    // VK не требует явного вызова "игра готова"
  }

  async canShowAd(): Promise<boolean> {
    if (!this.bridge) return false;
    
    try {
      // Проверяем доступность rewarded рекламы
      const result = await this.bridge.send('VKWebAppCheckNativeAds', {
        ad_format: 'reward',
      });
      return result.result;
    } catch (error) {
      console.error('[VKAdapter] Ошибка проверки рекламы:', error);
      return false;
    }
  }

  trackEvent(eventName: string, data?: Record<string, unknown>): void {
    console.log('[VKAdapter] Event:', eventName, data);
    // Можно интегрировать VK Analytics
  }
}
