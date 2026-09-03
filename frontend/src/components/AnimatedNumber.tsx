import React, { useLayoutEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  prefix?: string;
}

/**
 * Анимированный счётчик от 0 до указанного value
 * Переиспользуется в WinModal и уведомлении о завершении фриспинов
 */
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration: customDuration,
  className,
  style,
  prefix = '+',
}) => {
  const displayRef = useRef<HTMLSpanElement>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useLayoutEffect(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    if (displayRef.current) {
      const target = value;
      const duration = customDuration ?? Math.min(6, Math.max(3, target / 10000));
      startTimeRef.current = performance.now();

      displayRef.current.textContent = prefix + '0';

      const animate = (now: number) => {
        const elapsed = (now - startTimeRef.current) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 2.5);
        const current = Math.round(target * eased);

        if (displayRef.current) {
          displayRef.current.textContent = prefix + current.toLocaleString();
        }

        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          if (displayRef.current) {
            displayRef.current.textContent = prefix + target.toLocaleString();
          }
          animRef.current = null;
        }
      };

      animRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [value, customDuration, prefix]);

  return (
    <span ref={displayRef} className={className} style={style}>
      {prefix}{value.toLocaleString()}
    </span>
  );
};

export default AnimatedNumber;