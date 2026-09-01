import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';
import { SymbolAnimator } from '../animation/SymbolAnimator';
import { WinLineManager } from '../WinLine';
import { ShineEffectManager } from '../ShineEffect';
import { LightningManager } from './LightningEffect';
import { Win } from '../../types';

const LINE_THEMES: ('gold' | 'red' | 'green' | 'blue' | 'purple')[] = ['gold', 'red', 'green', 'blue', 'purple'];

/** Символы-камни, для которых показывается электрический разряд вместо обычной линии */
const STONE_SYMBOLS = new Set(['A', 'B', 'C', 'F']);

export interface WinDisplayOptions {
  disableWinLines?: boolean;  // Отключить анимацию линий
  disableShine?: boolean;     // Отключить эффект блика
  cascadeWinHighlight?: boolean;  // Каскадная подсветка символов (поочередно)
}

/**
 * WinDisplayManager - управление отображением выигрышей
 */
export class WinDisplayManager {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private symbolAnimator: SymbolAnimator;
  private winLineManager: WinLineManager | null = null;
  private shineManager: ShineEffectManager | null = null;
  private lightningManager: LightningManager | null = null;
  private options: WinDisplayOptions = {};

  constructor(config: SlotConfig, reelManager: ReelManager, symbolAnimator: SymbolAnimator, options?: WinDisplayOptions) {
    this.config = config;
    this.reelManager = reelManager;
    this.symbolAnimator = symbolAnimator;
    if (options) this.options = options;
  }

  init(stage: PIXI.Container, ticker: PIXI.Ticker): void {
    // Создаём менеджеры только если эффекты не отключены
    if (!this.options.disableWinLines) {
      this.winLineManager = new WinLineManager(stage, ticker, 5);
    }
    // ShineManager не нужен при каскадной подсветке
    if (!this.options.disableShine && !this.options.cascadeWinHighlight) {
      this.shineManager = new ShineEffectManager(ticker, 15);
    }
    // LightningManager для эффекта молнии на символах-камнях
    this.lightningManager = new LightningManager(stage, ticker, 5);
  }

  showWins(wins: Win[]): void {
    if (!wins || wins.length === 0) return;

    // Собираем все выигрышные позиции
    const allWinPositions = new Set<string>();
    wins.forEach(w => {
      const positions = this.config.getPaylinePositions(w.line);
      for (let i = 0; i < w.count && i < positions.length; i++) {
        allWinPositions.add(`${positions[i].col}_${positions[i].row}`);
      }
    });

    // Затемняем невыигрышные символы и добавляем рамки редкости
    // Каскадный режим: подсветка символов поочередно
    if (this.options.cascadeWinHighlight) {
      this.playCascadeHighlight(allWinPositions);
    } else {
      this.symbolAnimator.dimNonWinSymbols(allWinPositions);
    }

    // Рамки редкости на выигрышные символы (всегда, включая каскад)
    this.symbolAnimator.applyWinnerBorders(allWinPositions);

    // Показываем линии выигрыша
    wins.forEach((w, index) => this.showWinLine(w, index));
  }

  /**
   * Каскадная подсветка выигрышных символов (для мобильной версии)
   * Сначала все символы затемняются, затем выигрышные поочередно становятся яркими
   */
  private playCascadeHighlight(winPositions: Set<string>): void {
    this.symbolAnimator.cascadeHighlight(winPositions);
  }

  private showWinLine(w: Win, index: number): void {
    const positions = this.config.getPaylinePositions(w.line);
    const { cellWidth, cellHeight, reelGap, rowGap, 
            reelsAreaWidth, reelsAreaHeight, borderWidth, borderHeight, reelsAutoCenter,
            reelsCenterYOffset, reelsOffsetX, reelsOffsetY, isMobileLayout } = this.config.dimensions;

    // Позиции выигрышных символов (логические координаты)
    const winSymbolPositions: { col: number; row: number }[] = [];
    for (let i = 0; i < w.count && i < positions.length; i++) {
      winSymbolPositions.push(positions[i]);
    }

    // Вычисляем реальное смещение барабанов (учитывая autoCenter)
    let actualOffsetX = reelsOffsetX;
    let actualOffsetY = reelsOffsetY;
    if (reelsAutoCenter) {
      // reelsAreaWidth/Height УЖЕ включают зазоры (это полный размер области барабанов)
      const totalWidth = reelsAreaWidth;
      const totalHeight = reelsAreaHeight;
      actualOffsetX = (borderWidth - totalWidth) / 2;
      actualOffsetY = (borderHeight - totalHeight) / 2 + reelsCenterYOffset;
    }

    // Координаты для линии с учётом зазоров между барабанами
    // В мобильном режиме транспонируем: логический col -> визуальный row, логический row -> визуальный col
    const points = positions.map(p => {
      if (isMobileLayout) {
        // Транспонированные координаты: визуальная позиция (row, col) вместо (col, row)
        return {
          x: p.row * (cellWidth + reelGap) + cellWidth / 2 + actualOffsetX,
          y: p.col * (cellHeight + rowGap) + cellHeight / 2 + actualOffsetY,
        };
      }
      return {
        x: p.col * (cellWidth + reelGap) + cellWidth / 2 + actualOffsetX,
        y: p.row * (cellHeight + rowGap) + cellHeight / 2 + actualOffsetY,
      };
    });

    const theme = LINE_THEMES[w.line % LINE_THEMES.length];
    const animatedSymbols = new Set<number>();

    // Проверяем, является ли символ камнем (A, B, C, F) — для них показываем молнию
    const isStone = STONE_SYMBOLS.has(w.symbol);

    setTimeout(() => {
      if (isStone && this.lightningManager) {
        // Показываем электрический разряд вместо обычной линии
        // Берём только точки выигрышных символов (первые w.count)
        const lightningPoints = points.slice(0, w.count);
        this.lightningManager.showLightning(w.line, lightningPoints, true);
      } else {
        // Обычная золотая линия выигрыша
        this.winLineManager?.showLine(
          w.line, points, theme, true,
          () => { animatedSymbols.clear(); },
          (progress: number, pointIndex: number) => {
            if (pointIndex < winSymbolPositions.length && !animatedSymbols.has(pointIndex)) {
              animatedSymbols.add(pointIndex);
              const pos = winSymbolPositions[pointIndex];
              this.symbolAnimator.animateWinSymbol(pos.col, pos.row);
            }
          }
        );
      }
    }, index * 200);
  }

  hide(): void {
    this.winLineManager?.hideAll();
    this.shineManager?.stopAll();
    this.lightningManager?.hideAll();
    this.symbolAnimator.reset();
  }

  destroy(): void {
    this.winLineManager?.destroy();
    this.shineManager?.destroy();
    this.lightningManager?.destroy();
    this.winLineManager = null;
    this.shineManager = null;
    this.lightningManager = null;
  }
}
