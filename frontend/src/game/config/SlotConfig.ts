/**
 * SlotConfig - централизованная конфигурация слот-машины
 * Все магические числа и настройки в одном месте
 */

export interface SlotDimensions {
  borderWidth: number;
  borderHeight: number;
  reelsOffsetX: number;
  reelsOffsetY: number;
  reelsAreaWidth: number;
  reelsAreaHeight: number;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  symbolSizeRatio: number; // Размер символа относительно ячейки (0-1)
  buffer: number; // Буферные символы сверху/снизу
}

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
    reelsOffsetX: 172,     // Центрирование по X: (1917 - 1572) / 2 ≈ 172
    reelsOffsetY: 230,     // Смещение по Y для центрирования
    reelsAreaWidth: 1572,  // Уменьшено на ~10%
    reelsAreaHeight: 738,  // Уменьшено на ~10%
    cols: 5,
    rows: 3,
    cellWidth: 1572 / 5,   // 314.4
    cellHeight: 738 / 3,   // 246
    symbolSizeRatio: 0.92,
    buffer: 1,
  },
  animation: {
    spinSpeed: 45,           // Скорость вращения (пикселей/кадр)
    spinTime: 300,           // Время до остановки ПЕРВОГО барабана (мс)
    stopDelay: 100,          // Задержка между остановками барабанов (мс) - слева направо
    bounceHeight: 12,        // Высота отскока
    bounceTime: 100,         // Время отскока
    maxBlur: 45,             // Размытие при вращении
    winSymbolScale: 1.03,
    winAnimationDuration: 300,
    // Параметры ленты
    reelStripLength: 5,      // Символов на ленте (меньше = короче оборот)
    minSpinCycles: 0,        // Без полных оборотов - сразу к результату
    decelerationDistance: 2, // Не используется при мгновенной остановке
  },
  visual: {
    nonWinAlpha: 0.5,
    separatorColor: 0x445544,
    separatorAlpha: 0.35,
    separatorWidth: 2,
  },
  symbols: {
    ids: ['A', 'B', 'C', 'D', 'E', 'F'],
    fallbackColors: {
      A: '#e74c3c',
      B: '#2ecc71',
      C: '#3498db',
      D: '#f1c40f',
      E: '#9b59b6',
      F: '#ff6600',
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
    return {
      dimensions: { ...defaults.dimensions, ...overrides.dimensions },
      animation: { ...defaults.animation, ...overrides.animation },
      visual: { ...defaults.visual, ...overrides.visual },
      symbols: { ...defaults.symbols, ...overrides.symbols },
      reelStrips: { ...defaults.reelStrips, ...overrides.reelStrips },
      paylines: overrides.paylines || defaults.paylines,
    };
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
