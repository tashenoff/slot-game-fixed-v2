import * as PIXI from 'pixi.js';
import { SpinResult, PaylinePosition } from '../types';

export class SlotMachine {
  private app: PIXI.Application;
  private container: HTMLElement | null = null;
  private reels: PIXI.Container[] = [];
  private symbols: PIXI.Sprite[][] = [];
  private symbolTextures: Record<string, PIXI.Texture> = {};
  private reelMasks: PIXI.Graphics[] = [];
  private paylineGraphics: PIXI.Graphics[] = [];
  private isSpinning: boolean = false;
  private spinCompleteCallback: ((result: SpinResult) => void) | null = null;
  private currentResult: SpinResult | null = null;
  private activeTickerCallbacks: ((deltaTime: number) => void)[] = [];
  private winAnimationTimeouts: number[] = [];
  
  // Константы для настройки слота
  private readonly REEL_WIDTH = 160;
  private readonly SYMBOL_SIZE = 150;
  private readonly SYMBOL_PADDING = 10;
  private readonly ROWS = 3;
  private readonly COLS = 5;
  private readonly SPIN_DURATION = 2000; // ms
  private readonly EXTRA_SYMBOLS = 3; // Дополнительные символы для плавного вращения
  
  constructor() {
    this.app = new PIXI.Application({
      width: this.COLS * this.REEL_WIDTH,
      height: this.ROWS * this.SYMBOL_SIZE,
      backgroundColor: 0x1099bb,
      resolution: window.devicePixelRatio || 1,
    });
  }
  
  public async init(container: HTMLElement): Promise<void> {
    this.container = container;
    container.appendChild(this.app.view as HTMLCanvasElement);
    await this.createSymbolTextures();
    this.createReels();
    this.createPaylineGraphics();
    window.addEventListener('resize', this.onResize.bind(this));
    this.onResize();
  }
  
  private onResize(): void {
    if (!this.container) return;
    
    const parent = this.container;
    const scale = Math.min(
      parent.clientWidth / (this.COLS * this.REEL_WIDTH),
      parent.clientHeight / (this.ROWS * this.SYMBOL_SIZE)
    );
    
    this.app.renderer.resize(
      this.COLS * this.REEL_WIDTH * scale,
      this.ROWS * this.SYMBOL_SIZE * scale
    );
    
    this.app.stage.scale.set(scale);
  }
  
  private async createSymbolTextures(): Promise<void> {
    const symbols = ['A', 'B', 'C', 'D', 'E'];
    
    for (const symbol of symbols) {
      try {
        const texture = await PIXI.Texture.fromURL(`/assets/symbols/${symbol.toLowerCase()}.png`);
        this.symbolTextures[symbol] = texture;
      } catch (error) {
        console.error(`Failed to load texture for symbol ${symbol}:`, error);
        
        const canvas = document.createElement('canvas');
        canvas.width = this.SYMBOL_SIZE - this.SYMBOL_PADDING * 2;
        canvas.height = this.SYMBOL_SIZE - this.SYMBOL_PADDING * 2;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          const color = {
            'A': '#ff0000',
            'B': '#00ff00',
            'C': '#0000ff',
            'D': '#ffff00',
            'E': '#ff00ff'
          }[symbol] || '#cccccc';
          
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(0, 0, canvas.width, canvas.height, 15);
          ctx.fill();
          
          ctx.fillStyle = 'white';
          ctx.font = '60px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(symbol, canvas.width / 2, canvas.height / 2);
          
          this.symbolTextures[symbol] = PIXI.Texture.from(canvas);
        }
      }
    }
  }
  
  private createReels(): void {
    const reelsContainer = new PIXI.Container();
    reelsContainer.position.set(0, 0);
    this.app.stage.addChild(reelsContainer);
    
    for (let i = 0; i < this.COLS; i++) {
      const reel = new PIXI.Container();
      reel.position.set(i * this.REEL_WIDTH + this.REEL_WIDTH / 2, 0);
      reelsContainer.addChild(reel);
      this.reels.push(reel);
      
      const maskGraphics = new PIXI.Graphics();
      maskGraphics.beginFill(0xffffff);
      maskGraphics.drawRect(i * this.REEL_WIDTH, 0, this.REEL_WIDTH, this.ROWS * this.SYMBOL_SIZE);
      maskGraphics.endFill();
      reelsContainer.addChild(maskGraphics);
      this.reelMasks.push(maskGraphics);
      
      reel.mask = maskGraphics as any;
      this.symbols[i] = [];
      
      for (let j = 0; j < this.ROWS + this.EXTRA_SYMBOLS; j++) {
        const randomSymbol = ['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)];
        const symbol = this.createSymbol(randomSymbol);
        symbol.position.set(0, (j - this.EXTRA_SYMBOLS) * this.SYMBOL_SIZE + this.SYMBOL_SIZE / 2);
        reel.addChild(symbol);
        this.symbols[i][j] = symbol;
      }
    }
  }
  
  private createPaylineGraphics(): void {
    const paylineContainer = new PIXI.Container();
    this.app.stage.addChild(paylineContainer);
    
    for (let i = 0; i < 5; i++) {
      const payline = new PIXI.Graphics();
      payline.visible = false;
      paylineContainer.addChild(payline);
      this.paylineGraphics.push(payline);
    }
  }
  
  private createSymbol(type: string): PIXI.Sprite {
    const texture = this.symbolTextures[type] || this.symbolTextures['A'];
    const symbol = new PIXI.Sprite(texture);
    symbol.anchor.set(0.5);
    
    const targetSize = this.SYMBOL_SIZE - this.SYMBOL_PADDING * 2;
    const scale = Math.min(
      targetSize / texture.width,
      targetSize / texture.height
    );
    
    symbol.scale.set(scale);
    (symbol as any).baseScale = scale;
    symbol.name = type;
    
    return symbol;
  }
  
  public spin(callback: (result: SpinResult) => void): void {
    if (this.isSpinning) return;
    
    this.clearAllAnimations();
    this.isSpinning = true;
    this.spinCompleteCallback = callback;
    this.hidePaylines();
    
    for (let i = 0; i < this.COLS; i++) {
      setTimeout(() => this.spinReel(i), i * 200);
    }
  }
  
  private clearAllAnimations(): void {
    this.activeTickerCallbacks.forEach(cb => this.app.ticker.remove(cb));
    this.activeTickerCallbacks = [];
    
    this.winAnimationTimeouts.forEach(clearTimeout);
    this.winAnimationTimeouts = [];
    
    this.paylineGraphics.forEach(p => {
      p.visible = false;
      p.alpha = 1;
    });
    
    this.symbols.forEach(reel => {
      reel.forEach(symbol => {
        symbol.scale.set((symbol as any).baseScale || 1);
      });
    });
  }
  
  private spinReel(reelIndex: number): void {
    for (let i = 0; i < this.symbols[reelIndex].length; i++) {
      const symbol = this.symbols[reelIndex][i];
      
      if (this.currentResult?.matrix) {
        let targetSymbolName: string;
        
        if (i >= this.EXTRA_SYMBOLS && i < this.EXTRA_SYMBOLS + this.ROWS) {
          targetSymbolName = this.currentResult.matrix[i - this.EXTRA_SYMBOLS][reelIndex];
        } else {
          const symbolKeys = Object.keys(this.symbolTextures);
          targetSymbolName = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        }
        
        symbol.name = targetSymbolName;
        const newTexture = this.symbolTextures[targetSymbolName];
        symbol.texture = newTexture;
        
        const targetSize = this.SYMBOL_SIZE - this.SYMBOL_PADDING * 2;
        const scale = Math.min(
          targetSize / newTexture.width,
          targetSize / newTexture.height
        );
        symbol.scale.set(scale);
        (symbol as any).baseScale = scale;
      }
    }
    
    const totalSpinSteps = 20 + reelIndex * 5;
    const startPosition = 0;
    const endPosition = -totalSpinSteps * this.SYMBOL_SIZE;
    let elapsed = 0;
    const duration = this.SPIN_DURATION - reelIndex * 200;
    
    const tickerCallback = (deltaTime: number) => {
      elapsed += this.app.ticker.deltaMS;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeOutBack(progress);
      const currentPosition = startPosition + (endPosition - startPosition) * easedProgress;
      
      for (let i = 0; i < this.symbols[reelIndex].length; i++) {
        const symbol = this.symbols[reelIndex][i];
        let y = (i - this.EXTRA_SYMBOLS) * this.SYMBOL_SIZE + this.SYMBOL_SIZE / 2 + currentPosition;
        
        const symbolHeight = this.SYMBOL_SIZE;
        const totalHeight = this.ROWS * symbolHeight;
        
        while (y > totalHeight) y -= totalHeight + this.EXTRA_SYMBOLS * symbolHeight;
        while (y < -symbolHeight * this.EXTRA_SYMBOLS) y += totalHeight + this.EXTRA_SYMBOLS * symbolHeight;
        
        symbol.position.y = y;
      }
      
      if (progress >= 1) {
        for (let i = 0; i < this.symbols[reelIndex].length; i++) {
          const symbol = this.symbols[reelIndex][i];
          symbol.position.y = (i - this.EXTRA_SYMBOLS) * this.SYMBOL_SIZE + this.SYMBOL_SIZE / 2;
        }
        
        const index = this.activeTickerCallbacks.indexOf(tickerCallback);
        if (index > -1) this.activeTickerCallbacks.splice(index, 1);
        this.app.ticker.remove(tickerCallback);
        
        if (reelIndex === this.COLS - 1) {
          this.completeSpinAnimation();
        }
      }
    };
    
    this.activeTickerCallbacks.push(tickerCallback);
    this.app.ticker.add(tickerCallback);
  }
  
  private easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  
  private completeSpinAnimation(): void {
    const visibleMatrix: string[][] = [];
    for (let row = 0; row < this.ROWS; row++) {
      const rowSymbols: string[] = [];
      for (let col = 0; col < this.COLS; col++) {
        rowSymbols.push(this.symbols[col][row + this.EXTRA_SYMBOLS].name);
      }
      visibleMatrix.push(rowSymbols);
    }
    
    this.isSpinning = false;
    
    if (this.currentResult && this.spinCompleteCallback) {
      this.showWinningLines(this.currentResult);
      this.spinCompleteCallback(this.currentResult);
    }
  }
  
  public setSpinResult(result: SpinResult): void {
    this.currentResult = result;
  }
  
  private showWinningLines(result: SpinResult): void {
    if (!result.wins?.length) return;
    
    result.wins.forEach((win, index) => {
      const lineIndex = win.line;
      if (lineIndex >= this.paylineGraphics.length) return;
      
      const payline = this.paylineGraphics[lineIndex];
      payline.clear();
      
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
      payline.lineStyle(5, colors[lineIndex % colors.length], 1);
      
      const positions = this.getPaylinePositions(lineIndex);
      payline.moveTo(
        positions[0].col * this.REEL_WIDTH + this.REEL_WIDTH / 2,
        positions[0].row * this.SYMBOL_SIZE + this.SYMBOL_SIZE / 2
      );
      
      for (let i = 1; i < positions.length; i++) {
        payline.lineTo(
          positions[i].col * this.REEL_WIDTH + this.REEL_WIDTH / 2,
          positions[i].row * this.SYMBOL_SIZE + this.SYMBOL_SIZE / 2
        );
      }
      
      this.highlightSymbols(positions, win.count);
      payline.visible = true;
      
      const blinkCallback = (deltaTime: number) => {
        payline.alpha = 0.5 + Math.sin(this.app.ticker.lastTime / 200) * 0.5;
      };
      
      this.activeTickerCallbacks.push(blinkCallback);
      this.app.ticker.add(blinkCallback);
      
      const timeout = setTimeout(() => {
        const index = this.activeTickerCallbacks.indexOf(blinkCallback);
        if (index > -1) this.activeTickerCallbacks.splice(index, 1);
        this.app.ticker.remove(blinkCallback);
        payline.alpha = 1;
      }, 3000);

      this.winAnimationTimeouts.push(timeout);
    });
  }
  
  private getPaylinePositions(lineIndex: number): PaylinePosition[] {
    switch(lineIndex) {
      case 0: return Array(this.COLS).fill(0).map((_, col) => ({ row: 1, col }));
      case 1: return Array(this.COLS).fill(0).map((_, col) => ({ row: 0, col }));
      case 2: return Array(this.COLS).fill(0).map((_, col) => ({ row: 2, col }));
      case 3: return [
        { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 1, col: 3 }, { row: 0, col: 4 }
      ];
      case 4: return [
        { row: 2, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 3 }, { row: 2, col: 4 }
      ];
      default: return [];
    }
  }
  
  private highlightSymbols(positions: PaylinePosition[], count: number): void {
    for (let i = 0; i < count; i++) {
      const { row, col } = positions[i];
      const symbol = this.symbols[col][row + this.EXTRA_SYMBOLS];
      const baseScale = (symbol as any).baseScale || 1;

      const scaleCallback = (deltaTime: number) => {
        if (symbol.parent) {
          const pulse = Math.sin(this.app.ticker.lastTime / 150) * 0.1;
          symbol.scale.set(baseScale * (1 + pulse));
        }
      };
      
      this.activeTickerCallbacks.push(scaleCallback);
      this.app.ticker.add(scaleCallback);
      
      const timeout = setTimeout(() => {
        const index = this.activeTickerCallbacks.indexOf(scaleCallback);
        if (index > -1) this.activeTickerCallbacks.splice(index, 1);
        this.app.ticker.remove(scaleCallback);
        if (symbol.parent) symbol.scale.set(baseScale);
      }, 3000);

      this.winAnimationTimeouts.push(timeout);
    }
  }
  
  private hidePaylines(): void {
    this.paylineGraphics.forEach(p => p.visible = false);
  }
  
  public destroy(): void {
    this.clearAllAnimations();
    window.removeEventListener('resize', this.onResize.bind(this));
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
    }
  }
}