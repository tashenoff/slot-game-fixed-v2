import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { AssetLoader } from './AssetLoader';
import { SymbolFactory } from './SymbolFactory';

/**
 * Состояние барабана для анимации с лентой
 */
export interface ReelState {
  on: boolean;           // Барабан вращается
  phase: 'idle' | 'spinning' | 'stopping' | 'bouncing';
  position: number;      // Текущая позиция на ленте (в пикселях)
  velocity: number;      // Текущая скорость
  targetPosition: number; // Целевая позиция для остановки
  final: string[];       // Финальные символы
  bounceStart: number;
  targetRecalculated: boolean; // Флаг пересчёта позиции при остановке
  // Legacy поля для совместимости
  stop: boolean;
  pos: number;
  bouncing: boolean;
}

/**
 * ReelManager - управление барабанами с настоящей лентой символов
 */
export class ReelManager {
  private config: SlotConfig;
  private assetLoader: AssetLoader;
  private symbolFactory: SymbolFactory;
  private reelsContainer: PIXI.Container | null = null;
  private reels: PIXI.Container[] = [];
  private reelStrips: string[][] = []; // Ленты символов
  private symbols: PIXI.Sprite[][] = [];
  private barabanSprites: PIXI.TilingSprite[] = [];
  private blurFilters: PIXI.filters.BlurFilter[] = [];
  private masks: PIXI.Graphics[] = [];
  private state: ReelState[] = [];

  constructor(config: SlotConfig, assetLoader: AssetLoader) {
    this.config = config;
    this.assetLoader = assetLoader;
    this.symbolFactory = new SymbolFactory(config, assetLoader);
  }

  build(stage: PIXI.Container): PIXI.Container {
    const { dimensions } = this.config;
    this.reelsContainer = new PIXI.Container();
    
    // Автоцентрирование или ручные смещения
    if (dimensions.reelsAutoCenter) {
      // reelsAreaWidth/Height УЖЕ включают зазоры (это полный размер области барабанов)
      // cellWidth/Height вычисляются с учётом вычета зазоров
      // Поэтому для центрирования используем reelsAreaWidth/Height напрямую
      const totalWidth = dimensions.reelsAreaWidth;
      const totalHeight = dimensions.reelsAreaHeight;
      // Центрируем барабаны внутри рамки с опциональным вертикальным смещением
      this.reelsContainer.x = (dimensions.borderWidth - totalWidth) / 2;
      this.reelsContainer.y = (dimensions.borderHeight - totalHeight) / 2 + dimensions.reelsCenterYOffset;
    } else {
      this.reelsContainer.x = dimensions.reelsOffsetX;
      this.reelsContainer.y = dimensions.reelsOffsetY;
    }
    stage.addChild(this.reelsContainer);
    
    this.generateReelStrips();
    
    const reelsHeight = dimensions.rows * dimensions.cellHeight;
    for (let col = 0; col < dimensions.cols; col++) this.buildReel(col, reelsHeight);
    this.buildSeparators();
    this.updateAllReelDisplays();
    return this.reelsContainer;
  }

  private generateReelStrips(): void {
    const { cols } = this.config.dimensions;
    const { reelStripLength } = this.config.animation;
    const { ids } = this.config.symbols;
    const configStrips = this.config.reelStrips.strips;
    
    this.reelStrips = [];
    for (let col = 0; col < cols; col++) {
      if (configStrips && configStrips[col]) {
        this.reelStrips[col] = [...configStrips[col]];
      } else {
        this.reelStrips[col] = [];
        for (let i = 0; i < reelStripLength; i++) {
          this.reelStrips[col].push(ids[Math.floor(Math.random() * ids.length)]);
        }
      }
    }
  }

  private buildReel(col: number, reelsHeight: number): void {
    const { dimensions } = this.config;
    const { cellWidth, cellHeight, rows, buffer, reelGap, rowGap } = dimensions;
    const { reelStripLength } = this.config.animation;
    
    // Учитываем зазоры между барабанами (горизонтальные)
    const reelOffset = col * (cellWidth + reelGap);
    
    const reel = new PIXI.Container();
    reel.x = reelOffset + cellWidth / 2;
    // НЕ масштабируем - вертикальные зазоры будут учтены в updateReelDisplay
    this.reelsContainer!.addChild(reel);
    this.reels.push(reel);

    // Высота с учётом вертикальных зазоров между рядами
    const totalHeight = rows * cellHeight + (rows - 1) * rowGap;
    
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRect(reelOffset, 0, cellWidth, totalHeight).endFill();
    this.reelsContainer!.addChild(mask);
    reel.mask = mask as any;
    this.masks.push(mask);

    // Blur фильтр для motion blur эффекта при вращении
    const blur = new PIXI.filters.BlurFilter(); 
    blur.blurX = 0; 
    blur.blurY = 0; 
    blur.quality = 4; // Повышенное качество для плавного размытия
    this.blurFilters.push(blur);

    // Создаём спрайт для КАЖДОГО символа на ленте
    // Это позволяет двигать спрайты без смены текстур
    this.symbols[col] = [];
    const strip = this.reelStrips[col];
    for (let i = 0; i < reelStripLength; i++) {
      const sp = this.symbolFactory.createSymbol(strip[i]);
      // Начальная позиция на ленте (с учётом rowGap в updateReelDisplay)
      sp.y = i * (cellHeight + rowGap) + cellHeight / 2;
      sp.filters = [blur];
      reel.addChild(sp);
      this.symbols[col].push(sp);
    }
    this.state[col] = this.createInitialState();
  }

  private createInitialState(): ReelState {
    return {
      on: false, phase: 'idle', position: 0, velocity: 0, targetPosition: 0,
      final: [], bounceStart: 0, targetRecalculated: false, stop: false, pos: 0, bouncing: false,
    };
  }

  private buildSeparators(): void {
    const { dimensions, visual } = this.config;
    const { cellWidth, cellHeight, cols, rows, reelGap, rowGap } = dimensions;
    // Общая высота с учётом вертикальных зазоров
    const totalHeight = rows * cellHeight + (rows - 1) * rowGap;
    const g = new PIXI.Graphics();
    g.lineStyle(visual.separatorWidth, visual.separatorColor, visual.separatorAlpha);
    for (let c = 1; c < cols; c++) {
      const x = c * (cellWidth + reelGap) - reelGap / 2;
      g.moveTo(x, 0).lineTo(x, totalHeight);
    }
    this.reelsContainer!.addChild(g);
  }

  private updateAllReelDisplays(): void {
    for (let col = 0; col < this.config.cols; col++) {
      this.updateReelDisplay(col);
    }
  }

  /**
   * Обновить отображение барабана - просто двигаем ВСЕ спрайты ленты
   * Текстуры НЕ меняются - каждый спрайт привязан к своему символу на ленте
   * Направление: символы движутся ВНИЗ (новые входят сверху, старые выходят снизу)
   */
  updateReelDisplay(col: number): void {
    const { cellHeight, rows, rowGap } = this.config.dimensions;
    const { reelStripLength } = this.config.animation;
    const state = this.state[col];
    const sprites = this.symbols[col];
    
    // Шаг между символами с учётом вертикального зазора
    const stepHeight = cellHeight + rowGap;
    const stripHeightPx = reelStripLength * stepHeight;
    // Смещение в пикселях (позиция на ленте)
    const offset = state.position % stripHeightPx;
    
    // Высота видимой области с зазорами
    const totalVisibleHeight = rows * cellHeight + (rows - 1) * rowGap;
    
    // Двигаем каждый спрайт ленты
    for (let i = 0; i < reelStripLength; i++) {
      const sp = sprites[i];
      // Базовая позиция символа на ленте + смещение от вращения
      // Когда offset растёт, символы двигаются ВНИЗ
      let y = i * stepHeight + cellHeight / 2 + offset;
      
      // Цикличность: если символ ушёл слишком низко - перемещаем вверх
      while (y > totalVisibleHeight + stepHeight) {
        y -= stripHeightPx;
      }
      // Если символ слишком высоко - перемещаем вниз
      while (y < -stepHeight) {
        y += stripHeightPx;
      }
      
      sp.y = y;
    }
    
    if (this.barabanSprites[col]) {
      this.barabanSprites[col].tilePosition.y = offset;
    }
  }

  getContainer() { return this.reelsContainer; }
  getReels() { return this.reels; }
  getSymbols() { return this.symbols; }
  getState() { return this.state; }
  getReelState(c: number) { return this.state[c]; }
  getBlurFilters() { return this.blurFilters; }
  getBarabanSprites() { return this.barabanSprites; }
  getSymbolFactory() { return this.symbolFactory; }
  getReelStrips() { return this.reelStrips; }
  
  /**
   * Получить спрайт символа в видимой области (row: 0, 1, 2 для 3-рядного слота)
   * Находим спрайт, который сейчас находится в нужной позиции экрана
   */
  getSymbol(col: number, row: number): PIXI.Sprite | null {
    const { cellHeight, rowGap } = this.config.dimensions;
    const sprites = this.symbols[col];
    
    if (!sprites) return null;
    
    // Целевая Y позиция для данного ряда с учётом зазоров
    const stepHeight = cellHeight + rowGap;
    const targetY = row * stepHeight + cellHeight / 2;
    const tolerance = cellHeight / 2;
    
    // Ищем спрайт, который находится ближе всего к этой позиции
    for (const sp of sprites) {
      if (Math.abs(sp.y - targetY) < tolerance) {
        return sp;
      }
    }
    
    return null;
  }

  /**
   * Получить спрайт символа напрямую по индексу (col, row)
   * Используется для drop анимации, где позиция символа меняется
   */
  getSymbolByIndex(col: number, row: number): PIXI.Sprite | null {
    const sprites = this.symbols[col];
    if (!sprites || row < 0 || row >= sprites.length) return null;
    return sprites[row];
  }

  resetSymbolPositions(): void {
    this.updateAllReelDisplays();
    for (let c = 0; c < this.config.cols; c++) {
      this.blurFilters[c].blurY = 0;
    }
  }

  initSpinState(matrix: string[][]): void {
    const { cellHeight, rows, cols, rowGap } = this.config.dimensions;
    const { reelStripLength, minSpinCycles, spinSpeed, stopDelay } = this.config.animation;
    // Шаг между символами с учётом зазора
    const stepHeight = cellHeight + rowGap;
    const stripHeightPx = reelStripLength * stepHeight;
    
    // Сначала рассчитаем все целевые дистанции
    const targetDistances: number[] = [];
    const finalSymbolsAll: string[][] = [];
    
    for (let c = 0; c < cols; c++) {
      const finalSymbols = matrix.map(row => row[c]);
      finalSymbolsAll[c] = finalSymbols;
      const targetStripIndex = this.findOrInsertFinalSymbols(c, finalSymbols);
      
      // При движении символов ВНИЗ (y = base + offset):
      // - offset растёт, символы опускаются
      // - символ с индексом i в row 0 когда: i*stepHeight + offset ≡ 0 (mod stripHeightPx)
      // - offset = stripHeightPx - i*stepHeight (для i > 0)
      // Чтобы символ targetStripIndex был в row 0:
      
      const targetOffset = targetStripIndex === 0 
        ? 0 
        : (stripHeightPx - targetStripIndex * stepHeight) % stripHeightPx;
      const currentOffset = this.state[c].position % stripHeightPx;
      
      // Сколько нужно прокрутить чтобы достичь targetOffset
      let distanceToTarget = targetOffset - currentOffset;
      if (distanceToTarget < 0) distanceToTarget += stripHeightPx;
      
      // Добавляем минимум minSpinCycles полных оборотов
      const minDistance = minSpinCycles * stripHeightPx;
      targetDistances[c] = this.state[c].position + minDistance + distanceToTarget;
    }
    
    // Если stopDelay = 0, синхронизируем остановки - все барабаны должны прокрутить одинаковое расстояние
    let maxTargetDistance = Math.max(...targetDistances);
    
    for (let c = 0; c < cols; c++) {
      let totalDistance = targetDistances[c];
      
      // Если нужна синхронная остановка, выравниваем до максимальной дистанции
      if (stopDelay === 0) {
        // Добавляем полные обороты, чтобы достичь максимальной дистанции
        while (totalDistance < maxTargetDistance) {
          totalDistance += stripHeightPx;
        }
      }
      
      this.state[c] = {
        on: true, phase: 'spinning', position: this.state[c].position,
        velocity: spinSpeed, targetPosition: totalDistance, final: finalSymbolsAll[c],
        bounceStart: 0, targetRecalculated: false, stop: false, pos: this.state[c].position, bouncing: false,
      };
    }
  }

  /**
   * Пересчитать целевую позицию для барабана на ближайшую позицию с финальными символами
   * Вызывается при получении команды на остановку для синхронной остановки слева направо
   */
  recalculateTargetPosition(col: number, currentPosition: number, cellHeight: number): number {
    const { reelStripLength } = this.config.animation;
    const { rowGap } = this.config.dimensions;
    // Шаг между символами с учётом зазора
    const stepHeight = cellHeight + rowGap;
    const stripHeightPx = reelStripLength * stepHeight;
    const finalSymbols = this.state[col].final;
    
    // Находим индекс финальных символов на ленте
    const targetStripIndex = this.findOrInsertFinalSymbols(col, finalSymbols);
    
    // Целевой offset для этого индекса
    const targetOffset = targetStripIndex === 0 
      ? 0 
      : (stripHeightPx - targetStripIndex * stepHeight) % stripHeightPx;
    
    // Текущий offset
    const currentOffset = ((currentPosition % stripHeightPx) + stripHeightPx) % stripHeightPx;
    
    // Сколько нужно прокрутить до ближайшей целевой позиции
    let distanceToTarget = targetOffset - currentOffset;
    if (distanceToTarget <= 0) {
      distanceToTarget += stripHeightPx;
    }
    
    // Добавляем немного "разбега" - минимум пол-символа, чтобы было видно торможение
    const minDistance = stepHeight * 0.5;
    if (distanceToTarget < minDistance) {
      distanceToTarget += stripHeightPx;
    }
    
    return currentPosition + distanceToTarget;
  }

  private findOrInsertFinalSymbols(col: number, finalSymbols: string[]): number {
    const strip = this.reelStrips[col];
    const sprites = this.symbols[col];
    const { reelStripLength } = this.config.animation;
    const { rows, cellHeight, rowGap } = this.config.dimensions;
    
    // Ищем последовательность на ленте
    for (let startIdx = 0; startIdx < reelStripLength; startIdx++) {
      let match = true;
      for (let r = 0; r < rows; r++) {
        if (strip[(startIdx + r) % reelStripLength] !== finalSymbols[r]) {
          match = false; break;
        }
      }
      if (match) return startIdx;
    }
    
    // Не нашли — вставляем финальные символы в ленту
    // Выбираем позицию подальше от текущей видимой области
    const stepHeight = cellHeight + rowGap;
    const stripHeightPx = reelStripLength * stepHeight;
    const currentPos = this.state[col].position;
    const normalizedPos = ((currentPos % stripHeightPx) + stripHeightPx) % stripHeightPx;
    const currentIndex = Math.floor(normalizedPos / stepHeight);
    let insertIndex = (currentIndex + Math.floor(reelStripLength / 2)) % reelStripLength;
    
    // Обновляем и ленту, и текстуры спрайтов
    for (let r = 0; r < rows; r++) {
      const idx = (insertIndex + r) % reelStripLength;
      strip[idx] = finalSymbols[r];
      // Обновляем текстуру соответствующего спрайта
      this.symbolFactory.updateSymbolTexture(sprites[idx], finalSymbols[r]);
    }
    return insertIndex;
  }

  finishReel(col: number): void {
    // При использовании настоящей ленты - просто обновляем отображение
    // Символы уже правильные, замена текстур не нужна
    this.updateReelDisplay(col);
    if (this.barabanSprites[col]) this.barabanSprites[col].tilePosition.y = 0;
  }

  /**
   * Подготовить символы для drop анимации
   * Обновляет текстуры символов на финальные значения из матрицы
   * @param matrix - матрица финальных символов [row][col]
   */
  prepareDropState(matrix: string[][]): void {
    const { cellHeight, rows, cols, rowGap } = this.config.dimensions;
    const stepHeight = cellHeight + rowGap;
    
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const symbolId = matrix[row][col];
        const sprite = this.symbols[col][row];
        if (sprite) {
          this.symbolFactory.updateSymbolTexture(sprite, symbolId);
          // Устанавливаем начальную Y позицию с учётом зазоров (будет переопределена DropReelAnimator)
          sprite.y = row * stepHeight + cellHeight / 2;
        }
      }
      
      // Сбросим blur фильтр
      if (this.blurFilters[col]) {
        this.blurFilters[col].blurY = 0;
      }
    }
  }

  /**
   * Обновить текстуру конкретного символа
   * Используется DropReelAnimator для смены символов во время анимации
   */
  updateSymbolTexture(col: number, row: number, symbolId: string): void {
    const sprite = this.symbols[col]?.[row];
    if (sprite) {
      this.symbolFactory.updateSymbolTexture(sprite, symbolId);
    }
  }

  generateRandomMatrix(): string[][] {
    const { rows, cols } = this.config.dimensions;
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => this.symbolFactory.getRandomSymbolId()));
  }

  destroy(): void {
    this.reels.forEach(r => r.destroy({ children: true }));
    this.masks.forEach(m => m.destroy());
    this.reelsContainer?.destroy({ children: true });
    this.reels = []; this.symbols = []; this.barabanSprites = []; 
    this.blurFilters = []; this.masks = []; this.state = []; this.reelStrips = [];
    this.reelsContainer = null;
  }
}
