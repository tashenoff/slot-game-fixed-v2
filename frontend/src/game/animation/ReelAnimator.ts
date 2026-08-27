import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager, ReelState } from '../core/ReelManager';

export interface ReelAnimatorCallbacks {
  onReelStop?: (reelIndex: number) => void;
  onAllReelsStopped?: () => void;
}

/**
 * ReelAnimator - анимация вращения барабанов с настоящей лентой символов
 * Лента прокручивается плавно до целевой позиции без замены текстур
 */
export class ReelAnimator {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private ticker: PIXI.Ticker;
  private callbacks: ReelAnimatorCallbacks = {};
  private tickFn: ((delta: number) => void) | null = null;
  private timers: number[] = [];
  private isRunning = false;

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
    this.reelManager.resetSymbolPositions();
    this.scheduleStops();
    this.runAnimation();
  }

  private scheduleStops(): void {
    const { spinTime } = this.config.animation;
    
    // Один таймер для всех барабанов - рассчитываем дистанции так,
    // чтобы барабаны останавливались слева направо
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
    const { cellHeight, rowGap, cols } = this.config.dimensions;
    const { reelStripLength, spinSpeed } = this.config.animation;
    // Шаг между символами с учётом зазора
    const stepHeight = cellHeight + rowGap;
    const stripHeightPx = reelStripLength * stepHeight;
    
    // Минимальная разница между остановками барабанов (в пикселях)
    // Примерно 2 кадра разницы между остановками
    const minGap = spinSpeed * 2;
    
    // Сначала рассчитываем базовые дистанции для всех барабанов
    const distances: number[] = [];
    for (let c = 0; c < cols; c++) {
      const baseTarget = this.reelManager.recalculateTargetPosition(c, state[c].position, cellHeight);
      distances[c] = baseTarget - state[c].position;
    }
    
    // Корректируем дистанции чтобы каждый следующий барабан останавливался позже
    for (let c = 1; c < cols; c++) {
      const minRequired = distances[c - 1] + minGap;
      if (distances[c] < minRequired) {
        // Добавляем ПОЛНЫЕ обороты чтобы сохранить выравнивание на финальные символы
        while (distances[c] < minRequired) {
          distances[c] += stripHeightPx;
        }
      }
    }
    
    // Устанавливаем скорректированные целевые позиции и переводим в режим остановки
    for (let c = 0; c < cols; c++) {
      state[c].targetPosition = state[c].position + distances[c];
      state[c].targetRecalculated = true;
      state[c].stop = true;
      state[c].phase = 'stopping';
    }
  }

  private runAnimation(): void {
    this.tickFn = () => this.tick();
    this.ticker.add(this.tickFn);
  }

  private tick(): void {
    const state = this.reelManager.getState();
    const { cols } = this.config.dimensions;
    let allDone = true;

    for (let c = 0; c < cols; c++) {
      const s = state[c];
      if (s.phase === 'bouncing') {
        allDone = false;
        this.animateBounce(c, s);
      } else if (s.on) {
        allDone = false;
        this.animateReel(c, s);
      }
    }

    if (allDone) this.finish();
  }

  private animateReel(col: number, s: ReelState): void {
    const { animation, dimensions } = this.config;
    const blurFilters = this.reelManager.getBlurFilters();
    const { cellHeight, rowGap } = dimensions;
    const { reelStripLength } = animation;
    // Шаг между символами с учётом зазора
    const stepHeight = cellHeight + rowGap;
    const stripHeightPx = reelStripLength * stepHeight;

    if (s.phase === 'spinning') {
      s.velocity = animation.spinSpeed;
      // Быстрое нарастание размытия для выраженного motion blur
      const targetBlur = animation.maxBlur;
      blurFilters[col].blurY += (targetBlur - blurFilters[col].blurY) * 0.5;
      
      // Продолжаем крутить
      s.position += s.velocity;
      s.pos = s.position;
      this.reelManager.updateReelDisplay(col);
    } else if (s.phase === 'stopping') {
      // targetPosition уже рассчитан в calculateOrderedStops()
      const distanceToTarget = s.targetPosition - s.position;
      
      if (distanceToTarget > s.velocity) {
        // Ещё не доехали - продолжаем крутить на полной скорости
        s.velocity = animation.spinSpeed;
        blurFilters[col].blurY = animation.maxBlur;
        s.position += s.velocity;
        s.pos = s.position;
        this.reelManager.updateReelDisplay(col);
      } else {
        // Доехали до цели - мгновенная остановка
        s.position = s.targetPosition;
        s.velocity = 0;
        s.on = false;
        s.phase = 'bouncing';
        s.bouncing = true;
        s.bounceStart = Date.now();
        blurFilters[col].blurY = 0;
        this.reelManager.finishReel(col);
        this.reelManager.updateReelDisplay(col);
        this.callbacks.onReelStop?.(col);
      }
    }
  }

  private snapToFinalPosition(col: number, s: ReelState): void {
    // Позиция уже установлена на targetPosition в animateReel
    // Просто обновляем отображение
    this.reelManager.updateReelDisplay(col);
  }

  private animateBounce(col: number, s: ReelState): void {
    const { animation, dimensions } = this.config;
    const blurFilters = this.reelManager.getBlurFilters();
    const barabanSprites = this.reelManager.getBarabanSprites();

    blurFilters[col].blurY = 0;

    const elapsed = Date.now() - s.bounceStart;
    const progress = Math.min(elapsed / animation.bounceTime, 1);
    const bounce = Math.sin(progress * Math.PI) * animation.bounceHeight * (1 - progress);

    const { cellHeight, rowGap, rows } = dimensions;
    // Шаг между символами с учётом зазора
    const stepHeight = cellHeight + rowGap;

    // Анимируем только видимые символы (используем getSymbol)
    for (let r = 0; r < rows; r++) {
      const sprite = this.reelManager.getSymbol(col, r);
      if (sprite) sprite.y = r * stepHeight + cellHeight / 2 + bounce;
    }

    if (barabanSprites[col]) barabanSprites[col].tilePosition.y = bounce;

    if (progress >= 1) {
      s.bouncing = false;
      s.phase = 'idle';
      // Финальные позиции
      for (let r = 0; r < rows; r++) {
        const sprite = this.reelManager.getSymbol(col, r);
        if (sprite) sprite.y = r * stepHeight + cellHeight / 2;
      }
      if (barabanSprites[col]) barabanSprites[col].tilePosition.y = 0;
    }
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
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.isRunning = false;
  }

  isAnimating(): boolean {
    return this.isRunning;
  }
}
