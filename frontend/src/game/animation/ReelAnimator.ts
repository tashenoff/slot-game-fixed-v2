import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager, ReelState } from '../core/ReelManager';

export interface ReelAnimatorCallbacks {
  onReelStop?: (reelIndex: number) => void;
  onAllReelsStopped?: () => void;
}

/**
 * ReelAnimator - анимация вращения и остановки барабанов
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

    for (let c = 0; c < this.config.cols; c++) {
      const timer = window.setTimeout(() => { state[c].stop = true; }, spinTime + c * stopDelay);
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
      if (s.bouncing) {
        allDone = false;
        this.animateBounce(c, s);
      } else if (s.on) {
        allDone = false;
        this.animateSpin(c, s);
      }
    }

    if (allDone) this.finish();
  }

  private animateSpin(col: number, s: ReelState): void {
    const { animation, dimensions } = this.config;
    const blurFilters = this.reelManager.getBlurFilters();
    const barabanSprites = this.reelManager.getBarabanSprites();
    const symbols = this.reelManager.getSymbols();
    const factory = this.reelManager.getSymbolFactory();

    // Обновляем размытие
    const targetBlur = s.stop ? animation.maxBlur * 0.4 : animation.maxBlur;
    blurFilters[col].blurY += (targetBlur - blurFilters[col].blurY) * 0.4;

    // Обновляем позицию
    s.pos += s.stop ? animation.spinSpeed * 0.5 : animation.spinSpeed;

    // Обновляем символы
    const { cellHeight, buffer, rows } = dimensions;
    const offset = s.pos % cellHeight;
    const total = symbols[col].length;

    for (let i = 0; i < total; i++) {
      const sp = symbols[col][i];
      let y = (i - buffer) * cellHeight + cellHeight / 2 + offset;
      if (y > (rows + buffer) * cellHeight) {
        y -= total * cellHeight;
        if (!s.stop) {
          const newSym = factory.getRandomSymbolId();
          factory.updateSymbolTexture(sp, newSym);
        }
      }
      sp.y = y;
    }

    // Обновляем текстуру барабана
    if (barabanSprites[col]) barabanSprites[col].tilePosition.y = s.pos;

    // Проверка на остановку
    if (s.stop && Math.floor(s.pos / cellHeight) >= 3) {
      s.on = false;
      blurFilters[col].blurY = 0;
      this.reelManager.finishReel(col);
      this.callbacks.onReelStop?.(col);
      s.bouncing = true;
      s.bounceStart = Date.now();
    }
  }

  private animateBounce(col: number, s: ReelState): void {
    const { animation, dimensions } = this.config;
    const blurFilters = this.reelManager.getBlurFilters();
    const barabanSprites = this.reelManager.getBarabanSprites();
    const symbols = this.reelManager.getSymbols();

    blurFilters[col].blurY = 0;

    const elapsed = Date.now() - s.bounceStart;
    const progress = Math.min(elapsed / animation.bounceTime, 1);
    const bounce = Math.sin(progress * Math.PI) * animation.bounceHeight * (1 - progress);

    const { cellHeight, buffer, rows } = dimensions;

    for (let r = 0; r < rows; r++) {
      symbols[col][r + buffer].y = r * cellHeight + cellHeight / 2 + bounce;
    }

    if (barabanSprites[col]) barabanSprites[col].tilePosition.y = bounce;

    if (progress >= 1) {
      s.bouncing = false;
      for (let r = 0; r < rows; r++) {
        symbols[col][r + buffer].y = r * cellHeight + cellHeight / 2;
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
