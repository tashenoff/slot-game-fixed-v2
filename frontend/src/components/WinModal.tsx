import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Уровни выигрышей на основе множителя (win / bet)
 */
export type WinLevel = 'normal' | 'big' | 'mega' | 'super' | 'legendary';

export interface WinLevelConfig {
  level: WinLevel;
  /** Минимальный множитель для этого уровня (включительно) */
  minMultiplier: number;
  /** Название уровня */
  label: string;
  /** Основной цвет */
  color: string;
  /** Вторичный цвет (для градиента) */
  secondaryColor: string;
  /** Иконка-эмодзи */
  icon: string;
  /** Заголовок модалки */
  title: string;
}

/** Конфигурация всех уровней */
export const WIN_LEVELS: WinLevelConfig[] = [
  { level: 'normal',    minMultiplier: 0,    label: 'ОБЫЧНЫЙ',     color: '#94a3b8', secondaryColor: '#64748b', icon: '🎉',  title: 'ВЫИГРЫШ' },
  { level: 'big',       minMultiplier: 5,    label: 'БОЛЬШОЙ',     color: '#2979FF', secondaryColor: '#1565C0', icon: '🔥',  title: 'БОЛЬШОЙ ВЫИГРЫШ!' },
  { level: 'mega',      minMultiplier: 10,   label: 'МЕГА',        color: '#7C4DFF', secondaryColor: '#651FFF', icon: '💎',  title: 'МЕГА ВЫИГРЫШ!!' },
  { level: 'super',     minMultiplier: 25,   label: 'СУПЕР',       color: '#FF1744', secondaryColor: '#D50000', icon: '👑',  title: 'СУПЕР ВЫИГРЫШ!!!' },
  { level: 'legendary', minMultiplier: 100,  label: 'ЛЕГЕНДАРНЫЙ',  color: '#FFD700', secondaryColor: '#FF8F00', icon: '🏆',  title: 'ЛЕГЕНДАРНЫЙ ВЫИГРЫШ!!!!' },
];

/**
 * Определить уровень выигрыша по множителю
 */
export function getWinLevelByMultiplier(multiplier: number): WinLevelConfig {
  for (let i = WIN_LEVELS.length - 1; i >= 0; i--) {
    if (multiplier >= WIN_LEVELS[i].minMultiplier) {
      return WIN_LEVELS[i];
    }
  }
  return WIN_LEVELS[0];
}

interface WinModalProps {
  isOpen: boolean;
  totalWin: number;
  bet: number;
  onCollect: () => void;
  winningSymbols?: { symbol: string; count: number; amount: number }[];
}

const WinModal: React.FC<WinModalProps> = ({
  isOpen,
  totalWin,
  bet,
  onCollect,
  winningSymbols,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const particlesContainerRef = useRef<HTMLDivElement>(null);
  const [displayAmount, setDisplayAmount] = useState(0);
  const animTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const countAnimRef = useRef<gsap.core.Tween | null>(null);
  const isFirstMount = useRef(true);

  const multiplier = bet > 0 ? totalWin / bet : 0;
  const level = getWinLevelByMultiplier(multiplier);
  const isSignificant = level.level !== 'normal';

  useLayoutEffect(() => {
    if (!isOpen) {
      setDisplayAmount(0);
      return;
    }

    setDisplayAmount(0);

    if (animTimelineRef.current) animTimelineRef.current.kill();
    if (countAnimRef.current) countAnimRef.current.kill();

    const tl = gsap.timeline();

    if (overlayRef.current) {
      gsap.set(overlayRef.current, { display: 'flex', opacity: 0 });
      tl.to(overlayRef.current, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0);
    }

    if (modalRef.current) {
      gsap.set(modalRef.current, { scale: 0.3, opacity: 0, y: 50 });
      tl.to(
        modalRef.current,
        { scale: 1, opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.7)' },
        '-=0.1'
      );
    }

    if (titleRef.current) {
      gsap.set(titleRef.current, { y: -20, opacity: 0 });
      tl.to(titleRef.current, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }, '-=0.3');
    }

    if (amountRef.current) {
      gsap.set(amountRef.current, { scale: 0, opacity: 0 });
      tl.to(amountRef.current, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(3)' }, '-=0.2');
    }

    if (particlesContainerRef.current && isSignificant) {
      gsap.set(particlesContainerRef.current, { opacity: 0 });
      tl.to(particlesContainerRef.current, { opacity: 1, duration: 0.4 }, '-=0.3');
    }

    animTimelineRef.current = tl;

    const duration = Math.min(2, Math.max(0.6, totalWin / 30000));
    countAnimRef.current = gsap.to(
      { val: 0 },
      {
        val: totalWin,
        duration,
        ease: 'power2.out',
        onUpdate: function () {
          setDisplayAmount(Math.round(this.targets()[0].val));
        },
      }
    );

    return () => {
      if (animTimelineRef.current) animTimelineRef.current.kill();
      if (countAnimRef.current) countAnimRef.current.kill();
    };
  }, [isOpen, totalWin, bet, isSignificant]);

  const handleCollect = useCallback(() => {
    if (animTimelineRef.current) animTimelineRef.current.kill();
    if (countAnimRef.current) countAnimRef.current.kill();

    if (overlayRef.current && modalRef.current) {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.2,
        onComplete: () => { onCollect(); },
      });
      gsap.to(modalRef.current, {
        scale: 0.8,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
      });
    } else {
      onCollect();
    }
  }, [onCollect]);

  const renderParticles = () => {
    if (!isSignificant) return null;
    const particles: React.ReactNode[] = [];
    const colors = [level.color, level.secondaryColor, '#ffffff', '#ffd700'];
    
    for (let i = 0; i < 24; i++) {
      const size = 3 + Math.random() * 8;
      const x = 20 + Math.random() * 60;
      const startY = 50 + Math.random() * 40;
      const color = colors[i % colors.length];
      const delay = Math.random() * 1;
      const duration = 1.5 + Math.random() * 2;
      const driftX = (Math.random() - 0.5) * 60;

      particles.push(
        <div
          key={i}
          className="win-modal-particle"
          style={{
            left: `${x}%`,
            top: `${startY}%`,
            width: size,
            height: size,
            background: color,
            boxShadow: `0 0 ${size * 2}px ${color}`,
            ['--drift-x' as string]: `${driftX}px`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
          }}
        />
      );
    }
    
    return particles;
  };

  return (
    <div className="win-modal-overlay" ref={overlayRef} style={{ display: 'none' }}>
      {isSignificant && (
        <div className="win-modal-particles" ref={particlesContainerRef}>
          {renderParticles()}
        </div>
      )}

      <div className="win-modal-container" ref={modalRef}>
        <div
          className="win-modal-border"
          style={{
            background: `linear-gradient(135deg, ${level.color}, ${level.secondaryColor}, ${level.color})`,
          }}
        />

        <div
          className="win-modal-icon"
          style={{
            background: `linear-gradient(135deg, ${level.color}, ${level.secondaryColor})`,
            boxShadow: `0 0 20px ${level.color}66`,
          }}
        >
          <span>{level.icon}</span>
        </div>

        <h2
          className="win-modal-title"
          ref={titleRef}
          style={{ color: level.color, textShadow: `0 0 20px ${level.color}44` }}
        >
          {level.title}
        </h2>

        <div className="win-modal-amount" ref={amountRef}>
          <span className="win-modal-amount-value" style={{ color: level.color }}>
            +{displayAmount.toLocaleString()}
          </span>
          <span className="win-modal-amount-currency">◎</span>
        </div>

        {isSignificant && (
          <div className="win-modal-multiplier">
            x{multiplier.toFixed(1)} от ставки
          </div>
        )}

        {winningSymbols && winningSymbols.length > 0 && (
          <div className="win-modal-symbols">
            {winningSymbols.map((ws, i) => (
              <div key={i} className="win-modal-symbol-item">
                <span className="win-modal-symbol-name">{ws.symbol}</span>
                <span className="win-modal-symbol-count">x{ws.count}</span>
                <span className="win-modal-symbol-amount">+{ws.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <button
          className="win-modal-collect-btn"
          onClick={handleCollect}
          style={{
            background: `linear-gradient(135deg, ${level.color}, ${level.secondaryColor})`,
            boxShadow: `0 4px 15px ${level.color}66`,
          }}
        >
          {isSignificant ? 'ЗАБРАТЬ ВЫИГРЫШ' : 'ПРОДОЛЖИТЬ'}
        </button>
      </div>
    </div>
  );
};

export default WinModal;
export type { WinModalProps };
