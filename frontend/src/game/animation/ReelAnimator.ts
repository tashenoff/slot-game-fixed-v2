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
  private bounceOrigY: (number[] | undefined)[] = [];   // [col] -> origY для bounce
  private barabanOrigY: (number | undefined)[] = [];    // [col] -> tilePosition.x для bounce

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

    // Инициализируем состояние
    const state = this.reelManager.getState();
    for (let c = 0; c < this.visualCols; c++) {
      state[c].phase = 'spinning';
      state[c].on = true;
    }

    // Сбрасываем blur фильтры и отображение
    this.reelManager.resetSymbolPositions();

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
    const { spinSpeed, bounceHeight, bounceTime } = this.config.animation;
    const now = Date.now();
    for (let c = 0; c < this.visualCols; c++) {
      const s = state[c];
      if (s.phase === 'spinning') {
        s.position += spinSpeed;
        s.pos = s.position;
        this.reelManager.updateReelDisplay(c);
      } else if (s.phase === 'bouncing') {
        const bElapsed = now - s.bounceStart;
        const bProgress = Math.min(bElapsed / bounceTime, 1);
        // Синусоидальный отскок с затуханием — как в ацтеках
        const offset = Math.sin(bProgress * Math.PI) * bounceHeight * (1 - bProgress);
        
        const allSprites = this.reelManager.getSymbols()[c];
        if (allSprites && this.bounceOrigY[c]) {
          for (let i = 0; i < allSprites.length; i++) {
            if (this.bounceOrigY[c][i] !== undefined) {
              allSprites[i].y = this.bounceOrigY[c][i] + offset;
            }
          }
        }
        
        // Барабан TilingSprite (горизонтальное смещение для классики)
        const barabanSprites = this.reelManager.getBarabanSprites();
        if (barabanSprites[c] && this.barabanOrigY[c] !== undefined) {
          barabanSprites[c].tilePosition.x = this.barabanOrigY[c] + offset;
        }
        
        if (bProgress >= 1) {
          // Восстанавливаем финальные позиции
          if (allSprites && this.bounceOrigY[c]) {
            for (let i = 0; i < allSprites.length; i++) {
              if (this.bounceOrigY[c][i] !== undefined) {
                allSprites[i].y = this.bounceOrigY[c][i];
              }
            }
          }
          if (barabanSprites[c] && this.barabanOrigY[c] !== undefined) {
            barabanSprites[c].tilePosition.x = this.barabanOrigY[c];
          }
          this.onBounceComplete(c, s);
        }
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
   * с задержкой stopDelay между барабанами
   */
  private calculateOrderedStops(): void {
    const state = this.reelManager.getState();
    const { cellHeight, rowGap, cols, rows, isMobileLayout } = this.config.dimensions;
    const { reelStripLength, spinSpeed, stopDelay } = this.config.animation;
    const visualCols = isMobileLayout ? rows : cols;
    const stepHeight = cellHeight + rowGap;
    const stripHeightPx = reelStripLength * stepHeight;

    const capturedPositions: number[] = [];
    const baseTargets: number[] = [];
    for (let c = 0; c < visualCols; c++) {
      capturedPositions[c] = state[c].position;
      baseTargets[c] = this.reelManager.recalculateTargetPosition(c, capturedPositions[c], cellHeight);
    }

    // Каждый следующий барабан должен пролететь дальше
    // чтобы создать эффект последовательной остановки
    // Используем stopDelay для создания минимального разрыва
    const minGapFrames = (stopDelay / 1000) * 60; // stopDelay в кадрах (при 60fps)
    const minGapPixels = spinSpeed * minGapFrames;
    
    for (let c = 1; c < visualCols; c++) {
      const minRequired = baseTargets[c - 1] + minGapPixels;
      if (baseTargets[c] < minRequired) {
        while (baseTargets[c] < minRequired) baseTargets[c] += stripHeightPx;
      }
    }

    // GSAP: плавная остановка с задержкой между барабанами
    for (let c = 0; c < visualCols; c++) {
      // Добавляем задержку для каждого следующего барабана
      const delay = c * stopDelay;
      const capturedTarget = baseTargets[c];
      window.setTimeout(() => {
        // К моменту срабатывания timeout позиция могла убежать вперёд.
        // Добавляем полные обороты, чтобы target был строго ВПЕРЕДИ текущей позиции
        let adjustedTarget = capturedTarget;
        while (adjustedTarget <= state[c].position) {
          adjustedTarget += stripHeightPx;
        }
        this.stopReelWithGSAP(c, state[c], adjustedTarget);
      }, delay);
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
    // power2.out: производная в начале = 2, значит v_initial = 2 * distance / duration
    // Хотим чтобы начальная скорость совпала с текущей: spinSpeed * 60 пикселей/сек
    // duration = 2 * distance / (spinSpeed * 60)
    const duration = Math.max(0.2, Math.min(0.5, (distance / spinSpeed / 60) * 2.0));

    // Плавно убираем motion blur
    gsap.killTweensOf(blurFilters[col]);
    gsap.to(blurFilters[col], {
      blurY: 0,
      duration: duration * 0.5,
      ease: 'power2.out'
    });

    // GSAP: position → target с плавным замедлением (без ускорения в середине)
    gsap.to(s, {
      position: targetPosition,
      duration: duration,
      ease: 'power2.out',
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
    const { cellHeight, rowGap, rows, cols, isMobileLayout } = dimensions;
    
    const allSymbols = this.reelManager.getSymbols();
    const allSprites = allSymbols[col];
    
    if (!allSprites || allSprites.length === 0) {
      this.onBounceComplete(col, s);
      return;
    }
    
    // Сохраняем origY для ВСЕХ спрайтов — tick сам обновит их Y
    this.bounceOrigY[col] = allSprites.map(sp => sp.y);
    
    // Сохраняем позицию барабана TilingSprite
    const barabanSprites = this.reelManager.getBarabanSprites();
    if (barabanSprites[col]) {
      this.barabanOrigY[col] = barabanSprites[col].tilePosition.x;
    } else {
      this.barabanOrigY[col] = undefined;
    }
    
    s.phase = 'bouncing';
    s.bouncing = true;
    s.bounceStart = Date.now();
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

    // Восстанавливаем позиции спрайтов, если bounce прерван
    for (let c = 0; c < state.length; c++) {
      if (state[c].phase === 'bouncing' && this.bounceOrigY[c]) {
        const allSprites = this.reelManager.getSymbols()[c];
        if (allSprites) {
          for (let i = 0; i < allSprites.length; i++) {
            if (this.bounceOrigY[c][i] !== undefined) {
              allSprites[i].y = this.bounceOrigY[c][i];
            }
          }
        }
        const barabanSprites = this.reelManager.getBarabanSprites();
        if (barabanSprites[c] && this.barabanOrigY[c] !== undefined) {
          barabanSprites[c].tilePosition.x = this.barabanOrigY[c];
        }
      }
    }

    this.reelManager.getBlurFilters().forEach(blur => gsap.killTweensOf(blur));
    this.reelManager.getBarabanSprites().forEach(sp => {
      if (sp) gsap.killTweensOf(sp.tilePosition);
    });

    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.bounceOrigY = [];
    this.barabanOrigY = [];
    this.isRunning = false;
  }

  isAnimating(): boolean {
    return this.isRunning;
  }
}
