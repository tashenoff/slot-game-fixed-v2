import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as API from '../api';
import { DiceFace, DiceLevel } from '../types';
import Dodecahedron3D, { Dodecahedron3DHandle } from './Dodecahedron3D';

interface DiceLadderProps {
  bet: number;
  balance: number;
  levels: DiceLevel[];
  onClose: (result: { win: number; balance: number }) => void;
}

type LadderStage = 'playing' | 'cashout' | 'skull' | 'top';

const FACE_META: Record<DiceFace, { emoji: string; label: string; desc: string; color: string }> = {
  coin:    { emoji: '🪙', label: 'МОНЕТА', desc: '+1 ступень', color: '#ffd700' },
  diamond: { emoji: '💎', label: 'АЛМАЗ', desc: 'Безопасный шаг', color: '#7dd3fc' },
  fire:    { emoji: '🔥', label: 'ОГОНЬ', desc: '+2 ступени', color: '#fb923c' },
  skull:   { emoji: '💀', label: 'ЧЕРЕП', desc: 'Всё сгорело!', color: '#ef4444' },
};

const DiceLadder: React.FC<DiceLadderProps> = ({ bet, balance, levels, onClose }) => {
  const [level, setLevel] = useState<number>(0);
  const [stage, setStage] = useState<LadderStage>('playing');
  const [lastFace, setLastFace] = useState<DiceFace | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [finalWin, setFinalWin] = useState<number>(0);
  const [currentBalance, setCurrentBalance] = useState<number>(balance);
  const [serverLevels, setServerLevels] = useState<DiceLevel[]>(levels);
  
  const diceRef = useRef<Dodecahedron3DHandle>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<HTMLDivElement>(null);

  const currentMultiplier = serverLevels.find(l => l.level === level)?.multiplier ?? 0;
  const currentWin = bet * currentMultiplier;
  const busy = isRolling || isResolving;

  const roll = async () => {
    if (busy || stage !== 'playing') return;
    setIsRolling(true);
    setLastFace(null);
    try {
      // Получаем результат с сервера
      const res = await API.rollDice(bet, level);
      
      // Запускаем 3D анимацию броска додекаэдра
      if (diceRef.current) {
        await diceRef.current.spinTo(res.face);
        diceRef.current.highlightFace();
      }
      
      // Обновляем состояние ПОСЛЕ завершения анимации
      // чтобы избежать дёргания интерфейса
      setIsRolling(false);
      setServerLevels(res.levels);
      setLevel(res.new_level);
      setLastFace(res.face);
      setCurrentBalance(res.balance);
      
      if (res.game_over) {
        setIsResolving(true);
        await new Promise(r => setTimeout(r, 800));
        setIsResolving(false);
        if (res.reached_top) {
          setFinalWin(res.win_amount);
          setStage('top');
        } else if (res.face === 'skull') {
          setFinalWin(0);
          setStage('skull');
        }
      }
    } catch (e) {
      console.error('DiceLadder: roll failed', e);
      setIsRolling(false);
      setIsResolving(false);
    }
  };

  const cashOut = async () => {
    if (busy || stage !== 'playing' || level <= 0) return;
    setIsRolling(true);
    try {
      const res = await API.cashoutDice(bet, level);
      setFinalWin(res.win_amount);
      setCurrentBalance(res.balance);
      setStage('cashout');
    } catch (e) {
      console.error('DiceLadder: cashout failed', e);
    } finally {
      setIsRolling(false);
    }
  };

  const close = () => onClose({ win: finalWin, balance: currentBalance });
  const faceMeta = lastFace ? FACE_META[lastFace] : null;
  const ladder = [...serverLevels].sort((a, b) => b.level - a.level);

  // Автоскролл к текущему уровню при изменении level
  useEffect(() => {
    if (currentRowRef.current && stepsRef.current) {
      currentRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [level]);

  const isCurrentOrAbove = (lvlLevel: number) => lvlLevel <= level;

  // Используем Portal чтобы рендерить модалку в body (поверх всего)
  return createPortal(
    <div className="dice-ladder-overlay">
      <div className="dice-ladder-modal">
        {/* Верхняя строка: заголовок + текущий выигрыш */}
        <div className="dice-ladder-topbar">
          <h2 className="dice-ladder-title">🎲 ЛЕСТНИЦА УДАЧИ</h2>
          <div className="dice-ladder-current">
            <span>Текущий выигрыш:</span>
            <span className="dice-ladder-current-amount">
              ×{currentMultiplier} = {currentWin.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Кубик по центру */}
        <div className="dice-ladder-center">
          <div className="dice-ladder-3d-wrapper">
            <Dodecahedron3D ref={diceRef} size={200} />
          </div>
        </div>

        {/* Блок результата под кубиком */}
        <div className="dice-ladder-result-block">
          {faceMeta ? (
            <div className="dice-ladder-face" style={{ borderColor: faceMeta.color }}>
              <span className="dice-ladder-face-emoji">{faceMeta.emoji}</span>
              <span className="dice-ladder-face-label" style={{ color: faceMeta.color }}>
                {faceMeta.label}
              </span>
              <span className="dice-ladder-face-desc">{faceMeta.desc}</span>
            </div>
          ) : (
            <div className="dice-ladder-face-placeholder">
              {isRolling ? '🎲 Бросаем...' : 'Нажмите БРОСИТЬ'}
            </div>
          )}
        </div>

        {/* Список всех шагов одной колонкой */}
        <div className="dice-ladder-steps" ref={stepsRef}>
          {ladder.map(lvl => {
            const isCurrent = lvl.level === level;
            const isPassed = lvl.level < level;
            return (
              <div 
                key={lvl.level} 
                ref={isCurrent ? currentRowRef : null}
                className={`dice-ladder-row ${isCurrent ? 'current' : ''} ${isPassed ? 'passed' : ''}`}
              >
                <span className="dice-ladder-mult">×{lvl.multiplier}</span>
                <span className="dice-ladder-amount">{bet * lvl.multiplier}</span>
                {isCurrent && <span className="dice-ladder-marker">◄</span>}
              </div>
            );
          })}
          <div className="dice-ladder-row start-row">СТАРТ</div>
        </div>

        {/* Кнопки под списком */}
        {stage === 'playing' && (
          <div className="dice-ladder-actions">
            <button className="dice-ladder-btn roll" onClick={roll} disabled={busy}>
              {isRolling ? '🎲 ...' : '🎲 БРОСИТЬ'}
            </button>
            <button className="dice-ladder-btn cash" onClick={cashOut} disabled={busy || level <= 0}>
              💰 ЗАБРАТЬ ×{currentMultiplier}
            </button>
          </div>
        )}
        <p className="dice-ladder-hint">💀 Череп — выигрыш сгорает</p>

        {stage !== 'playing' && (
          <div className="dice-ladder-result">
            {stage === 'cashout' && (
              <>
                <div className="dice-ladder-result-emoji">💰</div>
                <h3>ВЫ ЗАБРАЛИ ВЫИГРЫШ!</h3>
                <p className="dice-ladder-result-win">{finalWin.toLocaleString()}</p>
                <button className="dice-ladder-btn close" onClick={close}>ЗАКРЫТЬ</button>
              </>
            )}
            {stage === 'top' && (
              <>
                <div className="dice-ladder-result-emoji">👑</div>
                <h3>ВЕРШИНА ЛЕСТНИЦЫ!</h3>
                <p className="dice-ladder-result-win">{finalWin.toLocaleString()}</p>
                <button className="dice-ladder-btn close" onClick={close}>ЗАКРЫТЬ</button>
              </>
            )}
            {stage === 'skull' && (
              <>
                <div className="dice-ladder-result-emoji">💀</div>
                <h3>ПРОИГРЫШ!</h3>
                <p className="dice-ladder-result-lose">Весь выигрыш сгорел</p>
                <button className="dice-ladder-btn close" onClick={close}>ЗАКРЫТЬ</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body // Рендерим в body, чтобы быть поверх всего
  );
};

export default DiceLadder;
