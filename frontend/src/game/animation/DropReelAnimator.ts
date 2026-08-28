import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';
import { LandingDustEffect, LandingDustOptions } from '../effects/LandingDustEffect';

export interface DropReelAnimatorCallbacks {
  onReelStop?: (reelIndex: number) => void;
  onAllReelsStopped?: () => void;
}

export interface DropReelAnimatorOptions {
  dustEffect?: boolean;              // Включить эффект пыли
  dustOptions?: LandingDustOptions;  // Настройки пыли
}

/**
 * Состояние колонки для drop анимации
 * Вся колонка падает как единое целое
 */
interface ColumnDropState {
  col: number;
  offset: number;        // Текущее смещение всех символов (отрицательное = выше экрана, положительное = ниже)
  velocity: number;      // Текущая скорость падения
  phase: 'waiting' | 'exiting' | 'preparing' | 'falling' | 'bouncing' | 'done';
  bounceStart: number;
  delay: number;         // Задержка перед началом анимации
}

/**
 * DropReelAnimator - анимация падения символов сверху вниз
 * При спине: 
 * 1. Текущие символы падают вниз (выходят за экран)
 * 2. Новые символы появляются сверху и падают на место
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
  private pendingMatrix: string[][] | null = null;
  private dustEffect: LandingDustEffect | null = null;
  private dustEnabled = false;
  private reelsContainer: PIXI.Container | null = null;
  
  // Параметры анимации
  private gravity = 1.8;
  private maxVelocity = 45;
  private bounceHeight = 12;
  private bounceTime = 150;
  private columnDelay = 60;
  private initialDelay = 50;
  private exitVelocity = 25;

  constructor(config: SlotConfig, reelManager: ReelManager, ticker: PIXI.Ticker, options?: DropReelAnimatorOptions) {
    this.config = config;
    this.reelManager = reelManager;
    this.ticker = ticker;
    
    const anim = config.animation;
    if (anim.bounceHeight) this.bounceHeight = anim.bounceHeight;
    if (anim.bounceTime) this.bounceTime = anim.bounceTime;
    if (anim.stopDelay) this.columnDelay = anim.stopDelay;
    
    // Применяем множитель скорости из spinSpeed (используется как множитель для drop анимации)
    // spinSpeed > 1 = быстрее, spinSpeed < 1 = медленнее
    if (anim.spinSpeed && anim.spinSpeed !== 45) { // 45 - дефолтное значение
      const speedMultiplier = anim.spinSpeed;
      this.gravity *= speedMultiplier;
      this.maxVelocity *= speedMultiplier;
      this.exitVelocity *= speedMultiplier;
      // Уменьшаем задержки пропорционально скорости
      this.columnDelay = Math.round(this.columnDelay / speedMultiplier);
      this.initialDelay = Math.round(this.initialDelay / speedMultiplier);
    }
    
    // Настройки пыли
    if (options?.dustEffect) {
      this.dustEnabled = true;
    }
  }

  /**
   * Инициализировать эффект пыли (вызывается после создания reelsContainer)
   */
  initDustEffect(reelsContainer: PIXI.Container, options?: LandingDustOptions): void {
    this.reelsContainer = reelsContainer;
    if (this.dustEnabled && reelsContainer) {
      this.dustEffect = new LandingDustEffect(reelsContainer, this.ticker, options);
    }
  }

  setCallbacks(callbacks: DropReelAnimatorCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Установить матрицу новых символов (вызывается перед start)
   */
  setPendingMatrix(matrix: string[][]): void {
    this.pendingMatrix = matrix;
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
    const { rows, cols, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    // В мобильном режиме визуальные колонки = логические ряды
    const visualCols = isMobileLayout ? rows : cols;
    const visualRows = isMobileLayout ? cols : rows;
    // Шаг между символами с учётом зазора
    const stepHeight = cellHeight + rowGap;
    this.columnStates = [];
    
    for (let vCol = 0; vCol < visualCols; vCol++) {
      this.columnStates[vCol] = {
        col: vCol,
        offset: 0, // Начинаем с текущей позиции (символы на месте)
        velocity: 0,
        // Всегда начинаем с фазы waiting → exiting (символы уходят вниз)
        phase: 'waiting',
        bounceStart: 0,
        delay: this.initialDelay + vCol * this.columnDelay,
      };
      
      // Символы должны быть на своих местах (offset = 0) перед началом выхода
      for (let vRow = 0; vRow < visualRows; vRow++) {
        const sprite = this.reelManager.getSymbolByIndex(vCol, vRow);
        if (sprite) {
          sprite.y = vRow * stepHeight + cellHeight / 2;
        }
      }
    }
  }

  private tick(): void {
    const elapsed = Date.now() - this.startTime;
    const { cols, rows, isMobileLayout } = this.config.dimensions;
    // В мобильном режиме визуальные колонки = логические ряды
    const visualCols = isMobileLayout ? rows : cols;
    let allDone = true;

    for (let vCol = 0; vCol < visualCols; vCol++) {
      const state = this.columnStates[vCol];
      if (state.phase === 'done') continue;
      
      allDone = false;
      this.animateColumn(state, elapsed);
    }

    if (allDone) this.finish();
  }

  private animateColumn(state: ColumnDropState, elapsed: number): void {
    const { rows, cols, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    // В мобильном режиме используем логические колонки как визуальные ряды
    const visualRows = isMobileLayout ? cols : rows;
    const stepHeight = cellHeight + rowGap;
    const exitThreshold = (visualRows + 1) * stepHeight; // Порог выхода за экран вниз
    
    // Ждём задержку перед началом анимации выхода
    if (state.phase === 'waiting') {
      if (elapsed >= state.delay) {
        state.phase = 'exiting';
        state.velocity = this.exitVelocity; // Начальная скорость выхода вниз
      }
      return;
    }
    
    // Фаза выхода символов вниз (за экран)
    if (state.phase === 'exiting') {
      // Ускорение под действием гравитации
      state.velocity = Math.min(state.velocity + this.gravity, this.maxVelocity);
      state.offset += state.velocity;
      
      // Обновляем позиции символов (смещение вниз)
      this.updateColumnPositions(state.col, state.offset);
      
      // Когда символы вышли за экран - переходим к подготовке новых
      if (state.offset >= exitThreshold) {
        state.phase = 'preparing';
        state.velocity = 0;
        // Обновляем текстуры на новые символы
        this.updateColumnTextures(state.col);
        // Позиционируем символы сверху (выше видимой области)
        const startOffset = -(visualRows + 1) * stepHeight;
        state.offset = startOffset;
        this.updateColumnPositions(state.col, state.offset);
      }
      return;
    }
    
    // Фаза подготовки - сразу переходим к падению
    if (state.phase === 'preparing') {
      state.phase = 'falling';
      state.velocity = 5; // Начальная скорость падения
      return;
    }
    
    // Фаза падения новых символов сверху
    if (state.phase === 'falling') {
      // Ускорение под действием гравитации
      state.velocity = Math.min(state.velocity + this.gravity, this.maxVelocity);
      state.offset += state.velocity;
      
      // Проверяем достижение цели (offset = 0 = нормальная позиция)
      if (state.offset >= 0) {
        state.offset = 0;
        state.phase = 'bouncing';
        state.bounceStart = Date.now();
        // Запускаем эффект пыли при приземлении
        this.triggerDustEffect(state.col);
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
  
  /**
   * Обновить текстуры символов в визуальной колонке на новые (из pendingMatrix)
   * @param visualCol - визуальная колонка (в мобильном режиме = логический row)
   */
  private updateColumnTextures(visualCol: number): void {
    if (!this.pendingMatrix) return;
    
    const { rows, cols, isMobileLayout } = this.config.dimensions;
    const visualRows = isMobileLayout ? cols : rows;
    
    for (let visualRow = 0; visualRow < visualRows; visualRow++) {
      // Получаем символ из матрицы по логическим координатам
      // В мобильном режиме: visualCol = logicalRow, visualRow = logicalCol
      const logicalCol = isMobileLayout ? visualRow : visualCol;
      const logicalRow = isMobileLayout ? visualCol : visualRow;
      const symbolId = this.pendingMatrix[logicalRow][logicalCol];
      // updateSymbolTexture работает с визуальными координатами
      this.reelManager.updateSymbolTexture(visualCol, visualRow, symbolId);
    }
  }

  private updateColumnPositions(visualCol: number, offset: number): void {
    const { rows, cols, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    const visualRows = isMobileLayout ? cols : rows;
    // Шаг между символами с учётом зазора
    const stepHeight = cellHeight + rowGap;
    
    for (let visualRow = 0; visualRow < visualRows; visualRow++) {
      const sprite = this.reelManager.getSymbolByIndex(visualCol, visualRow);
      if (sprite) {
        sprite.y = visualRow * stepHeight + cellHeight / 2 + offset;
      }
    }
  }

  /**
   * Запустить эффект пыли при приземлении колонки
   */
  private triggerDustEffect(visualCol: number): void {
    if (!this.dustEffect) return;
    
    const { rows, cols, cellHeight, rowGap, cellWidth, reelGap, isMobileLayout } = this.config.dimensions;
    const visualRows = isMobileLayout ? cols : rows;
    const stepHeight = cellHeight + rowGap;
    const colWidth = cellWidth + reelGap;
    
    // Позиция X - центр визуальной колонки
    const x = visualCol * colWidth + cellWidth / 2;
    // Позиция Y - нижний край последнего визуального символа
    const y = (visualRows - 1) * stepHeight + cellHeight;
    
    this.dustEffect.burst(x, y, cellWidth);
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
    const { rows, cols, cellHeight, rowGap, isMobileLayout } = this.config.dimensions;
    const visualCols = isMobileLayout ? rows : cols;
    const visualRows = isMobileLayout ? cols : rows;
    // Шаг между символами с учётом зазора
    const stepHeight = cellHeight + rowGap;
    for (let vCol = 0; vCol < visualCols; vCol++) {
      for (let vRow = 0; vRow < visualRows; vRow++) {
        const sprite = this.reelManager.getSymbolByIndex(vCol, vRow);
        if (sprite) {
          sprite.y = vRow * stepHeight + cellHeight / 2;
        }
      }
    }
  }

  isAnimating(): boolean {
    return this.isRunning;
  }

  /**
   * Уничтожить аниматор и все связанные эффекты
   */
  destroy(): void {
    this.stop();
    this.dustEffect?.destroy();
    this.dustEffect = null;
  }
}


