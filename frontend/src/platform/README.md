# Platform Module — Мультиплатформенная система

Модуль для работы с различными игровыми платформами (Яндекс.Игры, VK Games и др.) через единый интерфейс.

## 📁 Структура

```
platform/
├── IPlatformAdapter.ts     # Интерфейс адаптера
├── PlatformManager.ts      # Синглтон-менеджер платформ
├── index.ts                # Экспорты модуля
├── README.md               # Документация
└── adapters/
    ├── LocalAdapter.ts     # Для разработки и своего сайта
    ├── YandexAdapter.ts    # Яндекс.Игры
    └── VKAdapter.ts        # VK Games
```

## 🚀 Быстрый старт

### Инициализация (уже настроена в main.tsx)

```typescript
import { platformManager } from './platform';

// Автоопределение платформы
const platform = await platformManager.init();
const player = platformManager.getPlayer();

console.log(`Платформа: ${platform.platformName}`);
console.log(`Игрок: ${player.name} (${player.id})`);
```

### Использование в React компонентах

```typescript
import { usePlatform } from '../hooks/usePlatform';

function MyComponent() {
  const { isReady, player, showRewardedAd } = usePlatform();
  
  if (!isReady) return <div>Загрузка...</div>;
  
  const handleWatchAd = async () => {
    const rewarded = await showRewardedAd();
    if (rewarded) {
      // Начислить награду через API
      await API.claimAdReward();
    }
  };
  
  return (
    <div>
      <p>Привет, {player?.name}!</p>
      <button onClick={handleWatchAd}>Смотреть рекламу за бонус</button>
    </div>
  );
}
```

## 📺 Показ рекламы

```typescript
// Rewarded (с наградой)
const rewarded = await platformManager.showRewardedAd();
if (rewarded) {
  // Игрок досмотрел — дать награду
}

// Interstitial (межстраничная)
await platformManager.showInterstitialAd();
```

## 🧪 Тестирование платформ

Добавьте параметр `?platform=xxx` к URL:

- `?platform=local` — локальный режим (по умолчанию)
- `?platform=yandex` — эмуляция Яндекс.Игры (нужен SDK)
- `?platform=vk` — эмуляция VK Games (нужен Bridge)

## ➕ Добавление новой платформы

1. Создайте файл `adapters/NewPlatformAdapter.ts`
2. Реализуйте интерфейс `IPlatformAdapter`
3. Добавьте в `PlatformManager.createAdapter()`
4. Добавьте определение в `PlatformManager.detectPlatform()`

Пример:

```typescript
// adapters/CrazyGamesAdapter.ts
import { IPlatformAdapter, IPlayerInfo } from '../IPlatformAdapter';

export class CrazyGamesAdapter implements IPlatformAdapter {
  readonly platformName = 'crazygames';
  
  async init(): Promise<void> {
    // Инициализация CrazyGames SDK
  }
  
  async getPlayer(): Promise<IPlayerInfo> {
    return { id: 'crazygames_user_123', name: 'Player' };
  }
  
  async showRewardedAd(): Promise<boolean> {
    // Показ рекламы через CrazyGames SDK
    return true;
  }
  
  // ... остальные методы
}
```

## 🔗 Полезные ссылки

- [Yandex Games SDK](https://yandex.ru/dev/games/doc/ru/)
- [VK Bridge](https://dev.vk.com/ru/bridge/overview)
- [CrazyGames SDK](https://docs.crazygames.com/sdk/html5/)
