/**
 * SlotConfig - централизованная конфигурация слот-машины
 * Все магические числа и настройки в одном месте
 */
import { ThemeSymbolVisuals } from '../symbols/symbolVisual';


export interface SlotDimensions {
  borderWidth: number;
  borderHeight: number;
  reelsOffsetX: number;
  reelsOffsetY: number;
  reelsAreaWidth: number;
  reelsAreaHeight: number;
  reelsAutoCenter: boolean; // Если true - автоматическое центрирование барабанов
  reelsCenterYOffset: number; // Дополнительное вертикальное смещение при автоцентрировании
  reelGap: number; // Зазор между барабанами (колонками) в пикселях
  rowGap: number; // Зазор между рядами (строками) в пикселях
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  symbolSizeRatio: number; // Размер символа относительно ячейки (0-1)
  symbolFillCell: boolean; // Если true - символ заполняет всю ячейку (без паддингов по X и Y)
  buffer: number; // Буферные символы сверху/снизу
  // Мобильный режим (транспонирование 5x3 -> 3x5)
  isMobileLayout: boolean; // Если true - транспонируем отображение (логика остаётся 5x3)
  // Оптимизация производительности
  disableBlur: boolean; // Если true - отключить blur фильтры (для мобильных)
  // Горизонтальный вращающийся барабан (текстура baraban.png)
  showBarabanBackground: boolean; // Если true - показывать TilingSprite барабана (только для классики)
}

// Типы анимации барабанов
export type ReelAnimationType = 'spin' | 'drop' | 'rise' | 'cascade';
export type ReelAnimationDirection = 'top-to-bottom' | 'bottom-to-top';

export interface AnimationConfig {
  spinSpeed: number;
  spinTime: number;
  stopDelay: number; // Задержка между остановкой барабанов
  bounceHeight: number;
  bounceTime: number;
  maxBlur: number;
  winSymbolScale: number; // Увеличение выигрышного символа
  winAnimationDuration: number;
  // Параметры ленты
  reelStripLength: number; // Количество символов на ленте каждого барабана
  minSpinCycles: number; // Минимальное количество оборотов ленты перед остановкой
  decelerationDistance: number; // Расстояние торможения в символах
  // Тип анимации барабанов
  reelAnimationType: ReelAnimationType;
  reelAnimationDirection: ReelAnimationDirection;
}

export interface VisualConfig {
  nonWinAlpha: number; // Затемнение невыигрышных символов
  separatorColor: number;
  separatorAlpha: number;
  separatorWidth: number;
}

export interface SymbolConfig {
  ids: string[];
  fallbackColors: Record<string, string>;
  /** Цвета свечения (glow) по редкости символа */
  rarityGlowColors: Record<string, string>;
  /** Интенсивность свечения (0-1), чем реже символ — тем ярче */
  rarityGlowIntensity?: Record<string, number>;
  /** Визуал символов темы (слои / animated). Опционально. */
  visuals?: ThemeSymbolVisuals;
}

export interface ReelStripConfig {
  // Ленты для каждого барабана (каждая лента — массив символов)
  // Если не задана — генерируется случайно при инициализации
  strips?: string[][];
}

export interface PaylinePattern {
  positions: { row: number; col: number }[];
}

export interface SlotConfigData {
  dimensions: SlotDimensions;
  animation: AnimationConfig;
  visual: VisualConfig;
  symbols: SymbolConfig;
  reelStrips: ReelStripConfig;
  paylines: PaylinePattern[];
}

/**
 * Конфигурация по умолчанию - классический 5x3 слот
 */
export const DEFAULT_SLOT_CONFIG: SlotConfigData = {
  dimensions: {
    borderWidth: 1917,
    borderHeight: 1064,
    reelsOffsetX: 291,     // Центрирование по X: (1917 - 1336) / 2 ≈ 291
    reelsOffsetY: 285,     // Смещение по Y для центрирования (увеличено пропорционально)
    reelsAreaWidth: 1336,  // Уменьшено на 15% (было 1572)
    reelsAreaHeight: 627,  // Уменьшено на 15% (было 738)
    reelsAutoCenter: false, // По умолчанию используем ручные смещения
    reelsCenterYOffset: 0, // По умолчанию без дополнительного смещения
    reelGap: 0, // По умолчанию без зазоров
    rowGap: 0, // По умолчанию без зазоров
    cols: 5,
    rows: 3,
    cellWidth: 1336 / 5,   // 267.2 (было 314.4)
    cellHeight: 627 / 3,   // 209 (было 246)
    symbolSizeRatio: 0.92,
    symbolFillCell: false, // По умолчанию символ квадратный с паддингами
    isMobileLayout: false, // По умолчанию десктопный режим
    disableBlur: false, // По умолчанию blur включен
    showBarabanBackground: false, // По умолчанию фон барабана выключен (только для классики)
    buffer: 1,
  },
  animation: {
    spinSpeed: 45,           // Скорость вращения (пикселей/кадр)
    spinTime: 300,           // Время до остановки ПЕРВОГО барабана (мс)
    stopDelay: 100,          // Задержка между остановками барабанов (мс) - слева направо
    bounceHeight: 30,        // Высота отскока (px) - символы "просядут" вниз на это расстояние
    bounceTime: 400,         // Время отскока (мс) - пружинная анимация возврата
    maxBlur: 15,             // Размытие при вращении (было 45 — слишком сильно, символы не видны)
    winSymbolScale: 1.03,
    winAnimationDuration: 300,
    // Параметры ленты
    reelStripLength: 5,      // Символов на ленте (меньше = короче оборот)
    minSpinCycles: 0,        // Без полных оборотов - сразу к результату
    decelerationDistance: 2, // Не используется при мгновенной остановке
    // Тип анимации по умолчанию
    reelAnimationType: 'spin' as const,
    reelAnimationDirection: 'top-to-bottom' as const,
  },
  visual: {
    nonWinAlpha: 0.5,
    separatorColor: 0x445544,
    separatorAlpha: 0.35,
    separatorWidth: 2,
  },
  symbols: {
    ids: ['A', 'B', 'C', 'D', 'E', 'F', 'S'],
    fallbackColors: {
      A: '#e74c3c',
      B: '#2ecc71',
      C: '#3498db',
      D: '#f1c40f',
      E: '#9b59b6',
      F: '#ff6600',
      S: '#ffd700',
    },
    rarityGlowColors: {
      A: '#FF1744',  // Ярко-красный — самый редкий
      B: '#E91E63',  // Малиновый/розовый
      C: '#2979FF',  // Ярко-синий
      D: '#00E676',  // Ярко-зелёный
      E: '#AA00FF',  // Фиолетовый
      F: '#00BCD4',  // Голубой/циан (частый)
      S: '#FFD700',  // Золотой — Scatter
    },
    rarityGlowIntensity: {
      A: 1.0,  // Яркое свечение
      B: 0.8,
      C: 0.6,
      D: 0.4,
      E: 0.15, // Едва заметное
      F: 0.15, // Едва заметное
      S: 1.0,  // Максимальное свечение
    },
  },
  reelStrips: {
    // Ленты будут сгенерированы автоматически при инициализации
    strips: undefined,
  },
  paylines: [
    // Линия 0: средняя горизонтальная
    { positions: [0, 1, 2, 3, 4].map(c => ({ row: 1, col: c })) },
    // Линия 1: верхняя горизонтальная
    { positions: [0, 1, 2, 3, 4].map(c => ({ row: 0, col: c })) },
    // Линия 2: нижняя горизонтальная
    { positions: [0, 1, 2, 3, 4].map(c => ({ row: 2, col: c })) },
    // Линия 3: V-образная
    { positions: [
      { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 },
      { row: 1, col: 3 }, { row: 0, col: 4 }
    ]},
    // Линия 4: Λ-образная (перевёрнутая V)
    { positions: [
      { row: 2, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 3 }, { row: 2, col: 4 }
    ]},
    // Линия 5: Волнистая верхняя (центр → верх → верх → верх → центр)
    { positions: [
      { row: 1, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 0, col: 3 }, { row: 1, col: 4 }
    ]},
    // Линия 6: Волнистая нижняя (центр → низ → низ → низ → центр)
    { positions: [
      { row: 1, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
      { row: 2, col: 3 }, { row: 1, col: 4 }
    ]},
    // Линия 7: Диагональ вниз (верх → верх → центр → низ → низ)
    { positions: [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 2 },
      { row: 2, col: 3 }, { row: 2, col: 4 }
    ]},
    // Линия 8: Диагональ вверх (низ → низ → центр → верх → верх)
    { positions: [
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 1, col: 2 },
      { row: 0, col: 3 }, { row: 0, col: 4 }
    ]},
    // Линия 9: Малая V (верх → центр → центр → центр → верх)
    { positions: [
      { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
      { row: 1, col: 3 }, { row: 0, col: 4 }
    ]},
    // Линия 10: Малая Λ (низ → центр → центр → центр → низ)
    { positions: [
      { row: 2, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
      { row: 1, col: 3 }, { row: 2, col: 4 }
    ]},
    // Линия 11: Зигзаг верх (центр → верх → центр → верх → центр)
    { positions: [
      { row: 1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 2 },
      { row: 0, col: 3 }, { row: 1, col: 4 }
    ]},
    // Линия 12: Зигзаг низ (центр → низ → центр → низ → центр)
    { positions: [
      { row: 1, col: 0 }, { row: 2, col: 1 }, { row: 1, col: 2 },
      { row: 2, col: 3 }, { row: 1, col: 4 }
    ]},
    // Линия 13: Двойная V (верх → центр → верх → центр → верх)
    { positions: [
      { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 3 }, { row: 0, col: 4 }
    ]},
    // Линия 14: Двойная Λ (низ → центр → низ → центр → низ)
    { positions: [
      { row: 2, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 },
      { row: 1, col: 3 }, { row: 2, col: 4 }
    ]},
  ],
};

/**
 * Класс-обёртка для удобного доступа к конфигурации
 */
export class SlotConfig {
  private config: SlotConfigData;

  constructor(config: Partial<SlotConfigData> = {}) {
    this.config = this.mergeConfig(DEFAULT_SLOT_CONFIG, config);
  }

  private mergeConfig(defaults: SlotConfigData, overrides: Partial<SlotConfigData>): SlotConfigData {
    const merged = {
      dimensions: { ...defaults.dimensions, ...overrides.dimensions },
      animation: { ...defaults.animation, ...overrides.animation },
      visual: { ...defaults.visual, ...overrides.visual },
      symbols: { ...defaults.symbols, ...overrides.symbols },
      reelStrips: { ...defaults.reelStrips, ...overrides.reelStrips },
      paylines: overrides.paylines || defaults.paylines,
    };
    
    // Автоматический расчёт размеров ячеек из размера контейнера
    // cellWidth и cellHeight вычисляются из reelsAreaWidth/Height и cols/rows с учётом зазоров
    // reelsAreaWidth = cols * cellWidth + (cols - 1) * reelGap
    // => cellWidth = (reelsAreaWidth - (cols - 1) * reelGap) / cols
    // 
    // ВАЖНО: В мобильном режиме визуальная сетка транспонирована (cols↔rows)
    // Логическая сетка остаётся 5×3, но визуально отображается 3×5
    // Поэтому cellWidth/Height рассчитываем по ВИЗУАЛЬНЫМ размерам
    const visualCols = merged.dimensions.isMobileLayout ? merged.dimensions.rows : merged.dimensions.cols;
    const visualRows = merged.dimensions.isMobileLayout ? merged.dimensions.cols : merged.dimensions.rows;
    const totalReelGaps = (visualCols - 1) * merged.dimensions.reelGap;
    const totalRowGaps = (visualRows - 1) * merged.dimensions.rowGap;
    merged.dimensions.cellWidth = (merged.dimensions.reelsAreaWidth - totalReelGaps) / visualCols;
    merged.dimensions.cellHeight = (merged.dimensions.reelsAreaHeight - totalRowGaps) / visualRows;
    
    return merged;
  }

  get dimensions(): SlotDimensions { return this.config.dimensions; }
  get animation(): AnimationConfig { return this.config.animation; }
  get visual(): VisualConfig { return this.config.visual; }
  get symbols(): SymbolConfig { return this.config.symbols; }
  get reelStrips(): ReelStripConfig { return this.config.reelStrips; }
  get paylines(): PaylinePattern[] { return this.config.paylines; }

  // Вспомогательные геттеры
  get cellWidth(): number { return this.config.dimensions.cellWidth; }
  get cellHeight(): number { return this.config.dimensions.cellHeight; }
  get cols(): number { return this.config.dimensions.cols; }
  get rows(): number { return this.config.dimensions.rows; }
  get buffer(): number { return this.config.dimensions.buffer; }
  get isMobileLayout(): boolean { return this.config.dimensions.isMobileLayout; }

  /**
   * Получить визуальное количество колонок (для мобильного - транспонировано)
   * На мобильном: логические колонки становятся визуальными рядами
   */
  get visualCols(): number {
    return this.isMobileLayout ? this.config.dimensions.rows : this.config.dimensions.cols;
  }

  /**
   * Получить визуальное количество рядов (для мобильного - транспонировано)
   * На мобильном: логические ряды становятся визуальными колонками
   */
  get visualRows(): number {
    return this.isMobileLayout ? this.config.dimensions.cols : this.config.dimensions.rows;
  }

  /**
   * Преобразовать логические координаты (col, row) в визуальные
   * Desktop: (col, row) -> (col, row)
   * Mobile:  (col, row) -> (row, col) - транспонирование
   */
  toVisualPosition(col: number, row: number): { visualCol: number; visualRow: number } {
    if (this.isMobileLayout) {
      return { visualCol: row, visualRow: col };
    }
    return { visualCol: col, visualRow: row };
  }

  /**
   * Преобразовать визуальные координаты обратно в логические
   */
  toLogicalPosition(visualCol: number, visualRow: number): { col: number; row: number } {
    if (this.isMobileLayout) {
      return { col: visualRow, row: visualCol };
    }
    return { col: visualCol, row: visualRow };
  }

  /**
   * Получить позиции для линии выплат
   */
  getPaylinePositions(lineIndex: number): { row: number; col: number }[] {
    if (lineIndex >= 0 && lineIndex < this.paylines.length) {
      return this.paylines[lineIndex].positions;
    }
    return [];
  }

  /**
   * Обновить конфигурацию (для динамических изменений)
   */
  update(overrides: Partial<SlotConfigData>): void {
    this.config = this.mergeConfig(this.config, overrides);
  }
}
