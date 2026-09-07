import React, { useEffect, useRef, useState } from 'react';
import * as API from '../../api';
import { DiceFace, DiceLevel } from '../../types';
import Dodecahedron3D, { Dodecahedron3DHandle } from '../../components/Dodecahedron3D';

interface PlayerInfo {
  name?: string;
  avatar?: string;
}

interface DiceLadderGameProps {
  initialBalance: number;
  player?: PlayerInfo;
  onBackToLobby: () => void;
  onBalanceChange?: (balance: number) => void;
}

type Stage = 'idle' | 'playing' | 'cashout';

const FACE_META: Record<DiceFace, { emoji: string; label: string; desc: string; color: string }> = {
  coin:    { emoji: '🪙', label: 'МОНЕТА', desc: '+1 ступень', color: '#ffd700' },
  diamond: { emoji: '💎', label: 'АЛМАЗ', desc: 'На месте, бесплатно', color: '#7dd3fc' },
  fire:    { emoji: '🔥', label: 'ОГОНЬ', desc: '+2 ступени', color: '#fb923c' },
  skull:   { emoji: '💀', label: 'ЧЕРЕП', desc: '−1 ступень', color: '#ef4444' },
};

const BET_PRESETS = [100, 200, 500, 1000, 2000, 5000];

const DiceLadderGame: React.FC<DiceLadderGameProps> = ({
  initialBalance,
  player,
  onBackToLobby,
  onBalanceChange,
}) => {
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(500);
  const [stage, setStage] = useState<Stage>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [levels, setLevels] = useState<DiceLevel[]>([]);
  const [lastFace, setLastFace] = useState<DiceFace | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [finalWin, setFinalWin] = useState(0);
  const [stationPayout, setStationPayout] = useState(0);
  const [stepPayout, setStepPayout] = useState(0);
  const [betReturned, setBetReturned] = useState(0);
  const [nextCheckpoint, setNextCheckpoint] = useState(5);
  const [nextMultiplier, setNextMultiplier] = useState(4);
  const [error, setError] = useState<string | null>(null);

  const diceRef = useRef<Dodecahedron3DHandle>(null);
  const currentRowRef = useRef<HTMLDivElement>(null);

  const currentMultiplier = levels.find(l => l.level === level)?.multiplier
    ?? (level <= 0 ? 0 : level);
  const currentWin = bet * currentMultiplier;
  const busy = isRolling;

  const setBal = (b: number) => {
    setBalance(b);
    onBalanceChange?.(b);
  };

  useEffect(() => {
    document.body.classList.add('in-game');
    document.body.classList.remove('in-lobby');
    return () => {
      document.body.classList.remove('in-game');
    };
  }, []);

  const applySession = (res: any) => {
    setSessionId(res.session_id);
    setBet(res.bet ?? bet);
    setLevel(res.level);
    setLevels(res.levels || []);
    setNextCheckpoint(res.next_checkpoint ?? 5);
    setNextMultiplier(res.next_multiplier ?? 4);
    if (typeof res.balance === 'number') setBal(res.balance);
    setStage('playing');
  };

  useEffect(() => {
    let cancelled = false;
    API.getDiceGameState()
      .then((res) => {
        if (cancelled || !res?.active) return;
        applySession(res);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [level]);

  const start = async () => {
    if (busy || stage === 'playing') return;
    setError(null);
    setIsRolling(true);
    try {
      const res = await API.startDiceGame(bet);
      setLastFace(null);
      setFinalWin(0);
      setStationPayout(0);
      setStepPayout(0);
      setBetReturned(0);
      applySession(res);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось начать игру');
    } finally {
      setIsRolling(false);
    }
  };

  const roll = async () => {
    if (busy || stage !== 'playing' || !sessionId) return;
    if (balance < bet) {
      setError('Недостаточно средств на бросок');
      return;
    }
    setError(null);
    setIsRolling(true);
    setLastFace(null);
    try {
      const res = await API.rollDiceGame(sessionId);
      if (diceRef.current) {
        await diceRef.current.spinTo(res.face);
        diceRef.current.highlightFace();
      }
      setLevels(res.levels || []);
      setLevel(res.new_level);
      setLastFace(res.face);
      setBal(res.balance);
      setStationPayout(res.station_payout || 0);
      setStepPayout(res.step_payout || 0);
      setBetReturned(res.bet_returned || 0);
      setNextCheckpoint(res.next_checkpoint ?? nextCheckpoint);
      setNextMultiplier(res.next_multiplier ?? nextMultiplier);
    } catch (e: any) {
      console.error('Dice game roll failed', e);
      setError(e?.response?.data?.error || 'Ошибка броска');
    } finally {
      setIsRolling(false);
    }
  };

  const faceMeta = lastFace ? FACE_META[lastFace] : null;
  const ladder = [...levels].sort((a, b) => b.level - a.level);

  return (
    <div className="dice-game-page">
      <header className="dice-game-header">
        <button className="dice-game-back" onClick={onBackToLobby}>← Лобби</button>
        <div className="dice-game-player">
          <span>{player?.name || 'Гость'}</span>
        </div>
      </header>

      {stage === 'idle' && (
        <div className="dice-game-setup">
          <p>Каждый бросок стоит ставку. Выигрыш возвращает ставку и добавляет приз за ступень; станции дают бонус.</p>
          <div className="dice-game-bets">
            {BET_PRESETS.map(v => (
              <button
                key={v}
                className={`dice-game-bet ${bet === v ? 'active' : ''}`}
                onClick={() => setBet(v)}
              >
                {v.toLocaleString()}
              </button>
            ))}
          </div>
          {error && <p className="dice-game-error">{error}</p>}
          <button className="dice-ladder-btn roll" onClick={start} disabled={busy}>
            ИГРАТЬ · бросок {bet.toLocaleString()}
          </button>
        </div>
      )}

      {(stage === 'playing' || stage === 'cashout') && (
        <div className="dice-ladder-modal dice-game-board">
          <div className="dice-ladder-center">
            <div className="dice-ladder-3d-wrapper dice-dragon-frame">
              <div className="dice-mystic-mist" aria-hidden="true" />
              <Dodecahedron3D ref={diceRef} size={200} />
            </div>
            <div className="dice-ladder-current dice-ladder-current-under">
              <span>До станции {nextCheckpoint}:</span>
              <span className="dice-ladder-current-amount">
                ×{nextMultiplier} = {(bet * nextMultiplier).toLocaleString()}
              </span>
              {(stepPayout > 0 || stationPayout > 0 || betReturned > 0) && (
                <span className="dice-ladder-current-amount">
                  {[
                    stationPayout > 0 ? `Станция +${stationPayout.toLocaleString()}` : null,
                    stepPayout > 0 ? `Ступень +${stepPayout.toLocaleString()}` : null,
                    betReturned > 0 ? `Ставка +${betReturned.toLocaleString()}` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
              <span className="dice-game-balance dice-ladder-current-balance">
                💰 {balance.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="dice-ladder-result-block">
            {faceMeta && (
              <div className="dice-ladder-face" style={{ borderColor: faceMeta.color }}>
                <span className="dice-ladder-face-emoji">{faceMeta.emoji}</span>
                <span className="dice-ladder-face-label" style={{ color: faceMeta.color }}>
                  {faceMeta.label}
                </span>
                <span className="dice-ladder-face-desc">{faceMeta.desc}</span>
              </div>
            )}
          </div>
          <div className="dice-ladder-steps">
            {ladder.map(lvl => {
              const isCurrent = lvl.level === level;
              const isPassed = lvl.level < level;
              const isCp = (lvl as any).checkpoint || (lvl.multiplier > 0);
              return (
                <div
                  key={lvl.level}
                  ref={isCurrent ? currentRowRef : null}
                  className={`dice-ladder-row ${isCurrent ? 'current' : ''} ${isPassed ? 'passed' : ''} ${isCp ? 'checkpoint' : ''}`}
                >
                  <span className="dice-ladder-mult">
                    {isCp ? `🏦 ×${lvl.multiplier}` : `#${lvl.level}`}
                  </span>
                  <span className="dice-ladder-amount">
                    {isCp ? bet * lvl.multiplier : Math.floor(bet * 0.4)}
                  </span>
                  {isCurrent && <span className="dice-ladder-marker">◄</span>}
                </div>
              );
            })}
            <div className={`dice-ladder-row start-row ${level === 0 ? 'current' : ''}`}>СТАРТ</div>
          </div>
          {stage === 'playing' && (
            <>
              <div className="dice-ladder-actions">
                <button className="dice-ladder-btn roll" onClick={roll} disabled={busy}>
                  {isRolling ? '🎲 ...' : `🎲 БРОСИТЬ · ${bet.toLocaleString()}`}
                </button>
              </div>
              {error && <p className="dice-game-error">{error}</p>}
              <p className="dice-ladder-hint">
                Каждый бросок списывает {bet.toLocaleString()}, кроме алмаза. Выигрыш возвращает ставку + приз ступени, станция — бонус. Череп сжигает ставку.
              </p>
            </>
          )}
          {stage !== 'playing' && (
            <div className="dice-ladder-result">
              {stage === 'cashout' && (
                <>
                  <div className="dice-ladder-result-emoji">💰</div>
                  <h3>ВЫ ЗАБРАЛИ ВЫИГРЫШ!</h3>
                  <p className="dice-ladder-result-win">{finalWin.toLocaleString()}</p>
                </>
              )}
              <button className="dice-ladder-btn close" onClick={() => setStage('idle')}>ЕЩЁ РАЗ</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiceLadderGame;

