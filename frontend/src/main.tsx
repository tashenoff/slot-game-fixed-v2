import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { platformManager } from './platform'
import * as API from './api'

/**
 * Точка входа приложения
 * 1. Инициализируем платформу (Yandex/VK/Local)
 * 2. Авторизуемся на своём сервере
 * 3. Рендерим React
 */
async function bootstrap() {
  try {
    // 1. Инициализация платформы
    const platform = await platformManager.init();
    const player = platformManager.getPlayer();
    
    console.log(`🎮 Платформа: ${platform.platformName}`);
    console.log(`👤 Игрок: ${player.name} (${player.id})`);
    
    // 2. Авторизация на нашем сервере
    const authResult = await API.auth(platform.platformName, player.id);
    console.log(`✅ Авторизация успешна, баланс: ${authResult.user.balance}`);
    
    // 3. Рендерим React приложение с начальным балансом
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App initialBalance={authResult.user.balance} />
      </React.StrictMode>,
    );
    
    // 4. Сообщаем платформе что игра загружена
    platform.gameReady();
    
  } catch (error) {
    console.error('❌ Ошибка запуска:', error);
    
    // Показываем fallback UI при критической ошибке
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#fff;background:#1a1a2e;">
          <div style="text-align:center;">
            <h1>Ошибка загрузки</h1>
            <p>Попробуйте перезагрузить страницу</p>
            <p style="opacity:0.5;font-size:12px;margin-top:20px;">${error}</p>
          </div>
        </div>
      `;
    }
  }
}

bootstrap();
