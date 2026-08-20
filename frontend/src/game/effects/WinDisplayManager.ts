import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { ReelManager } from '../core/ReelManager';
import { SymbolAnimator } from '../animation/SymbolAnimator';
import { WinLineManager } from '../WinLine';
import { ShineEffectManager } from '../ShineEffect';
import { Win } from '../../types';

const LINE_THEMES: ('gold' | 'red' | 'green' | 'blue' | 'purple')[] = ['gold', 'red', 'green', 'blue', 'purple'];

/**
 * WinDisplayManager - управление отображением выигрышей
 */
export class WinDisplayManager {
  private config: SlotConfig;
  private reelManager: ReelManager;
  private symbolAnimator: SymbolAnimator;
  private winLineManager: WinLineManager | null = null;
  private shineManager: ShineEffectManager | null = null;

  constructor(config: SlotConfig, reelManager: ReelManager, symbolAnimator: SymbolAnimator) {
    this.config = config;
    this.reelManager = reelManager;
    this.symbolAnimator = symbolAnimator;
  }

  init(stage: PIXI.Container, ticker: PIXI.Ticker): void {
    this.winLineManager = new WinLineManager(stage, ticker, 5);
    this.shineManager = new ShineEffectManager(ticker, 15);
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

    // Затемняем невыигрышные символы
    this.symbolAnimator.dimNonWinSymbols(allWinPositions);

    // Запускаем блики на выигрышных символах
    this.playShineEffects(allWinPositions);

    // Показываем линии выигрыша
    wins.forEach((w, index) => this.showWinLine(w, index));
  }

  private playShineEffects(winPositions: Set<string>): void {
    let delay = 0;
    winPositions.forEach(key => {
      const [col, row] = key.split('_').map(Number);
      const sprite = this.reelManager.getSymbol(col, row);
      if (sprite && this.shineManager) {
        this.shineManager.playOnSprite(sprite, { delay });
        delay += 100;
      }
    });
  }

  private showWinLine(w: Win, index: number): void {
    const positions = this.config.getPaylinePositions(w.line);
    const { reelsOffsetX, reelsOffsetY, cellWidth, cellHeight } = this.config.dimensions;

    // Позиции выигрышных символов
    const winSymbolPositions: { col: number; row: number }[] = [];
    for (let i = 0; i < w.count && i < positions.length; i++) {
      winSymbolPositions.push(positions[i]);
    }

    // Координаты для линии
    const points = positions.map(p => ({
      x: p.col * cellWidth + cellWidth / 2 + reelsOffsetX,
      y: p.row * cellHeight + cellHeight / 2 + reelsOffsetY,
    }));

    const theme = LINE_THEMES[w.line % LINE_THEMES.length];
    const animatedSymbols = new Set<number>();

    setTimeout(() => {
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
    }, index * 200);
  }

  hide(): void {
    this.winLineManager?.hideAll();
    this.shineManager?.stopAll();
    this.symbolAnimator.reset();
  }

  destroy(): void {
    this.winLineManager?.destroy();
    this.shineManager?.destroy();
    this.winLineManager = null;
    this.shineManager = null;
  }
}
