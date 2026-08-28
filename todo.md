# Задачи по разработке слот-игры 5x3

---

## 🚨 ПРИОРИТЕТ: Оптимизация производительности на мобильных устройствах

### Проблема
При переключении в мобильную версию браузера вращение барабанов тормозит/лагает.

### Причины торможения

#### 1. BlurFilter с высоким quality на каждом символе
**Файл:** `frontend/src/game/core/ReelManager.ts:117-132`
```typescript
const blur = new PIXI.filters.BlurFilter(); 
blur.quality = 4; // ❌ высокое качество = тяжёлый GPU-эффект
// ...
sp.filters = [blur]; // Применяется к КАЖДОМУ символу
```
**Проблема:** BlurFilter с quality=4 применяется к каждому символу (5 барабанов × reelStripLength символов). На мобильных GPU это очень тяжёлая операция.

#### 2. Отсутствие оптимизаций PIXI.Application для мобильных
**Файл:** `frontend/src/game/SlotMachine.ts:125`
```typescript
this.app = new PIXI.Application({ 
  width: borderWidth, 
  height: borderHeight, 
  backgroundAlpha: 0 
});
```
**Проблема:** Нет критических оптимизаций:
- ❌ Нет `resolution` — на Retina-дисплеях рендерится в 2-3x разрешении
- ❌ Нет `powerPreference: 'high-performance'`
- ❌ Нет `antialias: false` для мобильных

#### 3. Много спрайтов с фильтрами
**Файл:** `frontend/src/game/config/SlotConfig.ts:112`
- reelStripLength: 5 символов × 5 барабанов = 25 спрайтов с BlurFilter
- Каждый кадр все спрайты перерисовываются с blur-эффектом

#### 4. Каждый кадр обновляются позиции ВСЕХ спрайтов
**Файл:** `frontend/src/game/core/ReelManager.ts:187-200`
- Перебор всех спрайтов ленты каждый кадр

#### 5. Date.now() вместо delta в ticker
**Файл:** `frontend/src/game/animation/ReelAnimator.ts:177`
- Использование Date.now() вместо delta может приводить к нестабильному FPS

### Задачи по оптимизации

- [ ] **Оптимизация PIXI.Application для мобильных**
  ```typescript
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  this.app = new PIXI.Application({ 
    width: borderWidth, 
    height: borderHeight, 
    backgroundAlpha: 0,
    resolution: isMobile ? 1 : (window.devicePixelRatio || 1),
    autoDensity: true,
    antialias: !isMobile,
    powerPreference: 'high-performance',
  });
  ```

- [ ] **Снижение качества BlurFilter на мобильных**
  ```typescript
  blur.quality = isMobile ? 1 : 4;
  ```

- [ ] **Применять blur к контейнеру барабана, а не к каждому символу**
  ```typescript
  // Вместо: sp.filters = [blur]; (на каждый символ)
  reel.filters = [blur]; // На весь барабан (1 фильтр вместо 5)
  ```

- [ ] **Опция отключения blur на слабых устройствах**
  ```typescript
  if (isMobile && isLowEndDevice) {
    animation.maxBlur = 0;
  }
  ```

- [ ] **Рассмотреть TilingSprite вместо множества отдельных спрайтов**

### Дополнительная диагностика
- [ ] Добавить FPS meter: `this.app.ticker.FPS`
- [ ] Проверить количество draw calls: `this.app.renderer.plugins.batch.currentIndex`
- [ ] Проверить DevTools Performance в мобильном браузере

---

## Бэкенд (Flask)
- [x] Создать базовую структуру Flask-приложения
- [x] Реализовать RNG для генерации результатов спинов
- [x] Создать JSON-конфигурацию с весами символов и выигрышными комбинациями
- [x] Реализовать API для выполнения спинов
- [x] Реализовать хранение и управление балансом пользователя
- [x] Добавить функционал для выполнения 1000 спинов и сбора статистики RTP

## Фронтенд (React + Pixi.js)
- [x] Настроить React-проект с Tailwind CSS (старая версия)
- [x] Интегрировать Pixi.js для анимаций
- [x] Создать компоненты для отображения слот-машины (5x3 сетка)
- [x] Реализовать анимацию вращения барабанов
- [x] Добавить отображение выигрышных линий (5 линий)
- [x] Реализовать интерфейс с кнопками "Спин" и "1000 спинов"
- [x] Добавить отображение баланса пользователя
- [x] Реализовать отображение статистики после 1000 спинов

## Интеграция и тестирование
- [x] Настроить взаимодействие между фронтендом и бэкендом
- [x] Протестировать RNG и выигрышные комбинации
- [x] Проверить корректность расчета RTP
- [x] Оптимизировать производительность анимаций

## Финальные шаги
- [x] Подготовить dev-версию проекта
- [x] Собрать все исходники для передачи
- [x] Документировать код и API
