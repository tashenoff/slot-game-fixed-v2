import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';
import { LandingDustEffect, LandingDustOptions } from '../effects/LandingDustEffect';

export interface PushDropAnimatorCallbacks {
  onReelStop?: (reelIndex: number) => void;
  onAllReelsStopped?: () => void;
}

export interface PushDropAnimatorOptions {
  dustEffect?: boolean;
  dustOptions?: LandingDustOptions;
}

interface ColumnPushState {
  col: number;
  offset: number;
  velocity: number;
  phase: 'waiting' | 'falling' | 'bouncing' | 'done';
  bounceStart: number;
  delay: number;
  extras: PIXI.Sprite[];
  gravity: number;
  maxVelocity: number;
  initialVelocity: number;
  travelDistance: number;
}

/**
 * PushDropAnimator — сплошной поток: новые символы сверху сразу
 * толкают старые вниз одной лентой. Плюс ~3 ряда длительности, без подмены в конце.
 * Используется только темой мафии.
 */
export class PushDropAnimator {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private ticker: PIXI.Ticker;
  private callbacks: PushDropAnimatorCallbacks = {};
  private tickFn: ((delta: number) => void) | null = null;
  private isRunning = false;
  private startTime = 0;
  private columnStates: ColumnPushState[] = [];
  private pendingMatrix: string[][] | null = null;
  private dustEffect: LandingDustEffect | null = null;
  private dustEnabled = false;
  private reelsContainer: PIXI.Container | null = null;

  private gravity = 1.8;
  private maxVelocity = 45;
  private initialVelocity = 8;
  private bounceHeight = 12;
  private bounceTime = 150;
  private columnDelay = 60;
  private initialDelay = 50;
  private travelDistance = 0;
  private stepHeight = 0;
  private extraRows = 3;
  private extraCount = 0;

  constructor(config: SlotConfig, reelManager: ReelManager, ticker: PIXI.Ticker, options?: PushDropAnimatorOptions) {
    this.config = config;
    this.reelManager = reelManager;
    this.ticker = ticker;

    const anim = config.animation;
    if (anim.bounceHeight) this.bounceHeight = anim.bounceHeight;
    if (anim.bounceTime) this.bounceTime = anim.bounceTime;
    if (anim.stopDelay) this.columnDelay = anim.stopDelay;

    if (anim.spinTime) {
      const isMobile = !!this.config.dimensions.isMobileLayout;
      this.extraRows = isMobile
        ? Math.min(6, Math.max(3, Math.round(anim.spinTime / 120)))
        : Math.max(3, Math.round(anim.spinTime / 80));
    }

    if (anim.spinSpeed && anim.spinSpeed !== 45) {
      const sm = anim.spinSpeed;
      this.gravity *= sm;
      this.maxVelocity *= sm;
      this.initialVelocity *= sm;
    }

    if (options?.dustEffect) this.dustEnabled = true;
  }

  initDustEffect(reelsContainer: PIXI.Container, options?: LandingDustOptions): void {
    this.reelsContainer = reelsContainer;
    if (this.dustEnabled && reelsContainer) {
      this.dustEffect = new LandingDustEffect(reelsContainer, this.ticker, options);
    }
  }

  setCallbacks(callbacks: PushDropAnimatorCallbacks): void {
    this.callbacks = callbacks;
  }

  setPendingMatrix(matrix: string[][]): void {
    this.pendingMatrix = matrix;
  }

  start(): void {
    if (this.isRunning) this.stop();
    this.isRunning = true;
    this.startTime = performance.now();
    this.initColumnStates();
    this.tickFn = () => this.tick();
    this.ticker.add(this.tickFn);
  }

  private initColumnStates(): void {
    const { rows, cols, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    const visualCols = isMobileLayout ? rows : cols;
    const visualRows = isMobileLayout ? cols : rows;
    this.stepHeight = cellHeight + rowGap;
    const gridHeight = visualRows * cellHeight + (visualRows - 1) * rowGap;

    // 3 лишних ряда + сетка результата — не полноценное вращение
    this.extraCount = this.extraRows + visualRows;
    this.travelDistance = this.extraCount * this.stepHeight;

    const heightScale = Math.max(1, gridHeight / 504);
    this.gravity = 1.8 * heightScale;
    this.maxVelocity = 45 * heightScale;
    this.initialVelocity = 8 * heightScale;
    const anim = this.config.animation;
    if (anim.spinSpeed && anim.spinSpeed !== 45) {
      this.gravity *= anim.spinSpeed;
      this.maxVelocity *= anim.spinSpeed;
      this.initialVelocity *= anim.spinSpeed;
    }

    this.clearExtras();
    this.columnStates = [];

    const reels = this.reelManager.getReels();
    const factory = this.reelManager.getSymbolFactory();

    for (let vCol = 0; vCol < visualCols; vCol++) {
      const extras: PIXI.Sprite[] = [];
      const reel = reels[vCol];

      // Сверху результат (приземлится в сетку), ниже — 3 случайных ряда-толкателя
      for (let i = 0; i < this.extraCount; i++) {
        const symbolId = i < visualRows
          ? this.incomingSymbolId(vCol, i)
          : factory.getRandomSymbolId();
        const extra = factory.createSymbol(symbolId);
        extra.y = (i - this.extraCount) * this.stepHeight + cellHeight / 2;
        extra.alpha = 1;
        extra.zIndex = 1;
        reel?.addChild(extra);
        extras.push(extra);
      }

      for (let vRow = 0; vRow < visualRows; vRow++) {
        const existing = this.reelManager.getSymbolByIndex(vCol, vRow);
        if (existing) {
          existing.y = vRow * this.stepHeight + cellHeight / 2;
          existing.alpha = 1;
        }
      }

      const speedFalloff = isMobileLayout ? (1 - vCol * 0.14) : 1;
      this.columnStates[vCol] = {
        col: vCol,
        offset: 0,
        velocity: 0,
        phase: 'waiting',
        bounceStart: 0,
        delay: this.initialDelay + vCol * this.columnDelay,
        extras,
        gravity: this.gravity * speedFalloff,
        maxVelocity: this.maxVelocity * speedFalloff,
        initialVelocity: this.initialVelocity * speedFalloff,
        travelDistance: this.travelDistance,
      };
    }
  }

  private incomingSymbolId(visualCol: number, visualRow: number): string {
    const { isMobileLayout } = this.config.dimensions;
    if (this.pendingMatrix) {
      const logicalCol = isMobileLayout ? visualRow : visualCol;
      const logicalRow = isMobileLayout ? visualCol : visualRow;
      return this.pendingMatrix[logicalRow][logicalCol];
    }
    return this.reelManager.getSymbolFactory().getRandomSymbolId();
  }

  private tick(): void {
    const elapsed = performance.now() - this.startTime;
    const { rows, cols, isMobileLayout } = this.config.dimensions;
    const visualCols = isMobileLayout ? rows : cols;
    let allDone = true;

    for (let vCol = 0; vCol < visualCols; vCol++) {
      const state = this.columnStates[vCol];
      if (!state || state.phase === 'done') continue;
      allDone = false;
      this.animateColumn(state, elapsed);
    }

    if (allDone) this.finish();
  }

  private animateColumn(state: ColumnPushState, elapsed: number): void {
    if (state.phase === 'waiting') {
      if (elapsed >= state.delay) {
        state.phase = 'falling';
        state.velocity = state.initialVelocity;
      }
      return;
    }

    if (state.phase === 'falling') {
      state.velocity = Math.min(state.velocity + state.gravity, state.maxVelocity);
      state.offset += state.velocity;
      if (state.offset >= state.travelDistance) {
        state.offset = state.travelDistance;
        state.phase = 'bouncing';
        state.bounceStart = performance.now();
        this.triggerDustEffect(state.col);
        this.callbacks.onReelStop?.(state.col);
      }
      this.updateColumnPositions(state);
      return;
    }

    if (state.phase === 'bouncing') {
      const progress = Math.min((performance.now() - state.bounceStart) / this.bounceTime, 1);
      const bounce = Math.sin(progress * Math.PI) * this.bounceHeight * (1 - progress * 0.5);
      state.offset = state.travelDistance + bounce;
      this.updateColumnPositions(state);
      if (progress >= 1) {
        this.settleColumn(state);
        state.phase = 'done';
      }
    }
  }

  private updateColumnPositions(state: ColumnPushState): void {
    const { rows, cols, cellHeight, isMobileLayout } = this.config.dimensions;
    const visualRows = isMobileLayout ? cols : rows;
    const offset = state.offset;

    for (let vRow = 0; vRow < visualRows; vRow++) {
      const existing = this.reelManager.getSymbolByIndex(state.col, vRow);
      if (existing) {
        existing.y = vRow * this.stepHeight + cellHeight / 2 + offset;
      }
    }

    for (let i = 0; i < state.extras.length; i++) {
      const extra = state.extras[i];
      extra.y = (i - this.extraCount) * this.stepHeight + cellHeight / 2 + offset;
    }
  }

  private settleColumn(state: ColumnPushState): void {
    this.promoteLanded(state);
  }

  /**
   * Оставляем прилетевшие символы как основные — без смены текстуры в конце.
   */
  private promoteLanded(state: ColumnPushState): void {
    const { rows, cols, cellHeight, isMobileLayout } = this.config.dimensions;
    const visualRows = isMobileLayout ? cols : rows;

    if (state.extras.length === 0) {
      for (let vRow = 0; vRow < visualRows; vRow++) {
        const sprite = this.reelManager.getSymbolByIndex(state.col, vRow);
        if (!sprite || sprite.destroyed) continue;
        sprite.y = vRow * this.stepHeight + cellHeight / 2;
        sprite.alpha = 1;
        sprite.zIndex = 0;
      }
      state.offset = 0;
      return;
    }

    const resultSprites = state.extras.slice(0, visualRows);
    const fillers = state.extras.slice(visualRows);

    for (let vRow = 0; vRow < visualRows; vRow++) {
      const old = this.reelManager.getSymbolByIndex(state.col, vRow);
      const landed = resultSprites[vRow];
      if (old && old !== landed) {
        old.parent?.removeChild(old);
        old.destroy({ children: true });
      }
      if (landed) {
        landed.y = vRow * this.stepHeight + cellHeight / 2;
        landed.alpha = 1;
        landed.zIndex = 0;
        this.reelManager.setSymbolByIndex(state.col, vRow, landed);
      }
    }

    for (const extra of fillers) {
      extra.parent?.removeChild(extra);
      extra.destroy({ children: true });
    }
    state.extras = [];
    state.offset = 0;
  }

  private triggerDustEffect(visualCol: number): void {
    if (!this.dustEffect) return;
    const { rows, cols, cellHeight, rowGap, cellWidth, reelGap, isMobileLayout } = this.config.dimensions;
    const visualRows = isMobileLayout ? cols : rows;
    const stepHeight = cellHeight + rowGap;
    const colWidth = cellWidth + reelGap;
    const x = visualCol * colWidth + cellWidth / 2;
    const y = (visualRows - 1) * stepHeight + cellHeight;
    this.dustEffect.burst(x, y, cellWidth);
  }

  private finish(): void {
    this.stop();
    this.callbacks.onAllReelsStopped?.();
  }

  private clearExtras(): void {
    for (const state of this.columnStates) {
      for (const extra of state.extras) {
        extra.parent?.removeChild(extra);
        extra.destroy({ children: true });
      }
      state.extras = [];
    }
  }

  stop(): void {
    if (this.tickFn) {
      this.ticker.remove(this.tickFn);
      this.tickFn = null;
    }
    const wasRunning = this.isRunning;
    this.isRunning = false;

    const { rows, cols, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    const visualCols = isMobileLayout ? rows : cols;
    const visualRows = isMobileLayout ? cols : rows;
    const stepHeight = cellHeight + rowGap;

    const hadExtras = this.columnStates.some(s => s.extras.length > 0);
    if (!wasRunning && !hadExtras) return;

    for (const state of this.columnStates) {
      this.promoteLanded(state);
    }
  }

  isAnimating(): boolean {
    return this.isRunning;
  }

  destroy(): void {
    this.stop();
    this.dustEffect?.destroy();
    this.dustEffect = null;
  }
}
