import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';

/**
 * AssetLoader - загрузка и управление игровыми ресурсами
 * Централизованная загрузка текстур с fallback-генерацией
 */
export class AssetLoader {
  private config: SlotConfig;
  private symbolTextures: Map<string, PIXI.Texture> = new Map();
  private borderTexture: PIXI.Texture | null = null;
  private barabanTexture: PIXI.Texture | null = null;
  private isLoaded: boolean = false;

  constructor(config: SlotConfig) {
    this.config = config;
  }

  /**
   * Загрузить все ресурсы
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;

    await Promise.all([
      this.loadBorderTexture(),
      this.loadBarabanTexture(),
      this.loadSymbolTextures(),
    ]);

    this.isLoaded = true;
  }

  /**
   * Загрузка текстуры рамки
   */
  private async loadBorderTexture(): Promise<void> {
    try {
      this.borderTexture = await PIXI.Texture.fromURL('./assets/symbols/border.png');
    } catch (e) {
      console.warn('AssetLoader: Failed to load border.png:', e);
    }
  }

  /**
   * Загрузка текстуры барабана
   */
  private async loadBarabanTexture(): Promise<void> {
    try {
      this.barabanTexture = await PIXI.Texture.fromURL('./assets/symbols/baraban.png');
    } catch (e) {
      console.warn('AssetLoader: Failed to load baraban.png:', e);
    }
  }

  /**
   * Загрузка текстур символов с fallback-генерацией
   */
  private async loadSymbolTextures(): Promise<void> {
    const { ids, fallbackColors } = this.config.symbols;

    for (const sym of ids) {
      try {
        const texture = await PIXI.Texture.fromURL(`./assets/symbols/${sym.toLowerCase()}.svg`);
        this.symbolTextures.set(sym, texture);
      } catch {
        // Генерируем fallback текстуру
        const texture = this.generateFallbackTexture(sym, fallbackColors[sym] || '#888');
        this.symbolTextures.set(sym, texture);
      }
    }
  }

  /**
   * Генерация fallback текстуры для символа
   */
  private generateFallbackTexture(symbol: string, color: string): PIXI.Texture {
    const size = this.config.cellHeight - 20;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 12);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, size / 2, size / 2);
    
    return PIXI.Texture.from(canvas);
  }

  // Геттеры для доступа к текстурам
  getSymbolTexture(symbolId: string): PIXI.Texture | undefined {
    return this.symbolTextures.get(symbolId);
  }

  getSymbolTextures(): Map<string, PIXI.Texture> {
    return this.symbolTextures;
  }

  getBorderTexture(): PIXI.Texture | null {
    return this.borderTexture;
  }

  getBarabanTexture(): PIXI.Texture | null {
    return this.barabanTexture;
  }

  /**
   * Получить случайный ID символа
   */
  getRandomSymbolId(): string {
    const ids = this.config.symbols.ids;
    return ids[Math.floor(Math.random() * ids.length)];
  }

  /**
   * Освобождение ресурсов
   */
  destroy(): void {
    this.symbolTextures.forEach(texture => texture.destroy(true));
    this.symbolTextures.clear();
    this.borderTexture?.destroy(true);
    this.barabanTexture?.destroy(true);
    this.borderTexture = null;
    this.barabanTexture = null;
    this.isLoaded = false;
  }
}
