import * as PIXI from 'pixi.js';

interface Point {
  x: number;
  y: number;
}

/**
 * WinLine - красивая анимированная линия выигрыша
 * Создаёт эффект золотой светящейся ленты с анимацией появления и частицами
 */
export class WinLine {
  private container: PIXI.Container;
  private glowLayer: PIXI.Graphics;
  private mainLine: PIXI.Graphics;
  private highlightLine: PIXI.Graphics;
  private particlesContainer: PIXI.Container;
  private particles: PIXI.Graphics[] = [];
  
  private points: Point[] = [];
  private progress: number = 0;
  private animationSpeed: number = 0.025; // Скорость появления
  private isAnimating: boolean = false;
  private pulsePhase: number = 0;
  private ticker: PIXI.Ticker;
  private tickerCallback: (() => void) | null = null;
  private looping: boolean = true; // Циклическая анимация
  private fadeOutProgress: number = 0;
  private isFadingOut: boolean = false;
  private pauseTime: number = 0;
  private delayTime: number = 0;
  private isDelaying: boolean = false;
  private readonly PAUSE_DURATION = 90; // Пауза когда линия видна (~1.5 сек)
  private readonly DELAY_DURATION = 60; // Задержка перед новым появлением (~1 сек)
  
  // Callback для уведомления о прогрессе анимации
  private onProgressCallback: ((progress: number, pointIndex: number) => void) | null = null;
  private onCycleStartCallback: (() => void) | null = null;
  
  private colors = {
    glow: 0xffa500, outer: 0xffd700, main: 0xffcc00,
    highlight: 0xffffaa, core: 0xffffff
  };
  
  // Тонкие линии
  private lineWidth = {
    glow: 18, outer: 8, main: 5, highlight: 3, core: 1
  };

  constructor(ticker: PIXI.Ticker) {
    this.ticker = ticker;
    this.container = new PIXI.Container();
    
    this.glowLayer = new PIXI.Graphics();
    this.mainLine = new PIXI.Graphics();
    this.highlightLine = new PIXI.Graphics();
    this.particlesContainer = new PIXI.Container();
    
    this.container.addChild(this.glowLayer);
    this.container.addChild(this.mainLine);
    this.container.addChild(this.highlightLine);
    this.container.addChild(this.particlesContainer);
    this.container.visible = false;
  }

  getContainer(): PIXI.Container { return this.container; }

  setColors(theme: 'gold' | 'red' | 'green' | 'blue' | 'purple') {
    const themes: Record<string, typeof this.colors> = {
      gold: { glow: 0xffa500, outer: 0xffd700, main: 0xffcc00, highlight: 0xffffaa, core: 0xffffff },
      red: { glow: 0xff3333, outer: 0xff5555, main: 0xff6666, highlight: 0xffaaaa, core: 0xffffff },
      green: { glow: 0x33ff33, outer: 0x55ff55, main: 0x66ff66, highlight: 0xaaffaa, core: 0xffffff },
      blue: { glow: 0x3399ff, outer: 0x55aaff, main: 0x66bbff, highlight: 0xaaddff, core: 0xffffff },
      purple: { glow: 0x9933ff, outer: 0xaa55ff, main: 0xbb66ff, highlight: 0xddaaff, core: 0xffffff }
    };
    this.colors = themes[theme] || themes.gold;
  }

  show(points: Point[], animated: boolean = true, 
       onCycleStart?: () => void, 
       onProgress?: (progress: number, pointIndex: number) => void) {
    this.points = points;
    this.container.visible = true;
    this.onCycleStartCallback = onCycleStart || null;
    this.onProgressCallback = onProgress || null;
    
    if (animated) {
      this.progress = 0;
      this.isAnimating = true;
      this.onCycleStartCallback?.(); // Первый цикл начался
      this.startAnimation();
    } else {
      this.progress = 1;
      this.drawLine(1);
      this.startAnimation();
    }
  }

  hide() {
    this.stopAnimation();
    this.container.visible = false;
    this.clear();
  }

  private clear() {
    this.glowLayer.clear();
    this.mainLine.clear();
    this.highlightLine.clear();
    this.particles.forEach(p => p.destroy());
    this.particles = [];
    this.particlesContainer.removeChildren();
  }

  private startAnimation() {
    if (this.tickerCallback) this.ticker.remove(this.tickerCallback);
    
    let lastPointIndex = -1;
    
    this.tickerCallback = () => {
      // Фаза появления
      if (this.isAnimating && this.progress < 1 && !this.isFadingOut) {
        const prevProgress = this.progress;
        this.progress = Math.min(1, this.progress + this.animationSpeed);
        this.drawLine(this.progress, 1);
        this.spawnParticles(this.progress);
        
        // Вычисляем какой символ сейчас достигает линия
        const currentPointIndex = Math.floor(this.progress * (this.points.length - 1));
        if (currentPointIndex > lastPointIndex) {
          lastPointIndex = currentPointIndex;
          this.onProgressCallback?.(this.progress, currentPointIndex);
        }
        
        if (this.progress >= 1) {
          this.isAnimating = false;
          this.pauseTime = 0;
        }
      } 
      // Фаза паузы (линия полностью видна, без мигания)
      else if (this.progress >= 1 && !this.isFadingOut && !this.isDelaying) {
        this.pauseTime++;
        this.drawLineStatic(1); // Статичная линия без пульсации
        
        // После паузы начинаем исчезновение
        if (this.looping && this.pauseTime >= this.PAUSE_DURATION) {
          this.isFadingOut = true;
          this.fadeOutProgress = 0;
        }
      }
      // Фаза исчезновения
      else if (this.isFadingOut) {
        this.fadeOutProgress = Math.min(1, this.fadeOutProgress + this.animationSpeed);
        this.drawLine(1, 1 - this.fadeOutProgress);
        
        // Когда полностью исчезла - начинаем задержку
        if (this.fadeOutProgress >= 1) {
          this.isFadingOut = false;
          this.isDelaying = true;
          this.delayTime = 0;
          this.clear();
        }
      }
      // Фаза задержки перед новым появлением
      else if (this.isDelaying) {
        this.delayTime++;
        // После задержки начинаем новый цикл
        if (this.delayTime >= this.DELAY_DURATION) {
          this.isDelaying = false;
          this.progress = 0;
          this.isAnimating = true;
          lastPointIndex = -1;
          this.onCycleStartCallback?.(); // Уведомляем о новом цикле
        }
      }
      
      this.updateParticles();
      this.pulsePhase += 0.05;
    };
    this.ticker.add(this.tickerCallback);
  }

  private stopAnimation() {
    if (this.tickerCallback) {
      this.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }
    this.isAnimating = false;
  }

  private getPointAtProgress(progress: number): Point | null {
    if (this.points.length < 2) return null;
    const totalLength = this.getTotalLength();
    const targetLength = totalLength * progress;
    let currentLength = 0;
    
    for (let i = 0; i < this.points.length - 1; i++) {
      const segLen = this.getDistance(this.points[i], this.points[i + 1]);
      if (currentLength + segLen >= targetLength) {
        const t = (targetLength - currentLength) / segLen;
        return {
          x: this.points[i].x + (this.points[i + 1].x - this.points[i].x) * t,
          y: this.points[i].y + (this.points[i + 1].y - this.points[i].y) * t
        };
      }
      currentLength += segLen;
    }
    return this.points[this.points.length - 1];
  }

  private getTotalLength(): number {
    let length = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      length += this.getDistance(this.points[i], this.points[i + 1]);
    }
    return length;
  }

  private getDistance(p1: Point, p2: Point): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  private getDrawPoints(progress: number): Point[] {
    // Сначала получаем сглаженные точки
    const smoothed = this.getSmoothPoints(this.points, 20);
    
    if (progress >= 1) return smoothed;
    
    // Обрезаем по прогрессу
    const result: Point[] = [smoothed[0]];
    const totalLength = this.getPathLength(smoothed);
    const targetLength = totalLength * progress;
    let currentLength = 0;
    
    for (let i = 0; i < smoothed.length - 1; i++) {
      const segLen = this.getDistance(smoothed[i], smoothed[i + 1]);
      if (currentLength + segLen >= targetLength) {
        const t = (targetLength - currentLength) / segLen;
        result.push({
          x: smoothed[i].x + (smoothed[i + 1].x - smoothed[i].x) * t,
          y: smoothed[i].y + (smoothed[i + 1].y - smoothed[i].y) * t
        });
        break;
      }
      result.push(smoothed[i + 1]);
      currentLength += segLen;
    }
    return result;
  }
  
  // Создаёт сглаженный путь - только скругление углов, без выпуклости
  private getSmoothPoints(points: Point[], segmentsPerCorner: number = 8): Point[] {
    if (points.length < 3) return [...points];
    
    const result: Point[] = [];
    const cornerRadius = 40; // Радиус скругления углов
    
    // Начальная точка
    result.push({ ...points[0] });
    
    // Обрабатываем каждый угол
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // Вектора к предыдущей и следующей точке
      const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
      const toNext = { x: next.x - curr.x, y: next.y - curr.y };
      
      // Длины векторов
      const lenPrev = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
      const lenNext = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
      
      // Ограничиваем радиус чтобы не выходить за пределы сегментов
      const maxRadius = Math.min(cornerRadius, lenPrev * 0.4, lenNext * 0.4);
      
      // Нормализованные вектора
      const normPrev = { x: toPrev.x / lenPrev, y: toPrev.y / lenPrev };
      const normNext = { x: toNext.x / lenNext, y: toNext.y / lenNext };
      
      // Точки начала и конца скругления
      const startCorner = {
        x: curr.x + normPrev.x * maxRadius,
        y: curr.y + normPrev.y * maxRadius
      };
      const endCorner = {
        x: curr.x + normNext.x * maxRadius,
        y: curr.y + normNext.y * maxRadius
      };
      
      // Добавляем точку перед скруглением
      result.push(startCorner);
      
      // Интерполируем скругление с помощью квадратичной кривой
      for (let j = 1; j < segmentsPerCorner; j++) {
        const t = j / segmentsPerCorner;
        // Квадратичная интерполяция через угловую точку
        const oneMinusT = 1 - t;
        const point = {
          x: oneMinusT * oneMinusT * startCorner.x + 
             2 * oneMinusT * t * curr.x + 
             t * t * endCorner.x,
          y: oneMinusT * oneMinusT * startCorner.y + 
             2 * oneMinusT * t * curr.y + 
             t * t * endCorner.y
        };
        result.push(point);
      }
      
      // Добавляем точку после скругления
      result.push(endCorner);
    }
    
    // Конечная точка
    result.push({ ...points[points.length - 1] });
    
    return result;
  }
  
  // Длина пути по массиву точек
  private getPathLength(points: Point[]): number {
    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
      length += this.getDistance(points[i], points[i + 1]);
    }
    return length;
  }

  private drawLine(progress: number, alpha: number = 1) {
    this.glowLayer.clear();
    this.mainLine.clear();
    this.highlightLine.clear();
    
    const drawPoints = this.getDrawPoints(progress);
    if (drawPoints.length < 2) return;
    
    // Рисуем линию с помощью полигонов для заострённых концов
    this.drawTaperedLine(drawPoints, alpha, 1.0);
  }
  
  // Статичная линия без пульсации
  private drawLineStatic(alpha: number = 1) {
    this.glowLayer.clear();
    this.mainLine.clear();
    this.highlightLine.clear();
    
    if (this.points.length < 2) return;
    
    // Рисуем полную сглаженную линию без пульсации
    const smoothed = this.getSmoothPoints(this.points, 20);
    this.drawTaperedLine(smoothed, alpha, 1.0);
  }
  
  // Рисование линии с заострёнными концами (тонкими на краях)
  private drawTaperedLine(points: Point[], alpha: number, pulse: number) {
    if (points.length < 2) return;
    
    // Создаём полигон для линии с переменной толщиной
    const totalLen = this.getTotalLength();
    const segments = 50; // Количество сегментов для сглаживания
    
    // Рисуем свечение
    this.drawTaperedPath(this.glowLayer, points, this.lineWidth.glow, 
      this.colors.glow, 0.15 * pulse * alpha, totalLen);
    
    // Рисуем основной слой  
    this.drawTaperedPath(this.mainLine, points, this.lineWidth.outer, 
      this.colors.outer, 0.9 * pulse * alpha, totalLen);
    this.drawTaperedPath(this.mainLine, points, this.lineWidth.main, 
      this.colors.main, 1 * alpha, totalLen);
    
    // Рисуем подсветку
    this.drawTaperedPath(this.highlightLine, points, this.lineWidth.highlight, 
      this.colors.highlight, 0.8 * pulse * alpha, totalLen);
    this.drawTaperedPath(this.highlightLine, points, this.lineWidth.core, 
      this.colors.core, 0.9 * pulse * alpha, totalLen);
  }
  
  // Рисование пути с переменной толщиной (заострённые концы)
  private drawTaperedPath(g: PIXI.Graphics, points: Point[], maxWidth: number, 
                          color: number, alpha: number, totalLen: number) {
    if (points.length < 2 || alpha <= 0) return;
    
    // Для простоты - рисуем несколько сегментов с разной толщиной
    const numSegments = Math.max(points.length - 1, 1);
    
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      // Определяем толщину на концах сегмента
      // На краях линии - тоньше
      const t1 = this.getProgressAtPoint(i, points);
      const t2 = this.getProgressAtPoint(i + 1, points);
      
      // Функция для толщины: максимум в центре, минимум на краях
      const width1 = this.getTaperWidth(t1, maxWidth);
      const width2 = this.getTaperWidth(t2, maxWidth);
      
      // Рисуем трапецию между точками
      this.drawTrapezoid(g, p1, p2, width1, width2, color, alpha);
    }
  }
  
  // Получить прогресс (0-1) для точки с индексом
  private getProgressAtPoint(index: number, points: Point[]): number {
    if (points.length <= 1) return 0;
    if (index <= 0) return 0;
    if (index >= points.length - 1) return 1;
    
    let lengthToPoint = 0;
    for (let i = 0; i < index; i++) {
      lengthToPoint += this.getDistance(points[i], points[i + 1]);
    }
    
    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalLength += this.getDistance(points[i], points[i + 1]);
    }
    
    return totalLength > 0 ? lengthToPoint / totalLength : 0;
  }
  
  // Толщина линии в зависимости от позиции (заострённые концы)
  private getTaperWidth(t: number, maxWidth: number): number {
    // Синусоидальная функция для плавного заострения на концах
    // t=0 или t=1 -> минимальная толщина, t=0.5 -> максимальная
    const taper = Math.sin(t * Math.PI);
    const minWidth = maxWidth * 0.15; // Минимальная толщина на концах
    return minWidth + (maxWidth - minWidth) * taper;
  }
  
  // Рисование трапеции между двумя точками с разной толщиной
  private drawTrapezoid(g: PIXI.Graphics, p1: Point, p2: Point, 
                        w1: number, w2: number, color: number, alpha: number) {
    // Вектор направления
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    
    // Нормаль (перпендикуляр)
    const nx = -dy / len;
    const ny = dx / len;
    
    // Четыре угла трапеции
    const half1 = w1 / 2;
    const half2 = w2 / 2;
    
    g.beginFill(color, alpha);
    g.moveTo(p1.x + nx * half1, p1.y + ny * half1);
    g.lineTo(p2.x + nx * half2, p2.y + ny * half2);
    g.lineTo(p2.x - nx * half2, p2.y - ny * half2);
    g.lineTo(p1.x - nx * half1, p1.y - ny * half1);
    g.closePath();
    g.endFill();
  }

  private spawnParticles(progress: number) {
    const headPoint = this.getPointAtProgress(progress);
    if (!headPoint) return;
    
    for (let i = 0; i < 3; i++) {
      this.createParticle(headPoint.x, headPoint.y);
    }
    
    if (Math.random() > 0.7) {
      const randomPoint = this.getPointAtProgress(Math.random() * progress);
      if (randomPoint) this.createParticle(randomPoint.x, randomPoint.y);
    }
  }

  private createParticle(x: number, y: number) {
    const particle = new PIXI.Graphics();
    const size = 2 + Math.random() * 4;
    const offsetX = (Math.random() - 0.5) * 30;
    const offsetY = (Math.random() - 0.5) * 30;
    
    particle.beginFill(this.colors.highlight, 0.8);
    particle.drawCircle(0, 0, size);
    particle.endFill();
    particle.beginFill(this.colors.glow, 0.3);
    particle.drawCircle(0, 0, size * 2);
    particle.endFill();
    
    particle.x = x + offsetX;
    particle.y = y + offsetY;
    (particle as any).vx = (Math.random() - 0.5) * 3;
    (particle as any).vy = (Math.random() - 0.5) * 3 - 1;
    (particle as any).life = 1;
    (particle as any).decay = 0.02 + Math.random() * 0.03;
    
    this.particles.push(particle);
    this.particlesContainer.addChild(particle);
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i] as any;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= p.decay;
      p.alpha = p.life;
      p.scale.set(p.life);
      
      if (p.life <= 0) {
        this.particlesContainer.removeChild(p);
        p.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  destroy() {
    this.stopAnimation();
    this.clear();
    this.container.destroy({ children: true });
  }
}

/** WinLineManager - управление несколькими линиями выигрыша */
export class WinLineManager {
  private lines: WinLine[] = [];
  private stage: PIXI.Container;
  private ticker: PIXI.Ticker;

  constructor(stage: PIXI.Container, ticker: PIXI.Ticker, maxLines: number = 15) {
    this.stage = stage;
    this.ticker = ticker;
    for (let i = 0; i < maxLines; i++) {
      const line = new WinLine(ticker);
      this.lines.push(line);
      const container = line.getContainer();
      container.zIndex = 20; // Поверх рамки (zIndex 10)
      this.stage.addChild(container);
    }
  }

  showLine(lineIndex: number, points: {x: number; y: number}[], 
           theme: 'gold' | 'red' | 'green' | 'blue' | 'purple' = 'gold', 
           animated: boolean = true,
           onCycleStart?: () => void,
           onProgress?: (progress: number, pointIndex: number) => void) {
    if (lineIndex >= 0 && lineIndex < this.lines.length) {
      this.lines[lineIndex].setColors(theme);
      this.lines[lineIndex].show(points, animated, onCycleStart, onProgress);
    }
  }

  hideLine(lineIndex: number) {
    if (lineIndex >= 0 && lineIndex < this.lines.length) {
      this.lines[lineIndex].hide();
    }
  }

  hideAll() { this.lines.forEach(line => line.hide()); }
  destroy() { this.lines.forEach(line => line.destroy()); this.lines = []; }
}

