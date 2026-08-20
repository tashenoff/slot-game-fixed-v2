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
    const { spinTime, stopDelay } = this.config.animation;
    const state = this.reelManager.getState();

    // Все барабаны останавливаются по одному таймеру (одновременно если stopDelay=0)
    for (let c = 0; c < this.config.cols; c++) {
      const delay = spinTime + c * stopDelay;
      const timer = window.setTimeout(() => {
        state[c].stop = true;
        state[c].phase = 'stopping';
      }, delay);
      this.timers.push(timer);
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
    const { cellHeight } = dimensions;

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
      const distanceToTarget = s.targetPosition - s.position;
      // Короткая зона торможения - 1 символ
      const shortBrakeZone = cellHeight * 1;
      
      if (distanceToTarget > shortBrakeZone) {
        // Ещё далеко - крутим на полной скорости
        s.velocity = animation.spinSpeed;
        blurFilters[col].blurY = animation.maxBlur;
        s.position += s.velocity;
        s.pos = s.position;
        this.reelManager.updateReelDisplay(col);
      } else if (distanceToTarget > 0) {
        // Быстрое торможение в короткой зоне
        const progress = 1 - (distanceToTarget / shortBrakeZone);
        // Очень резкое торможение с easeOutQuart
        const easedProgress = 1 - Math.pow(1 - progress, 4);
        s.velocity = Math.max(8, animation.spinSpeed * (1 - easedProgress * 0.9));
        
        // Быстрое снижение размытия
        blurFilters[col].blurY = animation.maxBlur * (1 - easedProgress);
        
        s.position += s.velocity;
        s.pos = s.position;
        this.reelManager.updateReelDisplay(col);
      } else {
        // Финальная остановка на целевой позиции
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

    const { cellHeight, rows } = dimensions;

    // Анимируем только видимые символы (используем getSymbol)
    for (let r = 0; r < rows; r++) {
      const sprite = this.reelManager.getSymbol(col, r);
      if (sprite) sprite.y = r * cellHeight + cellHeight / 2 + bounce;
    }

    if (barabanSprites[col]) barabanSprites[col].tilePosition.y = bounce;

    if (progress >= 1) {
      s.bouncing = false;
      s.phase = 'idle';
      // Финальные позиции
      for (let r = 0; r < rows; r++) {
        const sprite = this.reelManager.getSymbol(col, r);
        if (sprite) sprite.y = r * cellHeight + cellHeight / 2;
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
