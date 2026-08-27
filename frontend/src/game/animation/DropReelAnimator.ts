import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';

export interface DropReelAnimatorCallbacks {
  onReelStop?: (reelIndex: number) => void;
  onAllReelsStopped?: () => void;
}

/**
 * Состояние колонки для drop анимации
 * Вся колонка падает как единое целое
 */
interface ColumnDropState {
  col: number;
  offset: number;        // Текущее смещение всех символов (отрицательное = выше экрана)
  velocity: number;      // Текущая скорость падения
  phase: 'waiting' | 'falling' | 'bouncing' | 'done';
  bounceStart: number;
  delay: number;         // Задержка перед началом падения
}

/**
 * DropReelAnimator - анимация падения символов сверху вниз
 * Все символы колонки падают вместе как единая группа
 */
export class DropReelAnimator {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private ticker: PIXI.Ticker;
  private callbacks: DropReelAnimatorCallbacks = {};
  private tickFn: ((delta: number) => void) | null = null;
  private isRunning = false;
  private startTime = 0;
  private columnStates: ColumnDropState[] = [];
  
  // Параметры анимации
  private gravity = 1.8;           // Ускорение падения
  private maxVelocity = 45;        // Максимальная скорость
  private bounceHeight = 12;       // Высота отскока
  private bounceTime = 150;        // Время отскока (мс)
  private columnDelay = 60;        // Задержка между колонками (мс)
  private initialDelay = 50;       // Начальная задержка

  constructor(config: SlotConfig, reelManager: ReelManager, ticker: PIXI.Ticker) {
    this.config = config;
    this.reelManager = reelManager;
    this.ticker = ticker;
    
    const anim = config.animation;
    if (anim.bounceHeight) this.bounceHeight = anim.bounceHeight;
    if (anim.bounceTime) this.bounceTime = anim.bounceTime;
    if (anim.stopDelay) this.columnDelay = anim.stopDelay;
  }

  setCallbacks(callbacks: DropReelAnimatorCallbacks): void {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now();
    this.initColumnStates();
    this.tickFn = () => this.tick();
    this.ticker.add(this.tickFn);
  }

  private initColumnStates(): void {
    const { rows, cols, cellHeight } = this.config.dimensions;
    this.columnStates = [];
    
    // Начальное смещение - все символы выше видимой области
    const startOffset = -(rows + 1) * cellHeight;
    
    for (let col = 0; col < cols; col++) {
      this.columnStates[col] = {
        col,
        offset: startOffset,
        velocity: 0,
        phase: 'waiting',
        bounceStart: 0,
        delay: this.initialDelay + col * this.columnDelay,
      };
      
      // Устанавливаем начальные позиции символов (выше экрана)
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbolByIndex(col, row);
        if (sprite) {
          sprite.y = row * cellHeight + cellHeight / 2 + startOffset;
        }
      }
    }
  }

  private tick(): void {
    const elapsed = Date.now() - this.startTime;
    const { cols } = this.config.dimensions;
    let allDone = true;

    for (let col = 0; col < cols; col++) {
      const state = this.columnStates[col];
      if (state.phase === 'done') continue;
      
      allDone = false;
      this.animateColumn(state, elapsed);
    }

    if (allDone) this.finish();
  }

  private animateColumn(state: ColumnDropState, elapsed: number): void {
    const { rows, cellHeight } = this.config.dimensions;
    
    // Ждём задержку перед началом падения
    if (state.phase === 'waiting') {
      if (elapsed >= state.delay) {
        state.phase = 'falling';
        state.velocity = 5; // Начальная скорость
      }
      return;
    }
    
    // Фаза падения
    if (state.phase === 'falling') {
      // Ускорение под действием гравитации
      state.velocity = Math.min(state.velocity + this.gravity, this.maxVelocity);
      state.offset += state.velocity;
      
      // Проверяем достижение цели (offset = 0 = нормальная позиция)
      if (state.offset >= 0) {
        state.offset = 0;
        state.phase = 'bouncing';
        state.bounceStart = Date.now();
        this.callbacks.onReelStop?.(state.col);
      }
      
      // Обновляем позиции всех символов колонки
      this.updateColumnPositions(state.col, state.offset);
    }
    
    // Фаза отскока
    if (state.phase === 'bouncing') {
      const progress = Math.min((Date.now() - state.bounceStart) / this.bounceTime, 1);
      // Затухающий синусоидальный отскок
      const bounce = Math.sin(progress * Math.PI) * this.bounceHeight * (1 - progress * 0.5);
      
      this.updateColumnPositions(state.col, bounce);
      
      if (progress >= 1) {
        this.updateColumnPositions(state.col, 0);
        state.phase = 'done';
      }
    }
  }

  private updateColumnPositions(col: number, offset: number): void {
    const { rows, cellHeight } = this.config.dimensions;
    
    for (let row = 0; row < rows; row++) {
      const sprite = this.reelManager.getSymbolByIndex(col, row);
      if (sprite) {
        sprite.y = row * cellHeight + cellHeight / 2 + offset;
      }
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
    this.isRunning = false;
    
    // Установить все символы в финальные позиции
    const { rows, cols, cellHeight } = this.config.dimensions;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sprite = this.reelManager.getSymbolByIndex(col, row);
        if (sprite) {
          sprite.y = row * cellHeight + cellHeight / 2;
        }
      }
    }
  }

  isAnimating(): boolean {
    return this.isRunning;
  }
}

