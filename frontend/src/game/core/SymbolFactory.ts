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
   * Создать спрайт символа с эффектом свечения (glow) по редкости
   */
  createSymbol(symbolId: string): PIXI.Sprite {
    const texture = this.assetLoader.getSymbolTexture(symbolId);
    if (!texture) {
      throw new Error(`SymbolFactory: Texture not found for symbol "${symbolId}"`);
    }

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    
    const { cellWidth, cellHeight, dimensions } = this.config;
    
    if (dimensions.symbolFillCell) {
      const maxSize = Math.min(cellWidth, cellHeight);
      const symbolSize = maxSize * dimensions.symbolSizeRatio;
      sprite.width = sprite.height = symbolSize;
    } else {
      const symbolSize = Math.min(cellWidth, cellHeight) * dimensions.symbolSizeRatio;
      sprite.width = sprite.height = symbolSize;
    }
    sprite.name = symbolId;

    // Рамка не добавляется при создании — будет добавлена только на выигрышные символы
    return sprite;
  }

  /**
   * Добавить цветную рамку вокруг символа на основе его редкости
   */
  private addRarityGlow(sprite: PIXI.Sprite, symbolId: string): void {
    const { rarityGlowColors, rarityGlowIntensity } = this.config.symbols;
    if (!rarityGlowColors || !rarityGlowColors[symbolId]) return;

    const colorStr = rarityGlowColors[symbolId];
    const color = parseInt(colorStr.replace('#', ''), 16);
    const intensity = rarityGlowIntensity?.[symbolId] ?? 0.5;
    if (intensity <= 0) return;

    // Размер рамки относительно символа
    const spriteDisplaySize = sprite.width;
    const halfSize = (spriteDisplaySize / 2) / sprite.scale.x;
    const borderWidth = Math.max(2, Math.round(2 + intensity * 4));
    const cornerRadius = Math.max(2, halfSize * 0.15);
    const alpha = Math.min(1, 0.3 + intensity * 0.5);

    const border = new PIXI.Graphics();
    border.lineStyle(borderWidth, color, alpha);
    border.drawRoundedRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2, cornerRadius);
    border.endFill();

    sprite.addChildAt(border, 0);
  }

  /**
   * Построить массив точек на периметре скруглённого прямоугольника
   */
  private buildRoundedRectPerimeter(halfSize: number, r: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const w = halfSize * 2;
    const h = halfSize * 2;
    const x = -halfSize;
    const y = -halfSize;
    const stepsPerCorner = Math.max(6, Math.round(r * 0.6));

    // Верхняя грань (слева направо)
    pts.push({ x: x + r, y: y });
    pts.push({ x: x + w - r, y: y });

    // Верхний правый угол (90° → 0°)
    for (let i = 1; i <= stepsPerCorner; i++) {
      const angle = (Math.PI / 2) - (i / stepsPerCorner) * (Math.PI / 2);
      pts.push({ x: x + w - r + r * Math.cos(angle), y: y + r - r * Math.sin(angle) });
    }

    // Правая грань
    pts.push({ x: x + w, y: y + r });
    pts.push({ x: x + w, y: y + h - r });

    // Нижний правый угол (0° → -90°)
    for (let i = 1; i <= stepsPerCorner; i++) {
      const angle = -(i / stepsPerCorner) * (Math.PI / 2);
      pts.push({ x: x + w - r + r * Math.cos(angle), y: y + h - r - r * Math.sin(angle) });
    }

    // Нижняя грань (справа налево)
    pts.push({ x: x + w - r, y: y + h });
    pts.push({ x: x + r, y: y + h });

    // Нижний левый угол (-90° → -180°)
    for (let i = 1; i <= stepsPerCorner; i++) {
      const angle = -(Math.PI / 2) - (i / stepsPerCorner) * (Math.PI / 2);
      pts.push({ x: x + r + r * Math.cos(angle), y: y + h - r - r * Math.sin(angle) });
    }

    // Левая грань (снизу вверх)
    pts.push({ x: x, y: y + h - r });
    pts.push({ x: x, y: y + r });

    // Верхний левый угол (-180° → -270°)
    for (let i = 1; i <= stepsPerCorner; i++) {
      const angle = -(Math.PI) - (i / stepsPerCorner) * (Math.PI / 2);
      pts.push({ x: x + r + r * Math.cos(angle), y: y + r - r * Math.sin(angle) });
    }

    return pts;
  }

  /**
   * Обновить текстуру спрайта
   * Рамка не восстанавливается — будет добавлена отдельно при необходимости
   */
  updateSymbolTexture(sprite: PIXI.Sprite, symbolId: string): void {
    const texture = this.assetLoader.getSymbolTexture(symbolId);
    if (texture) {
      sprite.texture = texture;
      sprite.name = symbolId;
    }
  }

  /**
   * Добавить цветную рамку редкости на указанный спрайт (для выигрышных символов)
   */
  addSymbolBorder(sprite: PIXI.Sprite, symbolId: string): void {
    this.addRarityGlow(sprite, symbolId);
  }

  /**
   * Удалить рамку редкости со спрайта
   */
  removeSymbolBorder(sprite: PIXI.Sprite): void {
    const children = sprite.children;
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i] instanceof PIXI.Graphics) {
        sprite.removeChildAt(i);
      }
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
