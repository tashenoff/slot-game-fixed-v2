import * as PIXI from 'pixi.js';
import { SlotConfig } from '../config/SlotConfig';
import { SlotTheme, getBorderAssetPath, isMobileDevice } from '../../config/themes';

/**
 * AssetLoader - загрузка и управление игровыми ресурсами
 * Централизованная загрузка текстур с fallback-генерацией
 */
export class AssetLoader {
  private config: SlotConfig;
  private assetsPath: string;
  private theme: SlotTheme | null = null;
  private symbolTextures: Map<string, PIXI.Texture> = new Map();
  private borderTexture: PIXI.Texture | null = null;
  private barabanTexture: PIXI.Texture | null = null;
  private isLoaded: boolean = false;
  private resolution: number;

  constructor(config: SlotConfig, assetsPath: string = './assets/symbols', theme?: SlotTheme) {
    this.config = config;
    this.assetsPath = assetsPath;
    this.theme = theme || null;
    // Используем devicePixelRatio для загрузки текстур в правильном разрешении
    this.resolution = Math.min(window.devicePixelRatio || 1, 2);
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
   * Загрузка текстуры рамки (с поддержкой мобильной версии)
   * На мобильных используется bg_mini.png если тема имеет mobile конфиг
   */
  private async loadBorderTexture(): Promise<void> {
    // Используем getBorderAssetPath если есть тема, иначе fallback на обычный путь
    const url = this.theme 
      ? getBorderAssetPath(this.theme)
      : `${this.assetsPath}/border.png`;
    
    console.log(`AssetLoader: Loading border from ${url} (mobile: ${isMobileDevice()}, resolution: ${this.resolution})`);
    try {
      this.borderTexture = await PIXI.Texture.fromURL(url);
      // Устанавливаем resolution для чёткого отображения на Retina
      this.borderTexture.baseTexture.resolution = this.resolution;
      this.borderTexture.baseTexture.update();
      console.log('AssetLoader: Border loaded successfully');
    } catch (e) {
      console.warn('AssetLoader: Failed to load border:', e);
      // Fallback на обычный border.png
      if (url !== `${this.assetsPath}/border.png`) {
        try {
          this.borderTexture = await PIXI.Texture.fromURL(`${this.assetsPath}/border.png`);
          this.borderTexture.baseTexture.resolution = this.resolution;
          this.borderTexture.baseTexture.update();
          console.log('AssetLoader: Border loaded from fallback');
        } catch (e2) {
          console.warn('AssetLoader: Failed to load fallback border.png:', e2);
        }
      }
    }
  }

  /**
   * Загрузка текстуры барабана
   */
  private async loadBarabanTexture(): Promise<void> {
    const url = `${this.assetsPath}/baraban.png`;
    console.log(`AssetLoader: Loading baraban from ${url}`);
    try {
      this.barabanTexture = await PIXI.Texture.fromURL(url);
      this.barabanTexture.baseTexture.resolution = this.resolution;
      this.barabanTexture.baseTexture.update();
      console.log('AssetLoader: Baraban loaded successfully');
    } catch (e) {
      console.warn('AssetLoader: Failed to load baraban.png:', e);
    }
  }

  /**
   * Загрузка текстур символов с fallback-генерацией
   */
  private async loadSymbolTextures(): Promise<void> {
    const { ids, fallbackColors } = this.config.symbols;
    console.log(`AssetLoader: Loading symbols from ${this.assetsPath}/symbols/ (resolution: ${this.resolution})`, ids);

    for (const sym of ids) {
      try {
        // Пробуем загрузить SVG, затем PNG
        let texture: PIXI.Texture;
        const svgUrl = `${this.assetsPath}/symbols/${sym.toLowerCase()}.svg`;
        const pngUrl = `${this.assetsPath}/symbols/${sym.toLowerCase()}.png`;
        
        try {
          texture = await PIXI.Texture.fromURL(svgUrl);
          console.log(`AssetLoader: Loaded ${sym} from SVG`);
        } catch {
          texture = await PIXI.Texture.fromURL(pngUrl);
          console.log(`AssetLoader: Loaded ${sym} from PNG`);
        }
        // Устанавливаем resolution для чёткого отображения на Retina
        texture.baseTexture.resolution = this.resolution;
        texture.baseTexture.update();
        this.symbolTextures.set(sym, texture);
      } catch (e) {
        // Генерируем fallback текстуру
        console.warn(`AssetLoader: Using fallback for symbol ${sym}`, e);
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
