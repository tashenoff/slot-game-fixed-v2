import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';
import { LandingDustEffect, LandingDustOptions } from '../effects/LandingDustEffect';

export interface CascadeAnimatorCallbacks {
  onReelStop?: (reelIndex: number) => void;
  onAllReelsStopped?: () => void;
}

export interface CascadeAnimatorOptions {
  dustEffect?: boolean;
  dustOptions?: LandingDustOptions;
}

type Phase = 'exit-waiting' | 'exiting' | 'enter-waiting' | 'entering' | 'bouncing' | 'done';

interface SymbolCascadeState {
  visualCol: number;
  visualRow: number;
  targetY: number;
  offset: number;
  velocity: number;
  phase: Phase;
  exitDelay: number;   // Задержка перед вылетом (последний ряд → первый)
  enterDelay: number;  // Задержка перед входом (последний ряд → первый)
  bounceStart: number;
}

/**
 * CascadeDropAnimator — каскадная анимация: каждый символ сначала
 * улетает вниз (exit), потом падает сверху (enter) с задержками.
 */
export class CascadeDropAnimator {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private ticker: PIXI.Ticker;
  private callbacks: CascadeAnimatorCallbacks = {};
  private tickFn: ((delta: number) => void) | null = null;
  private isRunning = false;
  private startTime = 0;
  private symbolStates: SymbolCascadeState[] = [];
  private pendingMatrix: string[][] | null = null;
  private dustEffect: LandingDustEffect | null = null;
  private dustEnabled = false;
  private reelsContainer: PIXI.Container | null = null;

  private gravity = 2.0;
  private maxVelocity = 50;
  private exitVelocity = 30;
  private exitDistance = 700;
  private enterStartDistance = 600;
  private bounceHeight = 14;
  private bounceTime = 160;
  private rowDelay = 80;
  private symbolStaggerDelay = 30;
  private initialDelay = 30;
  private exitDelay = 40;

  constructor(config: SlotConfig, reelManager: ReelManager, ticker: PIXI.Ticker, options?: CascadeAnimatorOptions) {
    this.config = config;
    this.reelManager = reelManager;
    this.ticker = ticker;
    const anim = config.animation;
    if (anim.bounceHeight) this.bounceHeight = anim.bounceHeight;
    if (anim.bounceTime) this.bounceTime = anim.bounceTime;
    if (anim.stopDelay) this.rowDelay = anim.stopDelay;
    if (anim.spinSpeed && anim.spinSpeed !== 45) {
      const sm = anim.spinSpeed;
      this.gravity *= sm; this.maxVelocity *= sm; this.exitVelocity *= sm;
      this.exitDistance = Math.round(this.exitDistance * sm);
      this.enterStartDistance = Math.round(this.enterStartDistance * sm);
      this.rowDelay = Math.round(this.rowDelay / sm);
      this.symbolStaggerDelay = Math.round(this.symbolStaggerDelay / sm);
      this.initialDelay = Math.round(this.initialDelay / sm);
      this.exitDelay = Math.round(this.exitDelay / sm);
    }
    if (options?.dustEffect) this.dustEnabled = true;
  }

  setCallbacks(callbacks: CascadeAnimatorCallbacks): void { this.callbacks = callbacks; }
  setPendingMatrix(matrix: string[][]): void { this.pendingMatrix = matrix; }

  initDustEffect(reelsContainer: PIXI.Container, options?: LandingDustOptions): void {
    this.reelsContainer = reelsContainer;
    if (this.dustEnabled && reelsContainer) {
      this.dustEffect = new LandingDustEffect(reelsContainer, this.ticker, options);
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now();
    const { rows, cols, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    const visualCols = isMobileLayout ? rows : cols;
    const visualRows = isMobileLayout ? cols : rows;
    const stepHeight = cellHeight + rowGap;

    // Включаем sortableChildren для всех рилов
    for (let vCol = 0; vCol < visualCols; vCol++) {
      const sprite = this.reelManager.getSymbolByIndex(vCol, 0);
      if (sprite?.parent) sprite.parent.sortableChildren = true;
    }

    this.symbolStates = [];
    for (let vRow = 0; vRow < visualRows; vRow++) {
      for (let vCol = 0; vCol < visualCols; vCol++) {
        const targetY = vRow * stepHeight + cellHeight / 2;
        // reversedRow — последний ряд (визуально нижний) стартует первым
        const reversedRow = visualRows - 1 - vRow;
        const exitDelay = this.initialDelay + reversedRow * this.rowDelay + vCol * this.symbolStaggerDelay;
        const enterDelay = this.exitDelay + reversedRow * this.rowDelay * 0.5 + vCol * this.symbolStaggerDelay * 0.5;
        this.symbolStates.push({
          visualCol: vCol, visualRow: vRow,
          targetY, offset: 0, velocity: 0,
          phase: 'exit-waiting' as Phase,
          exitDelay, enterDelay, bounceStart: 0,
        });
      }
    }
    this.tickFn = () => this.tick();
    this.ticker.add(this.tickFn);
  }

  private tick(): void {
    const now = performance.now();
    const elapsed = now - this.startTime;
    let allDone = true;
    for (const state of this.symbolStates) {
      this.updateSymbolState(state, now, elapsed);
      if (state.phase !== 'done') allDone = false;
      this.updateSymbolPosition(state);
    }
    if (allDone) this.finish();
  }

  private updateSymbolState(state: SymbolCascadeState, now: number, elapsed: number): void {
    switch (state.phase) {
      case 'exit-waiting':
        if (elapsed >= state.exitDelay) { state.phase = 'exiting'; state.velocity = this.exitVelocity; }
        break;
      case 'exiting':
        state.offset += state.velocity;
        state.velocity = Math.min(state.velocity + 0.5, this.maxVelocity);
        if (state.offset > this.exitDistance) {
          if (this.pendingMatrix) {
            const { isMobileLayout } = this.config.dimensions;
            const lCol = isMobileLayout ? state.visualRow : state.visualCol;
            const lRow = isMobileLayout ? state.visualCol : state.visualRow;
            this.reelManager.updateSymbolTexture(state.visualCol, state.visualRow, this.pendingMatrix[lRow][lCol]);
          }
          state.offset = -this.enterStartDistance;
          state.velocity = 0;
          state.phase = 'enter-waiting';
        }
        break;
      case 'enter-waiting':
        if (elapsed >= state.enterDelay) { state.phase = 'entering'; }
        break;
      case 'entering':
        state.velocity = Math.min(state.velocity + this.gravity, this.maxVelocity);
        state.offset += state.velocity;
        if (state.offset >= 0) {
          state.offset = 0; state.velocity = 0; state.phase = 'bouncing';
          state.bounceStart = now;
          this.triggerDustEffectAt(state.visualCol, state.visualRow);
        }
        break;
      case 'bouncing': {
        const bElapsed = now - state.bounceStart;
        const bProgress = Math.min(bElapsed / this.bounceTime, 1);
        state.offset = Math.sin(bProgress * Math.PI) * this.bounceHeight * (1 - bProgress);
        if (bProgress >= 1) { state.offset = 0; state.phase = 'done'; }
        break;
      }
      case 'done': break;
    }
  }

  private updateSymbolPosition(state: SymbolCascadeState): void {
    const sprite = this.reelManager.getSymbolByIndex(state.visualCol, state.visualRow);
    if (!sprite) return;

    // Позиция Y
    sprite.y = state.targetY + state.offset;

    // zIndex: вылетающие (exiting) позади, падающие (entering/bouncing) — сверху
    // exit-waiting/done — нормальный порядок (zIndex = 0)
    switch (state.phase) {
      case 'exiting':
        sprite.zIndex = -1;
        // Fade out: прозрачность уменьшается по мере вылета
        sprite.alpha = Math.max(0.2, 1.0 - state.offset / this.exitDistance);
        break;
      case 'enter-waiting':
      case 'entering':
      case 'bouncing':
        sprite.zIndex = 1;
        // Fade in: прозрачность увеличивается по мере падения
        if (state.phase === 'entering') {
          const enterProgress = Math.min(1.0, (this.enterStartDistance + state.offset) / this.enterStartDistance);
          sprite.alpha = Math.min(1.0, Math.max(0.2, enterProgress + 0.1));
        } else if (state.phase === 'bouncing') {
          sprite.alpha = 1.0;
        } else { // enter-waiting
          sprite.alpha = 0.3;
        }
        break;
      default:
        sprite.zIndex = 0;
        sprite.alpha = 1.0;
        break;
    }
  }

  private triggerDustEffectAt(visualCol: number, visualRow: number): void {
    if (!this.dustEffect) return;
    const { cellWidth, reelGap, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    const colWidth = cellWidth + reelGap;
    const stepHeight = cellHeight + rowGap;
    const visualRows = isMobileLayout ? this.config.dimensions.cols : this.config.dimensions.rows;
    const x = visualCol * colWidth + cellWidth / 2;
    const y = Math.min(visualRow * stepHeight + cellHeight, (visualRows - 1) * stepHeight + cellHeight);
    this.dustEffect.burst(x, y, cellWidth * 0.6);
  }

  private finish(): void { this.stop(); this.callbacks.onAllReelsStopped?.(); }

  stop(): void {
    if (this.tickFn) { this.ticker.remove(this.tickFn); this.tickFn = null; }
    this.isRunning = false;
    const { rows, cols, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    const visualCols = isMobileLayout ? rows : cols;
    const visualRows = isMobileLayout ? cols : rows;
    const stepHeight = cellHeight + rowGap;
    for (let vCol = 0; vCol < visualCols; vCol++) {
      for (let vRow = 0; vRow < visualRows; vRow++) {
        const sprite = this.reelManager.getSymbolByIndex(vCol, vRow);
        if (sprite) {
          sprite.y = vRow * stepHeight + cellHeight / 2;
          sprite.alpha = 1.0;
          sprite.zIndex = 0;
        }
      }
    }
  }

  isAnimating(): boolean { return this.isRunning; }

  destroy(): void {
    this.stop();
    this.dustEffect?.destroy();
    this.dustEffect = null;
  }
}
