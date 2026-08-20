import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { AssetLoader } from './AssetLoader';
import { SymbolFactory } from './SymbolFactory';

export interface ReelState {
  on: boolean; stop: boolean; pos: number; final: string[]; bouncing: boolean; bounceStart: number;
}

export class ReelManager {
  private config: SlotConfig;
  private assetLoader: AssetLoader;
  private symbolFactory: SymbolFactory;
  private reelsContainer: PIXI.Container | null = null;
  private reels: PIXI.Container[] = [];
  private symbols: PIXI.Sprite[][] = [];
  private barabanSprites: PIXI.TilingSprite[] = [];
  private blurFilters: PIXI.filters.BlurFilter[] = [];
  private masks: PIXI.Graphics[] = [];
  private state: ReelState[] = [];

  constructor(config: SlotConfig, assetLoader: AssetLoader) {
    this.config = config;
    this.assetLoader = assetLoader;
    this.symbolFactory = new SymbolFactory(config, assetLoader);
  }

  build(stage: PIXI.Container): PIXI.Container {
    const { dimensions } = this.config;
    this.reelsContainer = new PIXI.Container();
    this.reelsContainer.x = dimensions.reelsOffsetX;
    this.reelsContainer.y = dimensions.reelsOffsetY;
    stage.addChild(this.reelsContainer);
    const reelsHeight = dimensions.rows * dimensions.cellHeight;
    for (let col = 0; col < dimensions.cols; col++) this.buildReel(col, reelsHeight);
    this.buildSeparators();
    return this.reelsContainer;
  }

  private buildReel(col: number, reelsHeight: number): void {
    const { dimensions } = this.config;
    const { cellWidth, cellHeight, rows, buffer } = dimensions;
    const reel = new PIXI.Container();
    reel.x = col * cellWidth + cellWidth / 2;
    this.reelsContainer!.addChild(reel);
    this.reels.push(reel);

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRect(col * cellWidth, 0, cellWidth, rows * cellHeight).endFill();
    this.reelsContainer!.addChild(mask);
    reel.mask = mask as any;
    this.masks.push(mask);

    const barabanTex = this.assetLoader.getBarabanTexture();
    if (barabanTex) {
      const bs = new PIXI.TilingSprite(barabanTex, cellWidth, reelsHeight * 2);
      bs.anchor.set(0.5, 0); bs.x = 0; bs.y = -cellHeight;
      bs.tileScale.set(cellWidth / barabanTex.width, reelsHeight / barabanTex.height);
      reel.addChild(bs);
      this.barabanSprites.push(bs);
    }

    const blur = new PIXI.filters.BlurFilter(); blur.blurX = 0; blur.blurY = 0; blur.quality = 2;
    this.blurFilters.push(blur);

    this.symbols[col] = [];
    for (let i = 0; i < rows + buffer * 2; i++) {
      const sp = this.symbolFactory.createRandomSymbol();
      sp.y = (i - buffer) * cellHeight + cellHeight / 2;
      sp.filters = [blur];
      reel.addChild(sp);
      this.symbols[col].push(sp);
    }
    this.state[col] = { on: false, stop: false, pos: 0, final: [], bouncing: false, bounceStart: 0 };
  }

  private buildSeparators(): void {
    const { dimensions, visual } = this.config;
    const g = new PIXI.Graphics();
    g.lineStyle(visual.separatorWidth, visual.separatorColor, visual.separatorAlpha);
    for (let c = 1; c < dimensions.cols; c++) {
      g.moveTo(c * dimensions.cellWidth, 0).lineTo(c * dimensions.cellWidth, dimensions.rows * dimensions.cellHeight);
    }
    this.reelsContainer!.addChild(g);
  }

  getContainer() { return this.reelsContainer; }
  getReels() { return this.reels; }
  getSymbols() { return this.symbols; }
  getState() { return this.state; }
  getReelState(c: number) { return this.state[c]; }
  getBlurFilters() { return this.blurFilters; }
  getBarabanSprites() { return this.barabanSprites; }
  getSymbolFactory() { return this.symbolFactory; }
  getSymbol(col: number, row: number) { return this.symbols[col]?.[this.config.buffer + row] || null; }

  resetSymbolPositions(): void {
    const { cellHeight, buffer, cols } = this.config.dimensions;
    for (let c = 0; c < cols; c++) {
      this.symbols[c].forEach((sp, i) => { sp.y = (i - buffer) * cellHeight + cellHeight / 2; });
      this.blurFilters[c].blurY = 0;
    }
  }

  initSpinState(matrix: string[][]): void {
    for (let c = 0; c < this.config.cols; c++) {
      this.state[c] = { on: true, stop: false, pos: 0, final: matrix.map(r => r[c]), bouncing: false, bounceStart: 0 };
    }
  }

  finishReel(col: number): void {
    const { cellHeight, buffer, rows } = this.config.dimensions;
    const f = this.state[col].final;
    this.symbols[col].forEach((sp, i) => {
      sp.y = (i - buffer) * cellHeight + cellHeight / 2;
      if (i >= buffer && i < buffer + rows) this.symbolFactory.updateSymbolTexture(sp, f[i - buffer]);
    });
    if (this.barabanSprites[col]) this.barabanSprites[col].tilePosition.y = 0;
  }

  generateRandomMatrix(): string[][] {
    const { rows, cols } = this.config.dimensions;
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => this.symbolFactory.getRandomSymbolId()));
  }

  destroy(): void {
    this.reels.forEach(r => r.destroy({ children: true }));
    this.masks.forEach(m => m.destroy());
    this.reelsContainer?.destroy({ children: true });
    this.reels = []; this.symbols = []; this.barabanSprites = []; this.blurFilters = []; this.masks = []; this.state = [];
    this.reelsContainer = null;
  }
}
