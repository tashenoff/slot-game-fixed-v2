import { useEffect, useRef, useState } from 'react';

/**
 * Hook для анимированного счёта чисел от текущего значения до target.
 * Использует easeOutCubic для плавного замедления к концу.
 *
 * @param target - конечное значение, к которому анимируем
 * @param duration - длительность анимации в мс (по умолчанию 800)
 * @returns текущее анимированное значение
 */
export function useAnimatedNumber(target: number, duration: number = 800): number {
  const [current, setCurrent] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    // Если цель 0 — показываем сразу без анимации
    if (target === 0) {
      startValueRef.current = 0;
      setCurrent(0);
      return;
    }

    // Отменяем предыдущую анимацию, если была
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const startValue = startValueRef.current;
    const startTime = performance.now();
    const difference = target - startValue;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // EaseOutCubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(startValue + difference * eased);

      setCurrent(value);
      startValueRef.current = value;

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [target, duration]);

  return current;
}