import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { AssetLoader } from './AssetLoader';

/**
 * SymbolFactory - создание и переиспользование спрайтов символов
 */
export class SymbolFactory {
  private config: SlotConfig;
  private assetLoader: AssetLoader;

  constructor(config: SlotConfig, assetLoader: AssetLoader) {
    this.config = config;
    this.assetLoader = assetLoader;
  }

  /**
   * Создать спрайт символа
   */
  createSymbol(symbolId: string): PIXI.Sprite {
    const texture = this.assetLoader.getSymbolTexture(symbolId);
    if (!texture) {
      throw new Error(`SymbolFactory: Texture not found for symbol "${symbolId}"`);
    }

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    
    // Размер символа - процент от минимального размера ячейки
    const { cellWidth, cellHeight, dimensions } = this.config;
    const symbolSize = Math.min(cellWidth, cellHeight) * dimensions.symbolSizeRatio;
    sprite.width = sprite.height = symbolSize;
    sprite.name = symbolId;

    return sprite;
  }

  /**
   * Обновить текстуру спрайта
   */
  updateSymbolTexture(sprite: PIXI.Sprite, symbolId: string): void {
    const texture = this.assetLoader.getSymbolTexture(symbolId);
    if (texture) {
      sprite.texture = texture;
      sprite.name = symbolId;
    }
  }

  /**
   * Создать случайный символ
   */
  createRandomSymbol(): PIXI.Sprite {
    const symbolId = this.assetLoader.getRandomSymbolId();
    return this.createSymbol(symbolId);
  }

  /**
   * Получить случайный ID символа
   */
  getRandomSymbolId(): string {
    return this.assetLoader.getRandomSymbolId();
  }

  /**
   * Получить текстуру символа
   */
  getTexture(symbolId: string): PIXI.Texture | undefined {
    return this.assetLoader.getSymbolTexture(symbolId);
  }
}
