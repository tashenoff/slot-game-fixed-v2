import { IPlatformAdapter, IPlayerInfo } from './IPlatformAdapter';
import { LocalAdapter } from './adapters/LocalAdapter';
import { YandexAdapter } from './adapters/YandexAdapter';
import { VKAdapter } from './adapters/VKAdapter';

export type PlatformType = 'yandex' | 'vk' | 'crazygames' | 'local';

export interface PlatformConfig {
  forcePlatform?: PlatformType;
  onInit?: (platform: IPlatformAdapter, player: IPlayerInfo) => void;
  onError?: (error: Error) => void;
}

/**
 * PlatformManager — синглтон для управления платформенными SDK
 */
class PlatformManager {
  private adapter: IPlatformAdapter | null = null;
  private playerInfo: IPlayerInfo | null = null;
  private initialized = false;
  private initPromise: Promise<IPlatformAdapter> | null = null;

  /** Автоматическое определение платформы */
  detectPlatform(): PlatformType {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('platform') as PlatformType | null;
    if (param && ['yandex', 'vk', 'crazygames', 'local'].includes(param)) {
      return param;
    }

    const host = window.location.hostname;
    if (host.includes('yandex.net') || host.includes('yandex.ru')) return 'yandex';
    if (host.includes('vk.com') || host.includes('vkplay.ru')) return 'vk';
    if (host.includes('crazygames.com')) return 'crazygames';
    
    return 'local';
  }

  private createAdapter(platform: PlatformType): IPlatformAdapter {
    switch (platform) {
      case 'yandex': return new YandexAdapter();
      case 'vk': return new VKAdapter();
      default: return new LocalAdapter();
    }
  }

  /** Инициализация платформенного SDK */
  async init(config?: PlatformConfig): Promise<IPlatformAdapter> {
    if (this.initialized && this.adapter) return this.adapter;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit(config);
    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async doInit(config?: PlatformConfig): Promise<IPlatformAdapter> {
    const targetPlatform = config?.forcePlatform || this.detectPlatform();
    console.log(`[PlatformManager] Инициализация: ${targetPlatform}`);
    
    try {
      this.adapter = this.createAdapter(targetPlatform);
      await this.adapter.init();
      this.playerInfo = await this.adapter.getPlayer();
      this.initialized = true;
      
      console.log(`[PlatformManager] ✓ ${this.adapter.platformName}, игрок: ${this.playerInfo.id}`);
      config?.onInit?.(this.adapter, this.playerInfo);
      return this.adapter;
    } catch (error) {
      console.error('[PlatformManager] Ошибка:', error);
      
      if (targetPlatform !== 'local') {
        console.log('[PlatformManager] Fallback на local...');
        this.adapter = new LocalAdapter();
        await this.adapter.init();
        this.playerInfo = await this.adapter.getPlayer();
        this.initialized = true;
        return this.adapter;
      }
      
      config?.onError?.(error as Error);
      throw error;
    }
  }

  get(): IPlatformAdapter {
    if (!this.adapter) throw new Error('PlatformManager не инициализирован');
    return this.adapter;
  }

  getPlayer(): IPlayerInfo {
    if (!this.playerInfo) throw new Error('PlatformManager не инициализирован');
    return this.playerInfo;
  }

  isInitialized(): boolean { return this.initialized; }
  getPlatformName(): PlatformType | null { 
    return this.adapter?.platformName as PlatformType | null; 
  }

  async showRewardedAd(): Promise<boolean> {
    return this.adapter?.showRewardedAd() ?? false;
  }

  async showInterstitialAd(): Promise<void> {
    return this.adapter?.showInterstitialAd();
  }
}

export const platformManager = new PlatformManager();
