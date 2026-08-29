import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';
import { SymbolFactory } from '../core/SymbolFactory';

/**
 * SymbolAnimator - анимация символов (масштабирование, затемнение, рамки редкости)
 */
export class SymbolAnimator {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private symbolFactory: SymbolFactory;
  private originalScales: Map<PIXI.Sprite, number> = new Map();
  private dimmedSymbols: Set<PIXI.Sprite> = new Set();
  private activeAnimations: Set<number> = new Set();
  private cascadeState: {
    startTime: number;
    delay: number;
    queue: { col: number; row: number; sprite: PIXI.Sprite }[];
    animFrame: number;
  } | null = null;

  constructor(config: SlotConfig, reelManager: ReelManager, symbolFactory: SymbolFactory) {
    this.config = config;
    this.reelManager = reelManager;
    this.symbolFactory = symbolFactory;
  }

  /**
   * Анимация масштабирования выигрышного символа
   */
  animateWinSymbol(col: number, row: number): void {
    const sprite = this.reelManager.getSymbol(col, row);
    if (!sprite) return;

    if (!this.originalScales.has(sprite)) {
      this.originalScales.set(sprite, sprite.scale.x);
    }

    const originalScale = this.originalScales.get(sprite)!;
    const targetScale = originalScale * this.config.animation.winSymbolScale;
    const duration = this.config.animation.winAnimationDuration;

    this.smoothScaleAnimation(sprite, targetScale, originalScale, duration);
  }

  private smoothScaleAnimation(sprite: PIXI.Sprite, peakScale: number, originalScale: number, totalDuration: number): void {
    const startTime = performance.now();
    const halfDuration = totalDuration / 2;
    const animId = Math.random();
    this.activeAnimations.add(animId);

    const animate = (currentTime: number) => {
      if (!this.activeAnimations.has(animId)) return;

      const elapsed = currentTime - startTime;

      if (elapsed < halfDuration) {
        const progress = elapsed / halfDuration;
        const eased = 1 - (1 - progress) * (1 - progress);
        sprite.scale.set(originalScale + (peakScale - originalScale) * eased);
        requestAnimationFrame(animate);
      } else if (elapsed < totalDuration) {
        const progress = (elapsed - halfDuration) / halfDuration;
        const eased = progress * progress;
        sprite.scale.set(peakScale - (peakScale - originalScale) * eased);
        requestAnimationFrame(animate);
      } else {
        sprite.scale.set(originalScale);
        this.activeAnimations.delete(animId);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Затемнить невыигрышные символы
   * winPositions содержит логические координаты в формате "col_row"
   */
  dimNonWinSymbols(winPositions: Set<string>): void {
    const { cols, rows } = this.config.dimensions;

    // Итерируем по ЛОГИЧЕСКИМ координатам (как на сервере)
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        // getSymbol автоматически транспонирует координаты в мобильном режиме
        const sprite = this.reelManager.getSymbol(col, row);
        if (!sprite) continue;

        // Ключ в логических координатах
        const key = `${col}_${row}`;
        if (winPositions.has(key)) {
          sprite.alpha = 1.0;
        } else {
          sprite.alpha = this.config.visual.nonWinAlpha;
          this.dimmedSymbols.add(sprite);
        }
      }
    }
  }

  /**
   * Каскадная подсветка выигрышных символов
   * Сначала все символы затемняются, затем выигрышные поочередно становятся яркими
   * с задержкой между каждым
   */
  cascadeHighlight(winPositions: Set<string>): void {
    const { cols, rows } = this.config.dimensions;
    const cascadeDelay = 150; // мс между подсветкой символов
    const nonWinAlpha = this.config.visual.nonWinAlpha;

    // Останавливаем предыдущий каскад, если был
    if (this.cascadeState) {
      cancelAnimationFrame(this.cascadeState.animFrame);
      this.cascadeState = null;
    }

    // 1. Сначала затемняем ВСЕ символы (включая выигрышные)
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbol(col, row);
        if (!sprite) continue;
        sprite.alpha = nonWinAlpha;
        this.dimmedSymbols.add(sprite);
      }
    }

    // 2. Собираем очередь выигрышных символов (только уникальные)
    const queue: { col: number; row: number; sprite: PIXI.Sprite }[] = [];
    const usedKeys = new Set<string>();
    winPositions.forEach(key => {
      if (usedKeys.has(key)) return;
      usedKeys.add(key);
      const [col, row] = key.split('_').map(Number);
      const sprite = this.reelManager.getSymbol(col, row);
      if (!sprite) return;
      queue.push({ col, row, sprite });
    });

    if (queue.length === 0) return;

    // 3. Единый анимационный цикл вместо множества setTimeout
    let currentIndex = 0;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const targetIndex = Math.min(Math.floor(elapsed / cascadeDelay), queue.length - 1);

      // Подсвечиваем все символы до targetIndex включительно
      while (currentIndex <= targetIndex && currentIndex < queue.length) {
        const item = queue[currentIndex];
        item.sprite.alpha = 1.0;
        this.dimmedSymbols.delete(item.sprite);
        this.animateWinSymbol(item.col, item.row);
        currentIndex++;
      }

      // Продолжаем, пока не подсветим все
      if (currentIndex < queue.length) {
        this.cascadeState!.animFrame = requestAnimationFrame(animate);
      } else {
        this.cascadeState = null;
      }
    };

    this.cascadeState = { startTime, delay: cascadeDelay, queue, animFrame: 0 };
    this.cascadeState.animFrame = requestAnimationFrame(animate);
  }

  /**
   * Восстановить яркость всех символов
   */
  resetSymbolsAlpha(): void {
    this.dimmedSymbols.forEach(sprite => { sprite.alpha = 1.0; });
    this.dimmedSymbols.clear();
  }

  /**
   * Добавить рамки редкости только на выигрышные символы
   * winPositions — логические координаты в формате "col_row"
   */
  applyWinnerBorders(winPositions: Set<string>): void {
    const { cols, rows } = this.config.dimensions;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbol(col, row);
        if (!sprite) continue;

        const key = `${col}_${row}`;
        if (winPositions.has(key)) {
          this.symbolFactory.addSymbolBorder(sprite, sprite.name);
        } else {
          this.symbolFactory.removeSymbolBorder(sprite);
        }
      }
    }
  }

  /**
   * Удалить рамки редкости со всех символов
   */
  clearAllBorders(): void {
    const { cols, rows } = this.config.dimensions;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbol(col, row);
        if (!sprite) continue;
        this.symbolFactory.removeSymbolBorder(sprite);
      }
    }
  }

  /**
   * Сбросить все анимации и рамки
   */
  reset(): void {
    // Останавливаем каскадную анимацию
    if (this.cascadeState) {
      cancelAnimationFrame(this.cascadeState.animFrame);
      this.cascadeState = null;
    }

    this.activeAnimations.clear();
    this.originalScales.forEach((scale, sprite) => { sprite.scale.set(scale); });
    this.originalScales.clear();
    this.resetSymbolsAlpha();
    this.clearAllBorders();
  }

  destroy(): void {
    this.reset();
  }
}
