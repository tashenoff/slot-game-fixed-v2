import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { DiceFace } from '../types';

// Маппинг граней додекаэдра к символам (по 3 грани на символ)
const FACE_TO_SYMBOL: DiceFace[] = [
  'coin', 'diamond', 'fire', 'skull',
  'coin', 'diamond', 'fire', 'skull',
  'coin', 'diamond', 'fire', 'skull',
];

// Метаданные символов
const SYMBOL_DATA: Record<DiceFace, { bgColor: string; activeColor: string; inactiveColor: string }> = {
  coin:    { bgColor: '#5C3D2E', activeColor: '#ffd700', inactiveColor: '#3E2723' },
  diamond: { bgColor: '#A0764A', activeColor: '#ffd700', inactiveColor: '#3E2723' },
  fire:    { bgColor: '#5C3D2E', activeColor: '#ffd700', inactiveColor: '#3E2723' },
  skull:   { bgColor: '#A0764A', activeColor: '#ffd700', inactiveColor: '#3E2723' },
};

// Создание кастомной геометрии додекаэдра с правильными группами материалов
function createDodecahedronWithGroups(radius: number): THREE.BufferGeometry {
  const t = (1 + Math.sqrt(5)) / 2; // золотое сечение φ ≈ 1.618
  const r = 1 / t;                   // 1/φ ≈ 0.618

  // 20 вершин додекаэдра (нормализованные)
  const rawVerts: [number, number, number][] = [
    // (±1, ±1, ±1)
    [ 1,  1,  1], [ 1,  1, -1], [ 1, -1,  1], [ 1, -1, -1],
    [-1,  1,  1], [-1,  1, -1], [-1, -1,  1], [-1, -1, -1],
    // (0, ±1/φ, ±φ)
    [0,  r,  t], [0,  r, -t], [0, -r,  t], [0, -r, -t],
    // (±1/φ, ±φ, 0)
    [ r,  t, 0], [-r,  t, 0], [ r, -t, 0], [-r, -t, 0],
    // (±φ, 0, ±1/φ)
    [ t, 0,  r], [ t, 0, -r], [-t, 0,  r], [-t, 0, -r],
  ];

  // Нормализуем вершины на единичную сферу и масштабируем
  const vertices = rawVerts.map(v => {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len * radius, v[1]/len * radius, v[2]/len * radius] as [number, number, number];
  });

  // 12 пятиугольных граней (индексы вершин против часовой стрелки для правильных нормалей)
  const faces: number[][] = [
    [0, 8, 10, 2, 16],  // front-ish
    [0, 16, 17, 1, 12],
    [0, 12, 13, 4, 8],
    [1, 17, 3, 11, 9],
    [1, 9, 5, 13, 12],
    [2, 10, 6, 15, 14],
    [2, 14, 3, 17, 16],
    [3, 14, 15, 7, 11],
    [4, 13, 5, 19, 18],
    [4, 18, 6, 10, 8],
    [5, 9, 11, 7, 19],
    [6, 18, 19, 7, 15],
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const groups: { start: number; count: number; materialIndex: number }[] = [];

  // Генерируем треугольники для каждой грани
  faces.forEach((face, faceIndex) => {
    const startIndex = positions.length / 3;
    
    // Центр пятиугольника
    const center = new THREE.Vector3();
    face.forEach(vi => {
      const v = vertices[vi];
      center.add(new THREE.Vector3(v[0], v[1], v[2]));
    });
    center.divideScalar(5);

    // Нормаль грани
    const v0 = new THREE.Vector3(...vertices[face[0]] as [number, number, number]);
    const v1 = new THREE.Vector3(...vertices[face[1]] as [number, number, number]);
    const v2 = new THREE.Vector3(...vertices[face[2]] as [number, number, number]);
    const normal = new THREE.Vector3()
      .subVectors(v1, v0)
      .cross(new THREE.Vector3().subVectors(v2, v0))
      .normalize();

    // UV координаты для пятиугольника
    const uvCenter = [0.5, 0.5];
    const uvRadius = 0.45;

    // Разбиваем пятиугольник на 5 треугольников (веер из центра)
    for (let i = 0; i < 5; i++) {
      const i0 = face[i];
      const i1 = face[(i + 1) % 5];

      const p0 = vertices[i0];
      const p1 = vertices[i1];

      // Добавляем 3 вершины треугольника: центр, p0, p1
      // Вершины уже масштабированы в vertices
      positions.push(center.x, center.y, center.z);
      positions.push(p0[0], p0[1], p0[2]);
      positions.push(p1[0], p1[1], p1[2]);

      // Нормали
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);

      // UV координаты
      // Примечание: В UV-пространстве Y=1 это верх текстуры, Y=0 это низ
      // В Canvas Y=0 это верх, Y=height это низ
      // Поэтому инвертируем знак sin для V-координаты
      const angle0 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const angle1 = ((i + 1) * 2 * Math.PI) / 5 - Math.PI / 2;

      uvs.push(uvCenter[0], uvCenter[1]);
      uvs.push(uvCenter[0] + uvRadius * Math.cos(angle0), uvCenter[1] - uvRadius * Math.sin(angle0));
      uvs.push(uvCenter[0] + uvRadius * Math.cos(angle1), uvCenter[1] - uvRadius * Math.sin(angle1));
    }

    // Группа материала для этой грани (5 треугольников = 15 вершин)
    groups.push({
      start: startIndex,
      count: 15,
      materialIndex: faceIndex,
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  groups.forEach(g => geometry.addGroup(g.start, g.count, g.materialIndex));

  return geometry;
}

// Вычисление ориентации для каждой грани додекаэдра
// Поворачиваем так, чтобы:
// 1. Грань смотрела прямо на камеру (нормаль -> +Z)
// 2. Вершина пятиугольника (первая вершина грани) была сверху (локальный up -> мировой +Y)
function calculateFaceRotations(): { x: number; y: number; z: number }[] {
  const t = (1 + Math.sqrt(5)) / 2; // золотое сечение φ
  const r = 1 / t;

  // Вершины додекаэдра (те же, что и в createDodecahedronWithGroups)
  const rawVerts: [number, number, number][] = [
    [ 1,  1,  1], [ 1,  1, -1], [ 1, -1,  1], [ 1, -1, -1],
    [-1,  1,  1], [-1,  1, -1], [-1, -1,  1], [-1, -1, -1],
    [0,  r,  t], [0,  r, -t], [0, -r,  t], [0, -r, -t],
    [ r,  t, 0], [-r,  t, 0], [ r, -t, 0], [-r, -t, 0],
    [ t, 0,  r], [ t, 0, -r], [-t, 0,  r], [-t, 0, -r],
  ];

  // Нормализуем вершины
  const vertices = rawVerts.map(v => {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return new THREE.Vector3(v[0]/len, v[1]/len, v[2]/len);
  });

  // Те же грани, что и в createDodecahedronWithGroups
  const faces: number[][] = [
    [0, 8, 10, 2, 16],
    [0, 16, 17, 1, 12],
    [0, 12, 13, 4, 8],
    [1, 17, 3, 11, 9],
    [1, 9, 5, 13, 12],
    [2, 10, 6, 15, 14],
    [2, 14, 3, 17, 16],
    [3, 14, 15, 7, 11],
    [4, 13, 5, 19, 18],
    [4, 18, 6, 10, 8],
    [5, 9, 11, 7, 19],
    [6, 18, 19, 7, 15],
  ];

  const rotations: { x: number; y: number; z: number }[] = [];
  const targetDir = new THREE.Vector3(0, 0, 1); // камера смотрит по +Z
  const worldUp = new THREE.Vector3(0, 1, 0);   // "вверх" в мировых координатах

  faces.forEach(face => {
    // Вычисляем центр грани = нормаль грани (для выпуклого додекаэдра)
    const faceNormal = new THREE.Vector3();
    face.forEach(vi => faceNormal.add(vertices[vi]));
    faceNormal.divideScalar(5).normalize();

    // Первая вершина грани = вершина пятиугольника на текстуре (верх)
    const topVertex = vertices[face[0]].clone();
    
    // Вектор "вверх" на грани = направление от центра грани к первой вершине
    // Проецируем на плоскость грани (убираем компоненту вдоль нормали)
    const faceUpDir = topVertex.clone()
      .sub(faceNormal.clone().multiplyScalar(topVertex.dot(faceNormal)))
      .normalize();

    // Шаг 1: Поворачиваем так, чтобы нормаль грани стала смотреть на камеру (+Z)
    const q1 = new THREE.Quaternion().setFromUnitVectors(faceNormal, targetDir);
    
    // Шаг 2: После q1 вектор faceUpDir повернётся. Вычисляем куда
    const rotatedUp = faceUpDir.clone().applyQuaternion(q1);
    
    // rotatedUp теперь лежит в плоскости XY (Z≈0). 
    // Нужно повернуть вокруг Z так, чтобы он совпал с worldUp (+Y)
    // Угол = arctan2(x, y) - угол отклонения от +Y
    const correctionAngle = -Math.atan2(rotatedUp.x, rotatedUp.y);
    
    // Создаём корректирующий кватернион (поворот вокруг Z)
    const q2 = new THREE.Quaternion().setFromAxisAngle(targetDir, correctionAngle);
    
    // Комбинируем: сначала q1, потом q2
    const finalQ = q2.clone().multiply(q1);
    
    const euler = new THREE.Euler().setFromQuaternion(finalQ, 'XYZ');
    rotations.push({ x: euler.x, y: euler.y, z: euler.z });
  });

  return rotations;
}

const faceRotations = calculateFaceRotations();

export interface Dodecahedron3DHandle {
  spinTo: (face: DiceFace) => Promise<void>;
  startIdleAnimation: () => void;
  stopIdleAnimation: () => void;
  highlightFace: () => void;
}

interface Dodecahedron3DProps {
  size?: number;
  onSpinComplete?: () => void;
}

const Dodecahedron3D = forwardRef<Dodecahedron3DHandle, Dodecahedron3DProps>(
  ({ size = 160, onSpinComplete }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
    const svgImagesRef = useRef<Record<DiceFace, { inactive: HTMLImageElement | null; gold: HTMLImageElement | null }>>({
      coin: { inactive: null, gold: null },
      diamond: { inactive: null, gold: null },
      fire: { inactive: null, gold: null },
      skull: { inactive: null, gold: null },
    });
    const animationFrameRef = useRef<number>(0);
    const idleAnimationRef = useRef<gsap.core.Tween | null>(null);
    const isSpinningRef = useRef<boolean>(false);
    const lastFaceIndexRef = useRef<number>(0);

    // Рисует fallback-иконку, пока SVG не загрузился
    const drawFallbackIcon = (ctx: CanvasRenderingContext2D, symbol: DiceFace, w: number, h: number, isActive: boolean) => {
      const cx = w / 2, cy = h / 2, s = Math.min(w, h);
      const color = isActive ? SYMBOL_DATA[symbol].activeColor : SYMBOL_DATA[symbol].inactiveColor;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = s * 0.06;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (symbol) {
        case 'coin': {
          const r1 = s * 0.28;
          const r2 = s * 0.18;
          ctx.beginPath(); ctx.arc(cx, cy, r1, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'diamond': {
          const hw = s * 0.3, hh = s * 0.42;
          ctx.beginPath();
          ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy);
          ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy);
          ctx.closePath(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - hw, cy); ctx.lineTo(cx + hw, cy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, cy - hh); ctx.lineTo(cx, cy); ctx.stroke();
          break;
        }
        case 'fire': {
          const bh = s * 0.42, bw = s * 0.22;
          ctx.beginPath();
          ctx.moveTo(cx, cy + bh);
          ctx.bezierCurveTo(cx + bw, cy + bh * 0.4, cx + bw * 1.2, cy - bh * 0.3, cx, cy - bh * 1.0);
          ctx.bezierCurveTo(cx - bw * 1.2, cy - bh * 0.3, cx - bw, cy + bh * 0.4, cx, cy + bh);
          ctx.closePath(); ctx.stroke();
          break;
        }
        case 'skull': {
          const r = s * 0.28;
          ctx.beginPath(); ctx.arc(cx, cy - r * 0.15, r, Math.PI * 1.15, Math.PI * -0.15); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx - r * 0.55, cy + r * 0.2, r * 0.35, 0, Math.PI * 0.7); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx + r * 0.55, cy + r * 0.2, r * 0.35, Math.PI * 0.3, Math.PI); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy + r * 0.65, r * 0.45, 0, Math.PI); ctx.stroke();
          const eyeR = r * 0.18;
          ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.1, eyeR, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx + r * 0.35, cy - r * 0.1, eyeR, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.1); ctx.lineTo(cx - r * 0.08, cy + r * 0.22);
          ctx.lineTo(cx + r * 0.08, cy + r * 0.22); ctx.closePath(); ctx.stroke();
          break;
        }
      }
    };

    // Создание текстуры для грани — рисует SVG на canvas (или fallback)
    const createFaceTexture = useCallback((symbol: DiceFace, active: boolean = false): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      const data = SYMBOL_DATA[symbol];

      // Фон
      ctx.fillStyle = data.bgColor;
      ctx.fillRect(0, 0, 512, 512);

      // Рисуем SVG (если уже загружен) или fallback
      const images = svgImagesRef.current[symbol];
      const svgImg = active ? images.gold : images.inactive;
      if (svgImg) {
        const size = 512 * 0.5;
        const offset = (512 - size) / 2;
        ctx.drawImage(svgImg, offset, offset, size, size);
      } else {
        // Fallback — показываем иконку сразу, без ожидания SVG
        drawFallbackIcon(ctx, symbol, 512, 512, active);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.flipY = false;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.anisotropy = 16;
      texture.needsUpdate = true;
      return texture;
    }, []);

    // Idle анимация (медленное вращение)
    const startIdleAnimation = useCallback(() => {
      if (!meshRef.current || isSpinningRef.current) return;
      if (idleAnimationRef.current) idleAnimationRef.current.kill();
      idleAnimationRef.current = gsap.to(meshRef.current.rotation, {
        y: meshRef.current.rotation.y + Math.PI * 2,
        x: meshRef.current.rotation.x + Math.PI * 0.5,
        duration: 8, ease: 'none', repeat: -1,
      });
    }, []);

    const stopIdleAnimation = useCallback(() => {
      if (idleAnimationRef.current) {
        idleAnimationRef.current.kill();
        idleAnimationRef.current = null;
      }
    }, []);

// Анимация броска к определённой грани
    // Подсветка выпавшего символа: только одна грань — золотая, все остальные — коричневые
    const highlightFace = useCallback((): void => {
      const mats = materialsRef.current;
      if (!mats.length) return;
      const targetIndex = lastFaceIndexRef.current;
      for (let i = 0; i < 12; i++) {
        const symbol = FACE_TO_SYMBOL[i];
        const isTarget = i === targetIndex;
        const newTex = createFaceTexture(symbol, isTarget);
        const oldTex = mats[i].map;
        mats[i].map = newTex;
        mats[i].needsUpdate = true;
        if (oldTex && oldTex !== newTex) oldTex.dispose();
      }
    }, [createFaceTexture]);

    // Анимация броска к определённой грани
    const spinTo = useCallback(async (targetFace: DiceFace): Promise<void> => {
      if (!meshRef.current) return;
      isSpinningRef.current = true;
      stopIdleAnimation();
      const mesh = meshRef.current;

      // Сбрасываем подсветку — все грани в неактивное состояние
      const mats = materialsRef.current;
      if (mats.length) {
        for (let i = 0; i < 12; i++) {
          const symbol = FACE_TO_SYMBOL[i];
          const newTex = createFaceTexture(symbol, false);
          const oldTex = mats[i].map;
          mats[i].map = newTex;
          mats[i].needsUpdate = true;
          if (oldTex && oldTex !== newTex) oldTex.dispose();
        }
      }

      // Находим индекс грани для этого символа
      const faceIndices = FACE_TO_SYMBOL
        .map((f, i) => f === targetFace ? i : -1)
        .filter(i => i >= 0);
      const targetIndex = faceIndices[Math.floor(Math.random() * faceIndices.length)];
      lastFaceIndexRef.current = targetIndex;
      const targetRotation = faceRotations[targetIndex];
      const extraSpins = 3 + Math.floor(Math.random() * 2);

      const TWO_PI = Math.PI * 2;
      // Нормализация угла в диапазон [0, 2π)
      const wrap = (v: number) => {
        let r = v % TWO_PI;
        if (r < 0) r += TWO_PI;
        return r;
      };

      // Текущие и целевые углы, приведённые к [0, 2π)
      const cur = {
        x: wrap(mesh.rotation.x),
        y: wrap(mesh.rotation.y),
        z: wrap(mesh.rotation.z),
      };
      const tgt = {
        x: wrap(targetRotation.x),
        y: wrap(targetRotation.y),
        z: wrap(targetRotation.z),
      };

      // Финальный угол = целевой угол + N полных оборотов.
      // Если целевой угол "позади" текущего по направлению — добавляем ещё один
      // оборот, чтобы кубик всегда крутился вперёд и останавливался ровно на грани.
      const buildFinal = (tgtAngle: number, curAngle: number) =>
        tgtAngle + TWO_PI * extraSpins + (tgtAngle <= curAngle ? TWO_PI : 0);

      const final = {
        x: buildFinal(tgt.x, cur.x),
        y: buildFinal(tgt.y, cur.y),
        z: buildFinal(tgt.z, cur.z),
      };

      return new Promise((resolve) => {
        const el = containerRef.current;

        // Размытие в движении: резко нарастает на старте, медленно спадает
        // через анимацию псевдопеременной blurValue на пустом объекте
        if (el) {
          const blurProxy = { v: 0 };
          gsap.to(blurProxy, {
            v: 3,
            duration: 0.25,
            ease: 'power2.in',
            onUpdate: () => { el.style.filter = `blur(${blurProxy.v}px)`; },
          });
          gsap.to(blurProxy, {
            v: 0,
            duration: 1.2,
            ease: 'power3.out',
            delay: 0.25,
            onUpdate: () => { el.style.filter = `blur(${blurProxy.v}px)`; },
            onComplete: () => { el.style.filter = ''; },
          });
        }

        // Вращение кубика
        gsap.to(mesh.rotation, {
          x: final.x, y: final.y, z: final.z,
          duration: 2.0, ease: 'power4.out',
          onComplete: () => {
            if (el) el.style.filter = '';
            mesh.rotation.x = wrap(final.x);
            mesh.rotation.y = wrap(final.y);
            mesh.rotation.z = wrap(final.z);
            isSpinningRef.current = false;
            onSpinComplete?.();
            resolve();
          }
        });
      });
    }, [stopIdleAnimation, onSpinComplete]);

    // Инициализация Three.js сцены
    useEffect(() => {
      if (!containerRef.current) return;
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
      camera.position.z = 4;
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Освещение не используется — применяем MeshBasicMaterial,
      // который отображает текстуру как есть, без засветок и бликов.
      // (Можно оставить AmbientLight на случай, если понадобится минимальная видимость)
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));

      // Создаём кастомный додекаэдр с правильными группами материалов
      const geometry = createDodecahedronWithGroups(1.0);
      
      const materials: THREE.MeshBasicMaterial[] = [];
      for (let i = 0; i < 12; i++) {
        const symbol = FACE_TO_SYMBOL[i];
        const texture = createFaceTexture(symbol);
        materials.push(new THREE.MeshBasicMaterial({
          map: texture, 
          side: THREE.FrontSide,
        }));
      }
      materialsRef.current = materials;
      
      const mesh = new THREE.Mesh(geometry, materials);
      scene.add(mesh);
      meshRef.current = mesh;

      // Загружаем SVG иконки и обновляем текстуры граней
      (async () => {
        const loadSvg = async (symbol: DiceFace, path: string) => {
          try {
            const resp = await fetch(path);
            let svg = await resp.text();
            const inactiveColor = SYMBOL_DATA[symbol].inactiveColor;
            const goldColor = SYMBOL_DATA[symbol].activeColor;

            // Коричневая версия (inactive) — перекрашиваем чёрный в коричневый
            let inactiveSvg = svg
              .replace(/stroke="#000000"/g, `stroke="${inactiveColor}"`)
              .replace(/fill="#000000"/g, `fill="${inactiveColor}"`)
              .replace(/\.st0\{fill:#000000;\}/g, `.st0{fill:${inactiveColor};}`)
              .replace(/stroke:#000000;/g, `stroke:${inactiveColor};`)
              .replace(/fill:#000000;/g, `fill:${inactiveColor};`);
            // Золотая версия (active) — перекрашиваем чёрный в золотой
            let goldSvg = svg
              .replace(/stroke="#000000"/g, `stroke="${goldColor}"`)
              .replace(/fill="#000000"/g, `fill="${goldColor}"`)
              .replace(/\.st0\{fill:#000000;\}/g, `.st0{fill:${goldColor};}`)
              .replace(/stroke:#000000;/g, `stroke:${goldColor};`)
              .replace(/fill:#000000;/g, `fill:${goldColor};`);

            const svgToImg = async (svgText: string): Promise<HTMLImageElement> => {
              const blob = new Blob([svgText], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const img = new Image();
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = url;
              });
              URL.revokeObjectURL(url);
              return img;
            };

            const [inactive, gold] = await Promise.all([
              svgToImg(inactiveSvg),
              svgToImg(goldSvg),
            ]);
            svgImagesRef.current[symbol] = { inactive, gold };
          } catch (e) {
            console.error('SVG load error:', symbol, e);
          }
        };

        await Promise.all([
          loadSvg('coin', '/assets/bonusgame/coin.svg'),
          loadSvg('diamond', '/assets/bonusgame/crystal.svg'),
          loadSvg('fire', '/assets/bonusgame/fire.svg'),
          loadSvg('skull', '/assets/bonusgame/skull.svg'),
        ]);

        // Обновляем текстуры всех граней — все чёрные (inactive)
        const mats = materialsRef.current;
        for (let i = 0; i < 12; i++) {
          const symbol = FACE_TO_SYMBOL[i];
          const newTex = createFaceTexture(symbol, false);
          const oldTex = mats[i].map;
          mats[i].map = newTex;
          mats[i].needsUpdate = true;
          if (oldTex) oldTex.dispose();
        }
      })();

      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();
      // Не запускаем idle анимацию автоматически - додекаэдр стоит неподвижно
      // startIdleAnimation();

      return () => {
        cancelAnimationFrame(animationFrameRef.current);
        if (idleAnimationRef.current) idleAnimationRef.current.kill();
        renderer.dispose();
        geometry.dispose();
        materials.forEach(m => { m.map?.dispose(); m.dispose(); });
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    }, [size, createFaceTexture, startIdleAnimation]);

    // Экспортируем методы через ref
    useImperativeHandle(ref, () => ({
      spinTo, startIdleAnimation, stopIdleAnimation, highlightFace,
    }), [spinTo, startIdleAnimation, stopIdleAnimation, highlightFace]);

    return (
      <div ref={containerRef} className="dodecahedron-3d-container"
        style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      />
    );
  }
);

Dodecahedron3D.displayName = 'Dodecahedron3D';
export default Dodecahedron3D;
