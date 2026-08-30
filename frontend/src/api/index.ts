import axios, { AxiosInstance } from 'axios';
import { SpinResult, Stats } from '../types';

// URL API — задаётся через переменную окружения VITE_API_URL
// См. .env и .env.production
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

console.log('[API] URL:', API_URL);

// Хранение токена авторизации
let authToken: string | null = null;

// Создаём axios instance с interceptor для токена
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
});

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// ============== АВТОРИЗАЦИЯ ==============

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    balance: number;
    total_spins: number;
    biggest_win: number;
  };
}

/**
 * Авторизация на сервере по platform + player_id
 */
export const auth = async (platform: string, playerId: string): Promise<AuthResponse> => {
  try {
    const response = await api.post('/auth', {
      platform,
      player_id: playerId,
    });
    
    // Сохраняем токен
    authToken = response.data.token;
    console.log('[API] Авторизация успешна, user_id:', response.data.user.id);
    
    return response.data;
  } catch (error) {
    console.error('[API] Ошибка авторизации:', error);
    throw error;
  }
};

/**
 * Проверить, авторизован ли пользователь
 */
export const isAuthenticated = (): boolean => {
  return authToken !== null;
};

/**
 * Выйти (удалить токен)
 */
export const logout = (): void => {
  authToken = null;
};

// ============== ИГРОВЫЕ МЕТОДЫ ==============

// Получение баланса пользователя
export const fetchBalance = async (): Promise<number> => {
  try {
    const response = await api.get('/balance');
    return response.data.balance;
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw error;
  }
};

// Выполнение одиночного спина (поддерживает фриспины)
export const spin = async (
  bet: number,
  freeSpinsRemaining: number = 0,
  isFreeSpin: boolean = false,
  testFreeSpins: boolean = false
): Promise<SpinResult> => {
  try {
    const response = await api.post('/spin', {
      bet,
      free_spins_remaining: freeSpinsRemaining,
      is_free_spin: isFreeSpin,
      test_free_spins: testFreeSpins
    });
    return response.data;
  } catch (error) {
    console.error('Error performing spin:', error);
    throw error;
  }
};

// Выполнение множественных спинов (1000 спинов)
export const multiSpin = async (bet: number): Promise<{ stats: Stats; balance: number }> => {
  try {
    const response = await api.post('/multi_spin', { bet, spins: 1000 });
    return response.data;
  } catch (error) {
    console.error('Error performing multi-spin:', error);
    throw error;
  }
};

// Сброс баланса пользователя
export const resetBalance = async (): Promise<number> => {
  try {
    const response = await api.post('/reset_balance');
    return response.data.balance;
  } catch (error) {
    console.error('Error resetting balance:', error);
    throw error;
  }
};

// Начисление награды за просмотр рекламы
export const claimAdReward = async (): Promise<{ balance: number; reward: number }> => {
  try {
    const response = await api.post('/ad_reward');
    return response.data;
  } catch (error) {
    console.error('Error claiming ad reward:', error);
    throw error;
  }
};
