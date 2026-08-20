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
    this.reelsContainer.x = dimensions.reelsOffsetX;
    this.reelsContainer.y = dimensions.reelsOffsetY;
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
    const { cellWidth, cellHeight, rows, buffer } = dimensions;
    const { reelStripLength } = this.config.animation;
    
    const reel = new PIXI.Container();
    reel.x = col * cellWidth + cellWidth / 2;
    this.reelsContainer!.addChild(reel);
    this.reels.push(reel);

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRect(col * cellWidth, 0, cellWidth, rows * cellHeight).endFill();
    this.reelsContainer!.addChild(mask);
    reel.mask = mask as any;
    this.masks.push(mask);

    const barabanTex = this.assetLoader.getBarabanTexture();
    if (barabanTex) {
      const bs = new PIXI.TilingSprite(barabanTex, cellWidth, reelsHeight * 2);
      bs.anchor.set(0.5, 0); bs.x = 0; bs.y = -cellHeight;
      bs.tileScale.set(cellWidth / barabanTex.width, reelsHeight / barabanTex.height);
      reel.addChild(bs);
      this.barabanSprites.push(bs);
    }

    const blur = new PIXI.filters.BlurFilter(); blur.blurX = 0; blur.blurY = 0; blur.quality = 2;
    this.blurFilters.push(blur);

    // Создаём спрайт для КАЖДОГО символа на ленте
    // Это позволяет двигать спрайты без смены текстур
    this.symbols[col] = [];
    const strip = this.reelStrips[col];
    for (let i = 0; i < reelStripLength; i++) {
      const sp = this.symbolFactory.createSymbol(strip[i]);
      sp.y = i * cellHeight + cellHeight / 2; // Начальная позиция на ленте
      sp.filters = [blur];
      reel.addChild(sp);
      this.symbols[col].push(sp);
    }
    this.state[col] = this.createInitialState();
  }

  private createInitialState(): ReelState {
    return {
      on: false, phase: 'idle', position: 0, velocity: 0, targetPosition: 0,
      final: [], bounceStart: 0, stop: false, pos: 0, bouncing: false,
    };
  }

  private buildSeparators(): void {
    const { dimensions, visual } = this.config;
    const g = new PIXI.Graphics();
    g.lineStyle(visual.separatorWidth, visual.separatorColor, visual.separatorAlpha);
    for (let c = 1; c < dimensions.cols; c++) {
      g.moveTo(c * dimensions.cellWidth, 0).lineTo(c * dimensions.cellWidth, dimensions.rows * dimensions.cellHeight);
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
    const { cellHeight, rows } = this.config.dimensions;
    const { reelStripLength } = this.config.animation;
    const state = this.state[col];
    const sprites = this.symbols[col];
    
    const stripHeightPx = reelStripLength * cellHeight;
    // Смещение в пикселях (позиция на ленте)
    const offset = state.position % stripHeightPx;
    
    // Двигаем каждый спрайт ленты
    for (let i = 0; i < reelStripLength; i++) {
      const sp = sprites[i];
      // Базовая позиция символа на ленте + смещение от вращения
      // Когда offset растёт, символы двигаются ВНИЗ
      let y = i * cellHeight + cellHeight / 2 + offset;
      
      // Цикличность: если символ ушёл слишком низко - перемещаем вверх
      while (y > (rows + 1) * cellHeight) {
        y -= stripHeightPx;
      }
      // Если символ слишком высоко - перемещаем вниз
      while (y < -cellHeight) {
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
    const { cellHeight, rows } = this.config.dimensions;
    const sprites = this.symbols[col];
    
    if (!sprites) return null;
    
    // Целевая Y позиция для данного ряда
    const targetY = row * cellHeight + cellHeight / 2;
    const tolerance = cellHeight / 2;
    
    // Ищем спрайт, который находится ближе всего к этой позиции
    for (const sp of sprites) {
      if (Math.abs(sp.y - targetY) < tolerance) {
        return sp;
      }
    }
    
    return null;
  }

  resetSymbolPositions(): void {
    this.updateAllReelDisplays();
    for (let c = 0; c < this.config.cols; c++) {
      this.blurFilters[c].blurY = 0;
    }
  }

  initSpinState(matrix: string[][]): void {
    const { cellHeight, rows } = this.config.dimensions;
    const { reelStripLength, minSpinCycles, spinSpeed } = this.config.animation;
    const stripHeightPx = reelStripLength * cellHeight;
    
    for (let c = 0; c < this.config.cols; c++) {
      const finalSymbols = matrix.map(row => row[c]);
      const targetStripIndex = this.findOrInsertFinalSymbols(c, finalSymbols);
      
      // При движении символов ВНИЗ (y = base + offset):
      // - offset растёт, символы опускаются
      // - символ с индексом i в row 0 когда: i*cellHeight + offset ≡ 0 (mod stripHeightPx)
      // - offset = stripHeightPx - i*cellHeight (для i > 0)
      // Чтобы символ targetStripIndex был в row 0:
      
      const targetOffset = targetStripIndex === 0 
        ? 0 
        : (stripHeightPx - targetStripIndex * cellHeight) % stripHeightPx;
      const currentOffset = this.state[c].position % stripHeightPx;
      
      // Сколько нужно прокрутить чтобы достичь targetOffset
      let distanceToTarget = targetOffset - currentOffset;
      if (distanceToTarget < 0) distanceToTarget += stripHeightPx;
      
      // Добавляем минимум minSpinCycles полных оборотов
      const minDistance = minSpinCycles * stripHeightPx;
      const totalDistance = this.state[c].position + minDistance + distanceToTarget;
      
      this.state[c] = {
        on: true, phase: 'spinning', position: this.state[c].position,
        velocity: spinSpeed, targetPosition: totalDistance, final: finalSymbols,
        bounceStart: 0, stop: false, pos: this.state[c].position, bouncing: false,
      };
    }
  }

  private findOrInsertFinalSymbols(col: number, finalSymbols: string[]): number {
    const strip = this.reelStrips[col];
    const sprites = this.symbols[col];
    const { reelStripLength } = this.config.animation;
    const { rows, cellHeight } = this.config.dimensions;
    
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
    const stripHeightPx = reelStripLength * cellHeight;
    const currentPos = this.state[col].position;
    const normalizedPos = ((currentPos % stripHeightPx) + stripHeightPx) % stripHeightPx;
    const currentIndex = Math.floor(normalizedPos / cellHeight);
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
