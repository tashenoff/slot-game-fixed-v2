import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager, ReelState } from '../core/ReelManager';

export interface ReelAnimatorCallbacks {
  onReelStop?: (reelIndex: number) => void;
  onAllReelsStopped?: () => void;
}

/**
 * ReelAnimator - анимация вращения барабанов с настоящей лентой символов
 *
 * Переписано на GSAP:
 * - Остановка:  ручная distanceToTarget → gsap.to(position, ease: 'power2.inOut')
 * - Bounce:     Math.sin + Date.now() → gsap.to(y, ease: 'bounce.out')
 * - Motion blur:ручное приближение → gsap.to(blurY)
 */
export class ReelAnimator {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private ticker: PIXI.Ticker;
  private callbacks: ReelAnimatorCallbacks = {};
  private tickFn: ((delta: number) => void) | null = null;
  private timers: number[] = [];
  private isRunning = false;
  private visualCols = 0;
  private stoppedCount = 0;

  constructor(config: SlotConfig, reelManager: ReelManager, ticker: PIXI.Ticker) {
    this.config = config;
    this.reelManager = reelManager;
    this.ticker = ticker;
  }

  setCallbacks(callbacks: ReelAnimatorCallbacks): void {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stoppedCount = 0;

    const { rows, cols, isMobileLayout } = this.config.dimensions;
    this.visualCols = isMobileLayout ? rows : cols;

    this.reelManager.resetSymbolPositions();

    // Инициализируем состояние
    const state = this.reelManager.getState();
    for (let c = 0; c < this.visualCols; c++) {
      state[c].phase = 'spinning';
      state[c].on = true;
    }

    // GSAP: разгон motion blur
    const blurFilters = this.reelManager.getBlurFilters();
    blurFilters.forEach(blur => {
      gsap.killTweensOf(blur);
      gsap.to(blur, {
        blurY: this.config.animation.maxBlur,
        duration: 0.15,
        ease: 'power1.out'
      });
    });

    this.scheduleStops();

    // Tick только для spinning (position += speed)
    this.tickFn = () => this.tick();
    this.ticker.add(this.tickFn);
  }

  private tick(): void {
    const state = this.reelManager.getState();
    const { spinSpeed } = this.config.animation;
    for (let c = 0; c < this.visualCols; c++) {
      const s = state[c];
      if (s.phase === 'spinning') {
        s.position += spinSpeed;
        s.pos = s.position;
        this.reelManager.updateReelDisplay(c);
      }
    }
  }

  private scheduleStops(): void {
    const { spinTime } = this.config.animation;
    const timer = window.setTimeout(() => {
      this.calculateOrderedStops();
    }, spinTime);
    this.timers.push(timer);
  }

  /**
   * Рассчитать дистанции для всех барабанов так, чтобы они останавливались слева направо
   */
  private calculateOrderedStops(): void {
    const state = this.reelManager.getState();
    const { cellHeight, rowGap, cols, rows, isMobileLayout } = this.config.dimensions;
    const { reelStripLength, spinSpeed } = this.config.animation;
    const visualCols = isMobileLayout ? rows : cols;
    const stepHeight = cellHeight + rowGap;
    const stripHeightPx = reelStripLength * stepHeight;
    const minGap = spinSpeed * 2;

    const distances: number[] = [];
    for (let c = 0; c < visualCols; c++) {
      const baseTarget = this.reelManager.recalculateTargetPosition(c, state[c].position, cellHeight);
      distances[c] = baseTarget - state[c].position;
    }

    for (let c = 1; c < visualCols; c++) {
      const minRequired = distances[c - 1] + minGap;
      if (distances[c] < minRequired) {
        while (distances[c] < minRequired) distances[c] += stripHeightPx;
      }
    }

    // GSAP: плавная остановка вместо ручного distanceToTarget
    for (let c = 0; c < visualCols; c++) {
      this.stopReelWithGSAP(c, state[c], state[c].position + distances[c]);
    }
  }

  /**
   * GSAP-анимация остановки одного барабана
   * Вместо ручного position += velocity + distanceToTarget в tick
   */
  private stopReelWithGSAP(col: number, s: ReelState, targetPosition: number): void {
    const blurFilters = this.reelManager.getBlurFilters();
    const { spinSpeed } = this.config.animation;

    s.phase = 'stopping';
    s.targetPosition = targetPosition;
    s.targetRecalculated = true;

    const distance = targetPosition - s.position;
    const duration = Math.max(0.15, (distance / spinSpeed / 60) * 1.2);

    // Плавно убираем motion blur
    gsap.killTweensOf(blurFilters[col]);
    gsap.to(blurFilters[col], {
      blurY: 0,
      duration: duration * 0.6,
      ease: 'power2.in'
    });

    // GSAP: position → target с замедлением
    gsap.to(s, {
      position: targetPosition,
      duration: duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        s.pos = s.position;
        this.reelManager.updateReelDisplay(col);
      },
      onComplete: () => {
        s.position = targetPosition;
        s.pos = s.position;
        s.velocity = 0;
        this.reelManager.updateReelDisplay(col);
        this.reelManager.finishReel(col);
        this.bounceReelWithGSAP(col, s);
      }
    });
  }

  /**
   * GSAP-анимация отскока барабана при остановке
   * Вместо Math.sin(progress * PI) * bounceHeight * (1 - progress)
   */
  private bounceReelWithGSAP(col: number, s: ReelState): void {
    const { dimensions, animation } = this.config;
    const { cellHeight, rowGap, rows } = dimensions;
    const stepHeight = cellHeight + rowGap;
    const barabanSprites = this.reelManager.getBarabanSprites();
    const symbols: PIXI.Sprite[] = [];

    for (let r = 0; r < rows; r++) {
      const sprite = this.reelManager.getSymbol(col, r);
      if (sprite) symbols.push(sprite);
    }

    if (symbols.length === 0) {
      this.onBounceComplete(col, s);
      return;
    }

    const origY = symbols.map(sp => sp.y);
    s.phase = 'bouncing';
    s.bouncing = true;
    s.bounceStart = Date.now();

    // GSAP: подбрасываем символы вверх с отскоком (вместо ручного синуса)
    symbols.forEach((sp, i) => {
      gsap.killTweensOf(sp);
      gsap.to(sp, {
        y: origY[i] - animation.bounceHeight,
        duration: animation.bounceTime / 1000,
        ease: 'bounce.out',
        onComplete: () => { sp.y = origY[i]; }
      });
    });

    // Анимация барабана TilingSprite
    if (barabanSprites[col]) {
      gsap.killTweensOf(barabanSprites[col].tilePosition);
      gsap.to(barabanSprites[col].tilePosition, {
        x: -animation.bounceHeight,
        duration: animation.bounceTime / 1000,
        ease: 'bounce.out',
        onComplete: () => { barabanSprites[col].tilePosition.x = 0; }
      });
    }

    const timer = window.setTimeout(() => this.onBounceComplete(col, s), animation.bounceTime);
    this.timers.push(timer);
  }

  private onBounceComplete(col: number, s: ReelState): void {
    s.bouncing = false;
    s.phase = 'idle';
    s.on = false;
    this.callbacks.onReelStop?.(col);
    this.stoppedCount++;
    if (this.stoppedCount >= this.visualCols) this.finish();
  }

  private finish(): void {
    this.stop();
    this.callbacks.onAllReelsStopped?.();
  }

  stop(): void {
    if (this.tickFn) {
      this.ticker.remove(this.tickFn);
      this.tickFn = null;
    }

    // Убиваем все GSAP-анимации
    const state = this.reelManager.getState();
    for (let c = 0; c < state.length; c++) {
      gsap.killTweensOf(state[c]);
      for (let r = 0; r < this.config.dimensions.rows; r++) {
        const sprite = this.reelManager.getSymbol(c, r);
        if (sprite) gsap.killTweensOf(sprite);
      }
    }

    this.reelManager.getBlurFilters().forEach(blur => gsap.killTweensOf(blur));
    this.reelManager.getBarabanSprites().forEach(sp => {
      if (sp) gsap.killTweensOf(sp.tilePosition);
    });

    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.isRunning = false;
  }

  isAnimating(): boolean {
    return this.isRunning;
  }
}
