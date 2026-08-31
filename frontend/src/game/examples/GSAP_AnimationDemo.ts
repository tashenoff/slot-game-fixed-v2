/**
 * ДЕМОНСТРАЦИЯ: анимации на GSAP vs ручной код
 * 
 * Текущий проект использует ручные анимации через requestAnimationFrame.
 * GSAP решает те же задачи в 5-10 строк.
 * 
 * Установка: npm install gsap
 * Импорт: import gsap from 'gsap';
 */

import * as PIXI from 'pixi.js';
// import gsap from 'gsap'; // раскомментировать после npm install gsap

// =============================================================
// ПРИМЕР 1: Пульсация символа (scale) — SymbolAnimator
// =============================================================

/**
 * ТЕКУЩАЯ РЕАЛИЗАЦИЯ (из SymbolAnimator) — ~35 строк
 */
export function animateWinSymbol_manual(
  sprite: PIXI.Sprite, originalScale: number, 
  peakScale: number, totalDuration: number
): void {
  const startTime = performance.now();
  const halfDuration = totalDuration / 2;
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    if (elapsed < halfDuration) {
      const progress = elapsed / halfDuration;
      const eased = 1 - (1 - progress) * (1 - progress);
      sprite.scale.set(originalScale + (peakScale - originalScale) * eased);
      requestAnimationFrame(animate);
    } else if (elapsed < totalDuration) {
      const progress = (elapsed - halfDuration) / halfDuration;
      const eased = progress * progress;
      sprite.scale.set(peakScale - (peakScale - originalScale) * eased);
      requestAnimationFrame(animate);
    } else {
      sprite.scale.set(originalScale);
    }
  };
  requestAnimationFrame(animate);
}

/**
 * GSAP: 1 вызов — 3 строки
 * gsap.to(sprite.scale, {
 *   x: peakScale, y: peakScale,
 *   duration: totalDuration / 2000,
 *   ease: 'power2.out',
 *   yoyo: true, repeat: 1,
 *   onComplete: () => sprite.scale.set(originalScale)
 * });
 */

// =============================================================
// ПРИМЕР 2: Stagger барабанов — ReelAnimator
// =============================================================

/**
 * ТЕКУЩАЯ: ~100+ строк ручного кода
 * - Расчёт дистанций, setTimeout, tick-проверки
 * - Ручной синус для bounce
 * - Управление фазами: spinning -> stopping -> bouncing -> idle
 */

/**
 * GSAP (stagger + bounce ease):
 * gsap.to(reels, {
 *   y: targetY,
 *   duration: 0.5,
 *   ease: 'power2.inOut',
 *   stagger: 0.15,        // 150ms между барабанами
 *   onComplete: () => { ... }
 * });
 * 
 * // + bounce отдельно:
 * gsap.to(reels, {
 *   y: '+=10',
 *   duration: 0.3,
 *   ease: 'bounce.out',    // встроенный отскок
 *   stagger: 0.05
 * });
 */

// =============================================================
// ПРИМЕР 3: Motion blur — ReelAnimator
// =============================================================

/**
 * ТЕКУЩАЯ:
 *   blurFilters[col].blurY += (targetBlur - blurFilters[col].blurY) * 0.5;
 *   // потом: blurFilters[col].blurY = 0;
 */

/**
 * GSAP:
 * gsap.to(blurFilter, { blurY: maxBlur, duration: 0.2, ease: 'power1.out' });
 * // ... позже:
 * gsap.to(blurFilter, { blurY: 0, duration: 0.3, ease: 'power2.in' });
 */

// =============================================================
// ПРИМЕР 4: Кубик (Dice Ladder) — подбрасывание + вращение
// =============================================================

/**
 * СЕЙЧАС: CSS-анимация эмодзи 🎲 (DiceLadder.tsx)
 *   <div className="dice-ladder-dice rolling">🎲</div>
 *   @keyframes roll { 100% { rotate(720deg); } }
 * 
 * ПРОБЛЕМЫ: нет подбрасывания, замедления,
 * нельзя показать грань результата
 */

/**
 * GSAP + PIXI:
 * // Простое кручение с замедлением:
 * gsap.to(diceContainer, {
 *   rotation: Math.PI * 6,
 *   duration: 1.0,
 *   ease: 'sine.out',
 * });
 * 
 * // С подбрасыванием и отскоком:
 * const tl = gsap.timeline();
 * tl.to(diceContainer, { y: '-=80', duration: 0.3, ease: 'power2.out' })
 *   .to(diceContainer, { rotation: Math.PI*6, duration: 0.7, ease: 'sine.out' }, '-=0.2')
 *   .to(diceContainer, { y: 0, duration: 0.4, ease: 'bounce.out' })
 *   .call(() => showResult(face));
 */

// =============================================================
// ПРИМЕР 5: Тряска (screen shake) при проигрыше
// =============================================================

/**
 * РУЧНАЯ (~15 строк):
 * let intensity = 10;
 * const shake = () => {
 *   container.x = (Math.random() - 0.5) * intensity;
 *   container.y = (Math.random() - 0.5) * intensity;
 *   if ((intensity *= 0.95) > 0.5) requestAnimationFrame(shake);
 *   else { container.x = 0; container.y = 0; }
 * };
 * shake();
 */

/**
 * GSAP (1 вызов):
 * gsap.to(container, {
 *   x: 'random(-10, 10)', y: 'random(-10, 10)',
 *   duration: 0.04, repeat: 20, ease: 'none',
 *   onComplete: () => { container.x = 0; container.y = 0; }
 * });
 */

// =============================================================
// ПРИМЕР 6: Полный сценарий спина (Timeline)
// =============================================================

/**
 * GSAP Timeline — цепочка анимаций в одном месте:
 * 
 * const seq = gsap.timeline();
 * 
 * // 1. Разгон blur
 * seq.to(blurFilter, { blurY: maxBlur, duration: 0.15 });
 * 
 * // 2. Вращение (остановка с stagger)
 * reels.forEach((reel, i) => {
 *   seq.to(reel, { y: targets[i], duration: 0.4 + i*0.1, ease: 'power2.inOut' }, 0);
 * });
 * 
 * // 3. Убираем blur + bounce
 * seq.to(blurFilter, { blurY: 0, duration: 0.1 })
 *    .to(reels, { y: '+=8', duration: 0.2, ease: 'bounce.out', stagger: 0.05 });
 * 
 * // 4. Подсветка выигрыша
 * seq.call(() => {
 *   gsap.to(winSprites, {
 *     scale: 1.2, duration: 0.3, ease: 'back.out(2)',
 *     stagger: 0.08, yoyo: true, repeat: 1
 *   });
 * });
 * 
 * // Итого: ~20 строк вместо ~200
 */

// =============================================================
// ВСТРОЕННЫЕ EASING В GSAP
// =============================================================

/**
 * В GSAP доступны из коробки:
 * power1/2/3/4, back, bounce, elastic, sine, circ, expo, steps
 * 
 * Самые полезные для слотов:
 * "power2.out"    — стандарт (замедление в конце) — пульсации
 * "bounce.out"    — отскок мяча — остановка барабанов
 * "back.out(2)"   — перелёт с возвратом — появление символов
 * "elastic.out"   — резинка — джекпот эффекты
 * "sine.inOut"    — плавный старт/финиш — вращение кубика
 * 
 * ВСЕ они встроены — не нужно писать easing вручную!
 */

export {};