// Главный экспорт модуля platform

export { platformManager, type PlatformType, type PlatformConfig } from './PlatformManager';
export type { IPlatformAdapter, IPlayerInfo } from './IPlatformAdapter';

// Адаптеры (обычно не нужны напрямую, но экспортируем для расширения)
export { LocalAdapter } from './adapters/LocalAdapter';
export { YandexAdapter } from './adapters/YandexAdapter';
export { VKAdapter } from './adapters/VKAdapter';
