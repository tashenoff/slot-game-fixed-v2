import * as PIXI from 'pixi.js';
import { SpinResult, PaylinePosition } from '../types';
import { WinLineManager } from './WinLine';
import { ShineEffectManager } from './ShineEffect';

export class SlotMachine {
  private app: PIXI.Application;
  private container: HTMLElement | null = null;
  private reels: PIXI.Container[] = [];
  private symbols: PIXI.Sprite[][] = [];
  private symbolTextures: Record<string, PIXI.Texture> = {};
  private borderTexture: PIXI.Texture | null = null;
  private borderSprite: PIXI.Sprite | null = null;
  private barabanTexture: PIXI.Texture | null = null;
  private barabanSprites: PIXI.TilingSprite[] = [];  // Спрайты фона барабанов для вращения

  private reelsContainer: PIXI.Container | null = null;
  private paylineGraphics: PIXI.Graphics[] = [];
  private winLineManager: WinLineManager | null = null;
  private shineManager: ShineEffectManager | null = null;
  private blurFilters: PIXI.filters.BlurFilter[] = [];
  private isSpinning = false;
  private spinCallback: ((r: SpinResult) => void) | null = null;
  private reelStopCallback: ((reelIndex: number) => void) | null = null;
  private currentResult: SpinResult | null = null;
  private ticks: ((d: number) => void)[] = [];
  private timers: number[] = [];
  private winSymbolsAnimating: { sprite: PIXI.Sprite; originalScale: number }[] = [];
  private winSymbolsTicker: ((d: number) => void) | null = null;
  // Для затемнения невыигрышных символов
  private readonly NON_WIN_ALPHA = 0.5; // Степень затемнения (0 = невидимо, 1 = полная яркость)
  private dimmedSymbols: Set<PIXI.Sprite> = new Set();
  // Размер рамки border.png (масштаб ≈ 1.1465)
  private readonly BORDER_WIDTH = 1917;
  private readonly BORDER_HEIGHT = 1064;
  // Внутренняя область рамки для барабанов (без зазоров)
  // Подобрано для точного заполнения области внутри золотой рамки
  private readonly REELS_OFFSET_X = 85;     // Отступ слева
  private readonly REELS_OFFSET_Y = 105;    // Отступ сверху (-20px, сместили выше)
  private readonly REELS_AREA_WIDTH = 1747; // Ширина области (1917 - 85*2 = 1747)
  private readonly REELS_AREA_HEIGHT = 820; // Высота области барабанов (+10px)
  // Размеры ячеек барабанов = область / количество
  private readonly COLS = 5;
  private readonly ROWS = 3;
  // W и H для полного заполнения области без зазоров
  private readonly W = 1747 / 5;   // = 349.4
  private readonly H = 820 / 3;    // ≈ 273.33
  private readonly BUF = 1;
  private readonly SPEED = 35;
  private readonly SPIN_TIME = 600;
  private readonly STOP_DELAY = 120;
  private readonly BOUNCE_HEIGHT = 20;
  private readonly BOUNCE_TIME = 150;
  private readonly MAX_BLUR = 20;
  private state: { on: boolean; stop: boolean; pos: number; final: string[]; bouncing: boolean; bounceStart: number }[] = [];

  constructor() { 
    // Канвас = размер рамки
    this.app = new PIXI.Application({ width: this.BORDER_WIDTH, height: this.BORDER_HEIGHT, backgroundAlpha: 0 }); 
  }

  async init(el: HTMLElement) {
    this.container = el; el.appendChild(this.app.view as HTMLCanvasElement);
    await this.loadTex(); this.buildReels(); this.buildPaylines();
    window.addEventListener('resize', () => this.resize()); this.resize();
  }

  private resize() {
    if (!this.container) return;
    const s = Math.min(this.container.clientWidth / this.BORDER_WIDTH, this.container.clientHeight / this.BORDER_HEIGHT);
    this.app.renderer.resize(this.BORDER_WIDTH * s, this.BORDER_HEIGHT * s); this.app.stage.scale.set(s);
  }

  private async loadTex() {
    // Загружаем рамку border.png
    try {
      this.borderTexture = await PIXI.Texture.fromURL('/assets/symbols/border.png');
    } catch (e) {
      console.warn('Failed to load border.png:', e);
    }

    // Загружаем текстуру барабана baraban.png
    try {
      this.barabanTexture = await PIXI.Texture.fromURL('/assets/symbols/baraban.png');
    } catch (e) {
      console.warn('Failed to load baraban.png:', e);
    }

    for (const sym of ['A','B','C','D','E']) {
      try { this.symbolTextures[sym] = await PIXI.Texture.fromURL(`/assets/symbols/${sym.toLowerCase()}.svg`); }
      catch {
        const c = document.createElement('canvas'); c.width = c.height = this.H - 20; const ctx = c.getContext('2d')!;
        ctx.fillStyle = {A:'#e74c3c',B:'#2ecc71',C:'#3498db',D:'#f1c40f',E:'#9b59b6'}[sym]||'#888';
        ctx.beginPath(); ctx.roundRect(0,0,c.width,c.height,12); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='bold 50px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(sym,c.width/2,c.height/2); this.symbolTextures[sym] = PIXI.Texture.from(c);
      }
    }
  }

  private rnd() { const k=Object.keys(this.symbolTextures); return k[Math.floor(Math.random()*k.length)]; }
  private mkSp(sym: string) { 
    const sp = new PIXI.Sprite(this.symbolTextures[sym]); 
    sp.anchor.set(0.5); 
    // Символы заполняют почти всю ячейку для красочности
    // 92% от минимального размера ячейки
    const symbolSize = Math.min(this.W, this.H) * 0.92;
    sp.width = sp.height = symbolSize; 
    sp.name = sym; 
    return sp; 
  }

  private buildReels() {
    // Сначала добавляем контейнер барабанов
    const rc = new PIXI.Container(); 
    this.reelsContainer = rc;
    // Смещаем контейнер барабанов внутрь рамки
    rc.x = this.REELS_OFFSET_X;
    rc.y = this.REELS_OFFSET_Y;
    this.app.stage.addChild(rc);
    
    // Фон барабанов - текстура baraban.png для каждого барабана отдельно
    const reelsHeight = this.ROWS * this.H;

    for (let c = 0; c < this.COLS; c++) {
      const reel = new PIXI.Container(); 
      reel.x = c * this.W + this.W / 2; 
      rc.addChild(reel); 
      this.reels.push(reel);
      
      // Маска обрезает символы и фон барабана точно по границам области
      const m = new PIXI.Graphics(); 
      m.beginFill(0xffffff);
      m.drawRect(c*this.W, 0, this.W, this.ROWS*this.H);
      m.endFill(); 
      rc.addChild(m); 
      reel.mask = m as any;
      
      // Добавляем фон барабана (TilingSprite для бесшовного вращения)
      if (this.barabanTexture) {
        // TilingSprite позволяет тайлить текстуру и смещать её по Y для эффекта вращения
        const barabanSprite = new PIXI.TilingSprite(
          this.barabanTexture,
          this.W,        // Ширина одного барабана
          reelsHeight * 2  // Делаем выше для буфера при вращении
        );
        barabanSprite.anchor.set(0.5, 0);
        barabanSprite.x = 0;           // Центрируем относительно reel (который уже смещён на W/2)
        barabanSprite.y = -this.H;     // Начальное смещение для буфера сверху
        // Масштабируем тайлы чтобы одна текстура = высота барабана
        barabanSprite.tileScale.set(this.W / this.barabanTexture.width, reelsHeight / this.barabanTexture.height);
        reel.addChild(barabanSprite);
        this.barabanSprites[c] = barabanSprite;
      } else {
        // Fallback на цветной фон если текстура не загрузилась
        const bgGraphics = new PIXI.Graphics();
        bgGraphics.beginFill(0x1a1a2e);
        bgGraphics.drawRect(-this.W/2, -this.H, this.W, reelsHeight + this.H * 2);
        bgGraphics.endFill();
        reel.addChild(bgGraphics);
      }
      
      // Добавляем фильтр размытия
      const blur = new PIXI.filters.BlurFilter();
      blur.blurX = 0;
      blur.blurY = 0;
      blur.quality = 3;
      reel.filters = [blur];
      this.blurFilters[c] = blur;
      
      this.symbols[c] = [];
      for (let r = 0; r < this.ROWS + this.BUF * 2; r++) { 
        const sp = this.mkSp(this.rnd()); 
        // Позиция символа в центре ячейки + смещение для равномерных промежутков
        sp.y = (r - this.BUF) * this.H + this.H / 2; 
        reel.addChild(sp); 
        this.symbols[c].push(sp); 
      }
      this.state[c] = { on: false, stop: false, pos: 0, final: [], bouncing: false, bounceStart: 0 };
    }

    // Добавляем только вертикальные разделители между барабанами
    const frameGraphics = new PIXI.Graphics();
    // Тонкие полупрозрачные линии (менее контрастные)
    for (let c = 1; c < this.COLS; c++) {
      frameGraphics.lineStyle(2, 0x445544, 0.35);
      const x = c * this.W;
      frameGraphics.moveTo(x, 0);
      frameGraphics.lineTo(x, this.ROWS * this.H);
    }
    rc.addChild(frameGraphics);

    // Добавляем рамку border.png ПОВЕРХ барабанов (в конце)
    if (this.borderTexture) {
      this.borderSprite = new PIXI.Sprite(this.borderTexture);
      this.borderSprite.width = this.BORDER_WIDTH;
      this.borderSprite.height = this.BORDER_HEIGHT;
      this.borderSprite.x = 0;
      this.borderSprite.y = 0;
      this.app.stage.addChild(this.borderSprite);
    }
  }

  private buildPaylines() { 
    // Создаём менеджер анимированных линий выигрыша
    this.winLineManager = new WinLineManager(this.app.stage, this.app.ticker, 5);
    // Создаём менеджер эффектов блика для выигрышных символов
    this.shineManager = new ShineEffectManager(this.app.ticker, 15);
    
    // Оставляем старые graphics как fallback
    for (let i = 0; i < 5; i++) { 
      const g = new PIXI.Graphics(); 
      g.visible = false; 
      this.app.stage.addChild(g); 
      this.paylineGraphics.push(g); 
    } 
  }
  setSpinResult(r: SpinResult) { this.currentResult = r; }
  setReelStopCallback(cb: (reelIndex: number) => void) { this.reelStopCallback = cb; }

  spin(cb: (r: SpinResult) => void) {
    if (this.isSpinning) return;
    this.clear(); this.isSpinning = true; this.spinCallback = cb; this.hideLines();
    
    // Сброс позиций всех символов перед спином
    for (let c = 0; c < this.COLS; c++) {
      for (let i = 0; i < this.symbols[c].length; i++) {
        this.symbols[c][i].y = (i - this.BUF) * this.H + this.H / 2;
      }
      this.blurFilters[c].blurY = 0;
    }
    
    const mat = this.currentResult?.matrix || this.rndMat();
    for (let c = 0; c < this.COLS; c++) {
      this.state[c] = { on: true, stop: false, pos: 0, final: mat.map(row => row[c]), bouncing: false, bounceStart: 0 };
      this.timers.push(window.setTimeout(() => { this.state[c].stop = true; }, this.SPIN_TIME + c * this.STOP_DELAY));
    }
    this.runAnim();
  }

  private rndMat() { return Array.from({length:this.ROWS},()=>Array.from({length:this.COLS},()=>this.rnd())); }

  private runAnim() {
    const tick = () => {
      let done = true;
      for (let c = 0; c < this.COLS; c++) {
        const s = this.state[c];
        
        if (s.bouncing) {
          // Анимация отскока - без размытия
          done = false;
          this.blurFilters[c].blurY = 0;
          
          const elapsed = Date.now() - s.bounceStart;
          const progress = Math.min(elapsed / this.BOUNCE_TIME, 1);
          const bounce = Math.sin(progress * Math.PI) * this.BOUNCE_HEIGHT * (1 - progress);
          
          // Двигаем все символы барабана вверх-вниз
          for (let r = 0; r < this.ROWS; r++) {
            const sp = this.symbols[c][r + this.BUF];
            sp.y = r * this.H + this.H / 2 + bounce;
          }
          
          // Двигаем текстуру барабана вместе с символами при отскоке
          if (this.barabanSprites[c]) {
            this.barabanSprites[c].tilePosition.y = bounce;
          }
          
          if (progress >= 1) {
            s.bouncing = false;
            // Финальная позиция
            for (let r = 0; r < this.ROWS; r++) {
              this.symbols[c][r + this.BUF].y = r * this.H + this.H / 2;
            }
            // Сброс позиции текстуры барабана
            if (this.barabanSprites[c]) {
              this.barabanSprites[c].tilePosition.y = 0;
            }
          }
          continue;
        }
        
        if (!s.on) continue;
        done = false;
        
        // Обновляем размытие в зависимости от скорости
        const targetBlur = s.stop ? this.MAX_BLUR * 0.4 : this.MAX_BLUR;
        this.blurFilters[c].blurY += (targetBlur - this.blurFilters[c].blurY) * 0.4;
        
        s.pos += s.stop ? this.SPEED * 0.5 : this.SPEED;
        this.updReel(c);
        
        if (s.stop && Math.floor(s.pos / this.H) >= 3) {
          s.on = false;
          this.blurFilters[c].blurY = 0; // Убираем размытие
          this.fin(c);
          // Запускаем отскок
          s.bouncing = true;
          s.bounceStart = Date.now();
        }
      }
      
      if (done) {
        this.app.ticker.remove(tick);
        this.ticks = this.ticks.filter(x => x !== tick);
        this.onDone();
      }
    };
    this.ticks.push(tick);
    this.app.ticker.add(tick);
  }

  private updReel(c: number) {
    const s = this.state[c], off = s.pos % this.H, tot = this.symbols[c].length;
    for (let i = 0; i < tot; i++) {
      const sp = this.symbols[c][i]; let y = (i - this.BUF) * this.H + this.H / 2 + off;
      if (y > (this.ROWS + this.BUF) * this.H) { y -= tot * this.H; if (!s.stop) { const ns = this.rnd(); sp.texture = this.symbolTextures[ns]; sp.name = ns; } }
      sp.y = y;
    }
    // Обновляем смещение текстуры барабана для эффекта вращения
    if (this.barabanSprites[c]) {
      this.barabanSprites[c].tilePosition.y = s.pos;
    }
  }

  private fin(c: number) {
    // Вызываем колбэк остановки барабана
    this.reelStopCallback?.(c);
    
    const f = this.state[c].final;
    // Сбросить ВСЕ символы в колонке, включая буферные
    for (let i = 0; i < this.symbols[c].length; i++) {
      const sp = this.symbols[c][i];
      sp.y = (i - this.BUF) * this.H + this.H / 2;
      // Установить финальные текстуры только для видимых символов
      if (i >= this.BUF && i < this.BUF + this.ROWS) {
        const r = i - this.BUF;
        sp.texture = this.symbolTextures[f[r]];
        sp.name = f[r];
      }
    }
    // Сброс позиции текстуры барабана к начальной
    if (this.barabanSprites[c]) {
      this.barabanSprites[c].tilePosition.y = 0;
    }
  }

  private onDone() { this.isSpinning = false; if (this.currentResult) { this.showWins(this.currentResult); this.spinCallback?.(this.currentResult); } }
  
  private clear() { 
    this.ticks.forEach(t => this.app.ticker.remove(t)); 
    this.ticks = []; 
    this.timers.forEach(clearTimeout); 
    this.timers = []; 
    this.paylineGraphics.forEach(p => { p.visible = false; p.alpha = 1; }); 
    // Скрываем анимированные линии
    this.winLineManager?.hideAll();
    // Останавливаем эффекты блика
    this.shineManager?.stopAll();
    // Останавливаем анимацию выигрышных символов
    this.stopWinSymbolsAnimation();
    // Очищаем кэш масштабов и восстанавливаем оригинальные масштабы
    this.originalSymbolScales.forEach((scale, sprite) => {
      sprite.scale.set(scale);
    });
    this.originalSymbolScales.clear();
    // Восстанавливаем альфу всех затемнённых символов
    this.resetSymbolsAlpha();
  }

  private showWins(r: SpinResult) {
    // Цветовые темы для разных линий
    const themes: ('gold' | 'red' | 'green' | 'blue' | 'purple')[] = ['gold', 'red', 'green', 'blue', 'purple'];
    
    // Затемняем невыигрышные символы только если есть выигрышные линии
    if (r.wins && r.wins.length > 0) {
      // Собираем все выигрышные позиции для затемнения невыигрышных символов
      const allWinPositions = new Set<string>();
      r.wins.forEach((w) => {
        const pos = this.linePos(w.line);
        for (let i = 0; i < w.count && i < pos.length; i++) {
          allWinPositions.add(`${pos[i].col}_${pos[i].row}`);
        }
      });
      this.dimNonWinSymbols(allWinPositions);
      
      // Запускаем эффект блика на всех выигрышных символах
      allWinPositions.forEach((key, index) => {
        const [col, row] = key.split('_').map(Number);
        const symbolIndex = this.BUF + row;
        const sprite = this.symbols[col]?.[symbolIndex];
        if (sprite && this.shineManager) {
          this.shineManager.playOnSprite(sprite, { delay: index * 100 });
        }
      });
    }

    r.wins?.forEach((w, index) => {
      const pos = this.linePos(w.line);
      const offsetX = this.REELS_OFFSET_X;
      const offsetY = this.REELS_OFFSET_Y;
      
      // Собираем позиции выигрышных символов (только первые w.count)
      const winSymbolPositions: {col: number; row: number}[] = [];
      for (let i = 0; i < w.count && i < pos.length; i++) {
        winSymbolPositions.push({ col: pos[i].col, row: pos[i].row });
      }
      
      // Преобразуем позиции в координаты
      const points = pos.map(p => ({
        x: p.col * this.W + this.W / 2 + offsetX,
        y: p.row * this.H + this.H / 2 + offsetY
      }));
      
      // Используем новый анимированный менеджер линий с callbacks
      if (this.winLineManager) {
        const theme = themes[w.line % themes.length];
        
        // Трекер анимированных символов для этой линии
        const animatedSymbols = new Set<number>();
        
        setTimeout(() => {
          this.winLineManager?.showLine(
            w.line, 
            points, 
            theme, 
            true,
            // onCycleStart - когда начинается новый цикл анимации линии
            () => {
              animatedSymbols.clear();
            },
            // onProgress - когда линия достигает следующей точки
            (progress: number, pointIndex: number) => {
              // Анимируем символ только если он ещё не был анимирован в этом цикле
              if (pointIndex < winSymbolPositions.length && !animatedSymbols.has(pointIndex)) {
                animatedSymbols.add(pointIndex);
                this.animateWinSymbol(winSymbolPositions[pointIndex]);
              }
            }
          );
        }, index * 200);
      }
    });
  }
  
  // Хранилище оригинальных масштабов символов
  private originalSymbolScales: Map<PIXI.Sprite, number> = new Map();
  
  // Анимация одного выигрышного символа
  private animateWinSymbol(pos: {col: number; row: number}) {
    const symbolIndex = this.BUF + pos.row;
    const sprite = this.symbols[pos.col]?.[symbolIndex];
    if (!sprite) return;
    
    // Сохраняем оригинальный масштаб только один раз
    if (!this.originalSymbolScales.has(sprite)) {
      this.originalSymbolScales.set(sprite, sprite.scale.x);
    }
    const originalScale = this.originalSymbolScales.get(sprite)!;
    const targetScale = originalScale * 1.03; // Увеличение на 3%
    
    // Используем GSAP-подобную анимацию через requestAnimationFrame
    this.smoothScaleAnimation(sprite, targetScale, originalScale, 300);
  }
  
  // Плавная анимация масштаба: увеличение и возврат
  private smoothScaleAnimation(sprite: PIXI.Sprite, peakScale: number, originalScale: number, totalDuration: number) {
    const startTime = performance.now();
    const halfDuration = totalDuration / 2;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      
      if (elapsed < halfDuration) {
        // Фаза увеличения
        const progress = elapsed / halfDuration;
        // Ease out quad
        const eased = 1 - (1 - progress) * (1 - progress);
        sprite.scale.set(originalScale + (peakScale - originalScale) * eased);
        requestAnimationFrame(animate);
      } else if (elapsed < totalDuration) {
        // Фаза возврата
        const progress = (elapsed - halfDuration) / halfDuration;
        // Ease in quad
        const eased = progress * progress;
        sprite.scale.set(peakScale - (peakScale - originalScale) * eased);
        requestAnimationFrame(animate);
      } else {
        // Конец анимации - точно возвращаем оригинальный масштаб
        sprite.scale.set(originalScale);
      }
    };
    
    requestAnimationFrame(animate);
  }
  
  // Остановка анимации выигрышных символов
  private stopWinSymbolsAnimation() {
    if (this.winSymbolsTicker) {
      this.app.ticker.remove(this.winSymbolsTicker);
      this.winSymbolsTicker = null;
    }
    
    // Возвращаем символы к оригинальному размеру
    this.winSymbolsAnimating.forEach(item => {
      item.sprite.scale.set(item.originalScale);
    });
    this.winSymbolsAnimating = [];
  }

  /**
   * Затемняет все символы, кроме тех, что находятся на выигрышных позициях.
   * @param winPositions - Set строк вида "col_row" для выигрышных позиций
   */
  private dimNonWinSymbols(winPositions: Set<string>) {
    // Проходим по всем видимым символам (3 строки, 5 колонок)
    for (let col = 0; col < this.COLS; col++) {
      for (let row = 0; row < this.ROWS; row++) {
        const symbolIndex = this.BUF + row;
        const sprite = this.symbols[col]?.[symbolIndex];
        if (!sprite) continue;

        const key = `${col}_${row}`;
        if (winPositions.has(key)) {
          // Выигрышный символ — полная яркость
          sprite.alpha = 1.0;
        } else {
          // Невыигрышный символ — затемняем
          sprite.alpha = this.NON_WIN_ALPHA;
          this.dimmedSymbols.add(sprite);
        }
      }
    }
  }

  /**
   * Восстанавливает альфу всех затемнённых символов обратно в 1.0.
   * Вызывается перед новым спином.
   */
  private resetSymbolsAlpha() {
    this.dimmedSymbols.forEach(sprite => {
      sprite.alpha = 1.0;
    });
    this.dimmedSymbols.clear();
  }

  private linePos(l: number): PaylinePosition[] {
    if (l===0) return [0,1,2,3,4].map(c=>({row:1,col:c}));
    if (l===1) return [0,1,2,3,4].map(c=>({row:0,col:c}));
    if (l===2) return [0,1,2,3,4].map(c=>({row:2,col:c}));
    if (l===3) return [{row:0,col:0},{row:1,col:1},{row:2,col:2},{row:1,col:3},{row:0,col:4}];
    return [{row:2,col:0},{row:1,col:1},{row:0,col:2},{row:1,col:3},{row:2,col:4}];
  }

  private hideLines() { 
    this.paylineGraphics.forEach(p => { p.visible = false; }); 
    this.winLineManager?.hideAll();
  }
  
  destroy() { 
    this.clear(); 
    this.winLineManager?.destroy();
    this.shineManager?.destroy();
    this.app?.destroy(true, { children: true, texture: true, baseTexture: true }); 
  }
}
