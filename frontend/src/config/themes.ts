/**
 * Конфигурация тем слотов
 * Темы загружаются динамически из theme.json в папке каждой темы
 */

// Типы анимации барабанов
export type ReelAnimationType = 'spin' | 'drop' | 'rise' | 'cascade';
export type ReelAnimationDirection = 'top-to-bottom' | 'bottom-to-top';

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
  // Настройки анимации барабанов
  reelAnimation?: ThemeReelAnimation;
}

// Полная информация о теме (включая пути)
export interface SlotTheme extends ThemeData {
  assetsPath: string;        // Базовый путь к ассетам темы
  preview: string;           // Путь к превью
}

// Список ID тем (порядок отображения в лобби)
const THEME_IDS = ['classic', 'fruits', 'egypt'];

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
 * Получить путь к бордеру
 */
export function getBorderAssetPath(theme: SlotTheme): string {
  return `${theme.assetsPath}/border.png`;
}

/**
 * Получить путь к барабану
 */
export function getBarabanAssetPath(theme: SlotTheme): string {
  return `${theme.assetsPath}/baraban.png`;
}

/**
 * Получить путь к фону
 */
export function getBackgroundAssetPath(theme: SlotTheme): string {
  return `${theme.assetsPath}/bg.png`;
}
