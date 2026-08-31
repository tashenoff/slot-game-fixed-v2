import React, { useState, useRef, useCallback, useEffect } from 'react';
import gsap from 'gsap';
import * as API from '../api';
import { DiceFace, DiceLevel } from '../types';

interface DiceLadderProps {
  bet: number;
  balance: number;
  levels: DiceLevel[];
  onClose: (result: { win: number; balance: number }) => void;
}

type LadderStage = 'playing' | 'cashout' | 'skull' | 'top';

const FACE_META: Record<DiceFace, { emoji: string; label: string; desc: string; color: string }> = {
  coin:    { emoji: '\u{1FA99}', label: '\u041C\u041E\u041D\u0415\u0422\u0410', desc: '+1 \u0441\u0442\u0443\u043F\u0435\u043D\u044C', color: '#ffd700' },
  diamond: { emoji: '\u{1F48E}', label: '\u0410\u041B\u041C\u0410\u0417', desc: '\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u044B\u0439 \u0448\u0430\u0433', color: '#7dd3fc' },
  fire:    { emoji: '\u{1F525}', label: '\u041E\u0413\u041E\u041D\u042C', desc: '+2 \u0441\u0442\u0443\u043F\u0435\u043D\u0438', color: '#fb923c' },
  skull:   { emoji: '\u{1F480}', label: '\u0427\u0415\u0420\u0415\u041F', desc: '\u0412\u0441\u0451 \u0441\u0433\u043E\u0440\u0435\u043B\u043E!', color: '#ef4444' },
};
