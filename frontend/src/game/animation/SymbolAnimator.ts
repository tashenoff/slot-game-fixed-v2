import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';

/**
 * SymbolAnimator - анимация символов (масштабирование, затемнение)
 */
export class SymbolAnimator {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private originalScales: Map<PIXI.Sprite, number> = new Map();
  private dimmedSymbols: Set<PIXI.Sprite> = new Set();
  private activeAnimations: Set<number> = new Set();

  constructor(config: SlotConfig, reelManager: ReelManager) {
    this.config = config;
    this.reelManager = reelManager;
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
   */
  dimNonWinSymbols(winPositions: Set<string>): void {
    const { cols, rows } = this.config.dimensions;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbol(col, row);
        if (!sprite) continue;

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
   * Восстановить яркость всех символов
   */
  resetSymbolsAlpha(): void {
    this.dimmedSymbols.forEach(sprite => { sprite.alpha = 1.0; });
    this.dimmedSymbols.clear();
  }

  /**
   * Сбросить все анимации
   */
  reset(): void {
    this.activeAnimations.clear();
    this.originalScales.forEach((scale, sprite) => { sprite.scale.set(scale); });
    this.originalScales.clear();
    this.resetSymbolsAlpha();
  }

  destroy(): void {
    this.reset();
  }
}
