import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';
import { SymbolFactory } from '../core/SymbolFactory';
import { SYMBOL_CONTENT_CHILD } from '../symbols/symbolVisual';

/**
 * SymbolAnimator - анимация символов (масштабирование, затемнение, рамки редкости)
 * 
 * Переписано на GSAP: ручной requestAnimationFrame + easing → gsap.to()
 * - Пульсация:   ~35 строк → 1 вызов gsap.to с yoyo
 * - Каскад:      ~50 строк → gsap timeline со stagger
 * - Easing:      ручной easeOutQuad/easeInQuad → встроенные power2.out / back.out
 */
export class SymbolAnimator {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private symbolFactory: SymbolFactory;
  private originalScales: Map<PIXI.Sprite, number> = new Map();
  private dimmedSymbols: Set<PIXI.Sprite> = new Set();
  private cascadeState: {
    startTime: number;
    delay: number;
    queue: { col: number; row: number; sprite: PIXI.Sprite }[];
    animFrame: number;
  } | null = null;
  private useDarkOverlay: boolean;
  /** Имя дочернего Graphics для тёмной накладки */
  static readonly DIM_OVERLAY_NAME = '_dimOverlay';

  constructor(config: SlotConfig, reelManager: ReelManager, symbolFactory: SymbolFactory, useDarkOverlay?: boolean) {
    this.config = config;
    this.reelManager = reelManager;
    this.symbolFactory = symbolFactory;
    this.useDarkOverlay = useDarkOverlay ?? false;
  }

  /**
   * Анимация масштабирования выигрышного символа
   * Раньше: ~35 строк с performance.now() + requestAnimationFrame + ручной easing
   * Сейчас: 1 вызов gsap.to с yoyo
   */
  animateWinSymbol(col: number, row: number): void {
    const sprite = this.reelManager.getSymbol(col, row);
    if (!sprite) return;

    const content = sprite.getChildByName(SYMBOL_CONTENT_CHILD) as PIXI.Sprite | null;
    const target = content ?? sprite;
    const scaleObj = target.scale;

    if (!this.originalScales.has(target as unknown as PIXI.Sprite)) {
      this.originalScales.set(target as unknown as PIXI.Sprite, scaleObj.x);
    }

    const originalScale = this.originalScales.get(target as unknown as PIXI.Sprite)!;
    const targetScale = originalScale * this.config.animation.winSymbolScale;
    const duration = this.config.animation.winAnimationDuration / 1000;

    gsap.killTweensOf(scaleObj);

    gsap.to(scaleObj, {
      x: targetScale,
      y: targetScale,
      duration: duration / 2,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        scaleObj.set(originalScale);
      }
    });

    this.symbolFactory.playWinAnimations(sprite);
  }

  /**
   * Возвращает размер символа в пикселях
   */
  private getSymbolPixelSize(): number {
    const { cellWidth, cellHeight, dimensions } = this.config;
    const maxSize = Math.min(cellWidth, cellHeight);
    return maxSize * dimensions.symbolSizeRatio;
  }

  /**
   * Создать тёмную полупрозрачную накладку поверх спрайта (альтернатива alpha)
   */
  private addDimOverlay(sprite: PIXI.Sprite): void {
    if (sprite.getChildByName(SymbolAnimator.DIM_OVERLAY_NAME)) return;
    const size = this.getSymbolPixelSize();
    const overlay = new PIXI.Graphics();
    overlay.name = SymbolAnimator.DIM_OVERLAY_NAME;
    overlay.beginFill(0x000000, 0.55);
    overlay.drawRoundedRect(-size / 2, -size / 2, size, size, 4);
    overlay.endFill();
    sprite.addChild(overlay);
  }

  /**
   * Удалить тёмную накладку со спрайта
   */
  private removeDimOverlay(sprite: PIXI.Sprite): void {
    const overlay = sprite.getChildByName(SymbolAnimator.DIM_OVERLAY_NAME);
    if (overlay) {
      sprite.removeChild(overlay);
      overlay.destroy();
    }
  }

  /**
   * Удалить накладки со всех символов
   */
  private clearAllDimOverlays(): void {
    const { cols, rows } = this.config.dimensions;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbol(col, row);
        if (sprite) this.removeDimOverlay(sprite);
      }
    }
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
          this.removeDimOverlay(sprite);
        } else {
          if (this.useDarkOverlay) {
            sprite.alpha = 1.0;
            this.addDimOverlay(sprite);
          } else {
            sprite.alpha = this.config.visual.nonWinAlpha;
          }
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
    const cascadeDelay = 0.08; // секунды между подсветкой символов (80ms)

    // Останавливаем предыдущий каскад, если был
    if (this.cascadeState) {
      this.cascadeState.queue.forEach(item => gsap.killTweensOf(item.sprite));
      this.cascadeState = null;
    }

    // 1. Сначала затемняем ВСЕ символы (включая выигрышные)
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbol(col, row);
        if (!sprite) continue;
        if (this.useDarkOverlay) {
          sprite.alpha = 1.0;
          this.addDimOverlay(sprite);
        } else {
          sprite.alpha = this.config.visual.nonWinAlpha;
        }
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

    // 3. GSAP Timeline: каскадная подсветка
    const tl = gsap.timeline();
    queue.forEach((item, i) => {
      if (this.useDarkOverlay) {
        // Удаляем overlay — символ становится ярким
        tl.call(() => {
          this.removeDimOverlay(item.sprite);
        }, [], i * cascadeDelay)
        .call(() => {
          this.dimmedSymbols.delete(item.sprite);
          this.animateWinSymbol(item.col, item.row);
        }, [], `-=${0.03}`);
      } else {
        tl.to(item.sprite, {
          alpha: 1.0,
          duration: 0.15,
          ease: 'power2.out',
        }, i * cascadeDelay)
        .call(() => {
          this.dimmedSymbols.delete(item.sprite);
          this.animateWinSymbol(item.col, item.row);
        }, [], `-=${0.05}`);
      }
    });

    // Сохраняем для возможности отмены
    this.cascadeState = {
      startTime: performance.now(),
      delay: cascadeDelay * 1000,
      queue,
      animFrame: 0
    };
  }

  /**
   * Восстановить яркость всех символов
   */
  resetSymbolsAlpha(): void {
    this.dimmedSymbols.forEach(sprite => {
      if (!sprite.destroyed) {
        sprite.alpha = 1.0;
        this.removeDimOverlay(sprite);
      }
    });
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
    // Убиваем все GSAP-анимации на scale (animateWinSymbol)
    this.originalScales.forEach((scale, sprite) => {
      if (!sprite || sprite.destroyed) return;
      gsap.killTweensOf(sprite.scale);
      sprite.scale.set(scale);
    });
    this.originalScales.clear();

    // Убиваем каскадную анимацию
    if (this.cascadeState) {
      this.cascadeState.queue.forEach(item => gsap.killTweensOf(item.sprite));
      this.cascadeState = null;
    }

    this.resetSymbolsAlpha();
    this.clearAllDimOverlays();
    this.clearAllBorders();
    this.stopAllWinAnimations();
  }

  private stopAllWinAnimations(): void {
    const { cols, rows } = this.config.dimensions;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbol(col, row);
        if (sprite) this.symbolFactory.stopWinAnimations(sprite);
      }
    }
  }

  destroy(): void {
    this.reset();
  }
}
