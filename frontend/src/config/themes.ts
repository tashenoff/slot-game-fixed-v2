/**
 * Конфигурация тем слотов
 * Темы загружаются динамически из theme.json в папке каждой темы
 */

// Типы анимации барабанов
export type ReelAnimationType = 'spin' | 'drop' | 'rise' | 'cascade';
export type ReelAnimationDirection = 'top-to-bottom' | 'bottom-to-top';

// Интерфейс для отслеживания прогресса загрузки
export interface PreloadProgress {
  loaded: number;      // Количество загруженных ассетов
  total: number;       // Общее количество ассетов
  percent: number;     // Процент загрузки (0-100)
  currentAsset: string; // Текущий загружаемый ассет
}

// Настройки анимации барабанов для темы
export interface ThemeReelAnimation {
  type: ReelAnimationType;           // Тип анимации
  direction?: ReelAnimationDirection; // Направление (для spin)
  speed?: number;                    // Скорость анимации (переопределяет дефолт)
  bounceHeight?: number;             // Высота отскока при остановке
  bounceTime?: number;               // Время отскока (мс)
  staggerDelay?: number;             // Задержка между барабанами (мс)
  spinTime?: number;                 // Время до начала остановки (мс)
}

// Мобильные настройки темы (переопределяют основные на мобильных устройствах)
export interface ThemeMobileConfig {
  borderWidth?: number;
  borderHeight?: number;
  reelsOffsetX?: number;
  reelsOffsetY?: number;
  reelsAreaWidth?: number;
  reelsAreaHeight?: number;
  reelsAutoCenter?: boolean;
  reelsCenterYOffset?: number;
  reelGap?: number;
  rowGap?: number;
  cellWidth?: number;
  cellHeight?: number;
  // Оптимизация производительности для мобильных
  disableBlur?: boolean;  // Отключить blur фильтры (motion blur)
  disableDust?: boolean;  // Отключить эффект пыли при падении
  disableWinLines?: boolean;  // Отключить анимацию линий выигрыша
  disableShine?: boolean;     // Отключить эффект блика на символах
  cascadeWinHighlight?: boolean;  // Каскадная подсветка выигрышных символов (поочередно)
  // Настройки анимации для мобильных (переопределяют основные)
  reelAnimation?: ThemeReelAnimation;
}

// Данные темы из theme.json
export interface ThemeData {
  id: string;
  name: string;
  description: string;
  symbols: string[];
  fallbackColors: Record<string, string>;
  isNew?: boolean;
  isHot?: boolean;
  isLocked?: boolean;
  symbolSizeRatio?: number; // Размер символа относительно ячейки (0-1), по умолчанию 0.92
  symbolFillCell?: boolean; // Если true - символ заполняет всю ячейку (без паддингов по X и Y)
  // Настройки размеров (переопределяют дефолтные)
  borderWidth?: number;
  borderHeight?: number;
  cellWidth?: number;
  cellHeight?: number;
  reelsOffsetX?: number;
  reelsOffsetY?: number;
  reelsAreaWidth?: number;
  reelsAreaHeight?: number;
  reelsAutoCenter?: boolean; // Если true - автоматическое центрирование барабанов внутри рамки
  reelsCenterYOffset?: number; // Дополнительное вертикальное смещение при автоцентрировании (положительное = вниз)
  reelGap?: number; // Зазор между барабанами (колонками) в пикселях
  rowGap?: number; // Зазор между рядами (строками) в пикселях
  // Настройки анимации барабанов
  reelAnimation?: ThemeReelAnimation;
  // Цвета свечения символов (glow) по редкости (ключ — символ, значение — hex цвет)
  glowColors?: Record<string, string>;
  // Интенсивность свечения (0-1), чем реже символ — тем ярче
  glowIntensity?: Record<string, number>;
  /**
   * Визуал символов (слои, анимированные версии).
   * Ключ — ID символа (E, S, ...). Если не указан — грузится symbols/{id}.svg
   */
  symbolVisuals?: Record<string, {
    layers?: { bg: string; content: string; contentScale?: number };
    animated?: string;
    animations?: Array<{
      type: 'shine' | 'dim';
      target: 'bg' | 'content';
      color?: string | number;
      alpha?: number;
      duration?: number;
      pause?: number;
      width?: number;
      angle?: number;
    }>;
  }>;
  // Мобильные настройки (используются при isMobileLayout = true)
  mobile?: ThemeMobileConfig;
}

// Полная информация о теме (включая пути)
export interface SlotTheme extends ThemeData {
  assetsPath: string;        // Базовый путь к ассетам темы
  preview: string;           // Путь к превью
}

// Список ID тем (порядок отображения в лобби)
// Временно отключены: 'fruits', 'tanks'
const THEME_IDS = ['classic', 'egypt', 'aztec', 'mafia'];

// Базовый путь к папке с темами
const THEMES_BASE_PATH = './assets/themes';

/**
 * Загрузить данные одной темы из theme.json
 */
async function loadThemeData(themeId: string): Promise<SlotTheme | null> {
  const assetsPath = `${THEMES_BASE_PATH}/${themeId}`;
  
  try {
    const response = await fetch(`${assetsPath}/theme.json`);
    if (!response.ok) {
      console.warn(`Theme ${themeId}: theme.json not found`);
      return null;
    }
    
    const data: ThemeData = await response.json();
    
    return {
      ...data,
      assetsPath,
      preview: `${assetsPath}/preview.png`,
    };
  } catch (error) {
    console.error(`Failed to load theme ${themeId}:`, error);
    return null;
  }
}

/**
 * Загрузить все темы
 */
export async function loadAllThemes(): Promise<SlotTheme[]> {
  const themes: SlotTheme[] = [];
  
  for (const themeId of THEME_IDS) {
    const theme = await loadThemeData(themeId);
    if (theme) {
      themes.push(theme);
    }
  }
  
  return themes;
}

/**
 * Загрузить одну тему по ID
 */
export async function loadTheme(themeId: string): Promise<SlotTheme | null> {
  return loadThemeData(themeId);
}

/**
 * Получить путь к ассету символа
 */
export function getSymbolAssetPath(theme: SlotTheme, symbolId: string): string {
  return `${theme.assetsPath}/symbols/${symbolId.toLowerCase()}.svg`;
}

/**
 * Получить путь к барабану
 */
export function getBarabanAssetPath(theme: SlotTheme): string {
  return `${theme.assetsPath}/baraban.png`;
}

/**
 * Определить, является ли устройство мобильным
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Проверка по User Agent
  const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  // Проверка по размеру экрана (ширина меньше 768px считается мобильным)
  const isSmallScreen = window.innerWidth < 768;
  
  // Проверка по touch capabilities
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return mobileRegex.test(userAgent) || (isSmallScreen && isTouchDevice);
}

/**
 * Определить, является ли устройство iOS (iPhone/iPad/iPod)
 */
export function isAppleMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || '';
  const iOSRegex = /iPhone|iPad|iPod/i;
  
  return iOSRegex.test(userAgent);
}

/**
 * Проверить, запущено ли приложение в PWA-режиме (standalone)
 * На iOS это означает, что пользователь добавил сайт на главный экран
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.navigator as any).standalone === true;
}
/**
 * Получить путь к фону страницы
 * Фон страницы - это bg.png (всегда одинаковый для desktop и mobile)
 */
export function getBackgroundAssetPath(theme: SlotTheme): string {
  return `${theme.assetsPath}/bg.png`;
}

/**
 * Получить путь к рамке слота (с поддержкой мобильной версии)
 * Для мобильных устройств использует bg_mini.png (вертикальная рамка) если тема имеет mobile конфиг
 */
export function getBorderAssetPath(theme: SlotTheme, forceMobile?: boolean): string {
  const useMobile = forceMobile ?? isMobileDevice();
  
  // На мобильных используем bg_mini.png как рамку если тема имеет мобильную конфигурацию
  if (useMobile && theme.mobile) {
    return `${theme.assetsPath}/bg_mini.png`;
  }
  
  return `${theme.assetsPath}/border.png`;
}

/**
 * Получить путь к музыке темы (если есть) или дефолтную
 */
export function getMusicAssetPath(theme: SlotTheme): string {
  return `${theme.assetsPath}/music.mp3`;
}

/**
 * Получить путь к дефолтной музыке
 */
export function getDefaultMusicPath(): string {
  return './assets/audio/music.mp3';
}

/**
 * Предзагрузка изображения
 */
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Предзагрузка аудио
 */
function preloadAudio(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.oncanplaythrough = () => resolve();
    audio.onerror = () => {
      // Аудио не критично - продолжаем без ошибки
      console.warn(`Audio not available: ${url}`);
      resolve();
    };
    audio.src = url;
    audio.load();
  });
}

/**
 * Получить название ассета для отображения
 */
function getAssetDisplayName(url: string): string {
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  
  // Убираем расширение и форматируем имя
  const name = filename.replace(/\.(png|jpg|jpeg|svg|mp3|wav)$/i, '');
  
  const displayNames: Record<string, string> = {
    'bg': 'Фон',
    'border': 'Рамка',
    'baraban': 'Барабаны',
    'music': 'Музыка',
    'preview': 'Превью',
  };
  
  // Если это символ (a, b, c, d, e, f, g)
  if (/^[a-g]$/i.test(name)) {
    return `Символ ${name.toUpperCase()}`;
  }
  
  return displayNames[name] || filename;
}

/**
 * Предзагрузка всех ассетов темы с отслеживанием прогресса
 */
export async function preloadThemeAssets(
  theme: SlotTheme,
  onProgress?: (progress: PreloadProgress) => void
): Promise<void> {
  // Собираем список всех ассетов для загрузки
  const assetsToLoad: { url: string; type: 'image' | 'audio' }[] = [];
  
  // Основные изображения
  assetsToLoad.push({ url: getBackgroundAssetPath(theme), type: 'image' });
  assetsToLoad.push({ url: getBorderAssetPath(theme), type: 'image' });
  assetsToLoad.push({ url: getBarabanAssetPath(theme), type: 'image' });
  
  // Символы (пробуем SVG и PNG)
  for (const symbolId of theme.symbols) {
    const visual = theme.symbolVisuals?.[symbolId];
    if (visual?.layers) {
      assetsToLoad.push({ url: `${theme.assetsPath}/symbols/${visual.layers.bg}`, type: 'image' });
      assetsToLoad.push({ url: `${theme.assetsPath}/symbols/${visual.layers.content}`, type: 'image' });
    } else {
      assetsToLoad.push({
        url: `${theme.assetsPath}/symbols/${symbolId.toLowerCase()}.svg`,
        type: 'image'
      });
    }
    if (visual?.animated) {
      assetsToLoad.push({ url: `${theme.assetsPath}/symbols/${visual.animated}`, type: 'image' });
    }
  }
  
  // Музыка темы
  assetsToLoad.push({ url: getMusicAssetPath(theme), type: 'audio' });
  
  const total = assetsToLoad.length;
  let loaded = 0;
  
  // Функция обновления прогресса
  const updateProgress = (currentAsset: string) => {
    loaded++;
    const percent = Math.round((loaded / total) * 100);
    onProgress?.({
      loaded,
      total,
      percent,
      currentAsset: getAssetDisplayName(currentAsset),
    });
  };
  
  // Загружаем ассеты последовательно для корректного отображения прогресса
  for (const asset of assetsToLoad) {
    try {
      if (asset.type === 'image') {
        await preloadImage(asset.url);
      } else {
        await preloadAudio(asset.url);
      }
    } catch (error) {
      // Если SVG не загрузился, пробуем PNG для символов
      if (asset.url.endsWith('.svg')) {
        const pngUrl = asset.url.replace('.svg', '.png');
        try {
          await preloadImage(pngUrl);
        } catch {
          console.warn(`Failed to load symbol: ${asset.url}`);
        }
      } else {
        console.warn(`Failed to load asset: ${asset.url}`, error);
      }
    }
    updateProgress(asset.url);
  }
}
