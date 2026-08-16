import * as PIXI from 'pixi.js';
import { SpinResult, PaylinePosition } from '../types';

export class SlotMachine {
  private app: PIXI.Application;
  private container: HTMLElement | null = null;
  private reels: PIXI.Container[] = [];
  private symbols: PIXI.Sprite[][] = [];
  private symbolTextures: Record<string, PIXI.Texture> = {};
  private paylineGraphics: PIXI.Graphics[] = [];
  private blurFilters: PIXI.filters.BlurFilter[] = [];
  private isSpinning = false;
  private spinCallback: ((r: SpinResult) => void) | null = null;
  private currentResult: SpinResult | null = null;
  private ticks: ((d: number) => void)[] = [];
  private timers: number[] = [];
  private readonly W = 160;
  private readonly H = 150;
  private readonly ROWS = 3;
  private readonly COLS = 5;
  private readonly BUF = 1;
  private readonly SPEED = 35;
  private readonly SPIN_TIME = 400;
  private readonly STOP_DELAY = 180;
  private readonly BOUNCE_HEIGHT = 20;
  private readonly BOUNCE_TIME = 150;
  private readonly MAX_BLUR = 20;
  private state: { on: boolean; stop: boolean; pos: number; final: string[]; bouncing: boolean; bounceStart: number }[] = [];

  constructor() { this.app = new PIXI.Application({ width: this.COLS * this.W, height: this.ROWS * this.H, backgroundColor: 0x1a1a2e }); }

  async init(el: HTMLElement) {
    this.container = el; el.appendChild(this.app.view as HTMLCanvasElement);
    await this.loadTex(); this.buildReels(); this.buildPaylines();
    window.addEventListener('resize', () => this.resize()); this.resize();
  }

  private resize() {
    if (!this.container) return;
    const s = Math.min(this.container.clientWidth / (this.COLS * this.W), this.container.clientHeight / (this.ROWS * this.H));
    this.app.renderer.resize(this.COLS * this.W * s, this.ROWS * this.H * s); this.app.stage.scale.set(s);
  }

  private async loadTex() {
    for (const sym of ['A','B','C','D','E']) {
      try { this.symbolTextures[sym] = await PIXI.Texture.fromURL(`/assets/symbols/${sym.toLowerCase()}.png`); }
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
  private mkSp(sym: string) { const sp = new PIXI.Sprite(this.symbolTextures[sym]); sp.anchor.set(0.5); sp.width = sp.height = this.H - 20; sp.name = sym; return sp; }

  private buildReels() {
    const rc = new PIXI.Container(); this.app.stage.addChild(rc);
    for (let c = 0; c < this.COLS; c++) {
      const reel = new PIXI.Container(); reel.x = c * this.W + this.W / 2; rc.addChild(reel); this.reels.push(reel);
      const m = new PIXI.Graphics(); m.beginFill(0xffffff).drawRect(c*this.W,0,this.W,this.ROWS*this.H).endFill(); rc.addChild(m); reel.mask = m as any;
      
      // Добавляем фильтр размытия
      const blur = new PIXI.filters.BlurFilter();
      blur.blurX = 0;
      blur.blurY = 0;
      blur.quality = 3;
      reel.filters = [blur];
      this.blurFilters[c] = blur;
      
      this.symbols[c] = [];
      for (let r = 0; r < this.ROWS + this.BUF * 2; r++) { const sp = this.mkSp(this.rnd()); sp.y = (r - this.BUF) * this.H + this.H / 2; reel.addChild(sp); this.symbols[c].push(sp); }
      this.state[c] = { on: false, stop: false, pos: 0, final: [], bouncing: false, bounceStart: 0 };
    }
  }

  private buildPaylines() { for (let i = 0; i < 5; i++) { const g = new PIXI.Graphics(); g.visible = false; this.app.stage.addChild(g); this.paylineGraphics.push(g); } }
  setSpinResult(r: SpinResult) { this.currentResult = r; }

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
          
          if (progress >= 1) {
            s.bouncing = false;
            // Финальная позиция
            for (let r = 0; r < this.ROWS; r++) {
              this.symbols[c][r + this.BUF].y = r * this.H + this.H / 2;
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
  }

  private fin(c: number) {
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
  }

  private onDone() { this.isSpinning = false; if (this.currentResult) { this.showWins(this.currentResult); this.spinCallback?.(this.currentResult); } }
  private clear() { this.ticks.forEach(t => this.app.ticker.remove(t)); this.ticks = []; this.timers.forEach(clearTimeout); this.timers = []; this.paylineGraphics.forEach(p => { p.visible = false; p.alpha = 1; }); }

  private showWins(r: SpinResult) {
    r.wins?.forEach(w => {
      const g = this.paylineGraphics[w.line]; if (!g) return; g.clear();
      g.lineStyle(4, [0xe74c3c,0x2ecc71,0x3498db,0xf1c40f,0x9b59b6][w.line % 5]);
      const pos = this.linePos(w.line);
      g.moveTo(pos[0].col * this.W + this.W / 2, pos[0].row * this.H + this.H / 2);
      pos.slice(1).forEach(p => g.lineTo(p.col * this.W + this.W / 2, p.row * this.H + this.H / 2));
      g.visible = true;
    });
  }

  private linePos(l: number): PaylinePosition[] {
    if (l===0) return [0,1,2,3,4].map(c=>({row:1,col:c}));
    if (l===1) return [0,1,2,3,4].map(c=>({row:0,col:c}));
    if (l===2) return [0,1,2,3,4].map(c=>({row:2,col:c}));
    if (l===3) return [{row:0,col:0},{row:1,col:1},{row:2,col:2},{row:1,col:3},{row:0,col:4}];
    return [{row:2,col:0},{row:1,col:1},{row:0,col:2},{row:1,col:3},{row:2,col:4}];
  }

  private hideLines() { this.paylineGraphics.forEach(p => { p.visible = false; }); }
  destroy() { this.clear(); this.app?.destroy(true, { children: true, texture: true, baseTexture: true }); }
}
