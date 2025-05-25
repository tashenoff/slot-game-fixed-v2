import axios from 'axios';
import { SpinResult, Stats } from '../types';

const API_URL = 'http://192.168.1.66:5000/api';

// Получение баланса пользователя
export const fetchBalance = async (): Promise<number> => {
  try {
    const response = await axios.get(`${API_URL}/balance`);
    return response.data.balance;
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw error;
  }
};

// Выполнение одиночного спина
export const spin = async (bet: number): Promise<SpinResult> => {
  try {
    const response = await axios.post(`${API_URL}/spin`, { bet });
    return response.data;
  } catch (error) {
    console.error('Error performing spin:', error);
    throw error;
  }
};

// Выполнение множественных спинов (1000 спинов)
export const multiSpin = async (bet: number): Promise<{ stats: Stats; balance: number }> => {
  try {
    const response = await axios.post(`${API_URL}/multi_spin`, { bet, spins: 1000 });
    return response.data;
  } catch (error) {
    console.error('Error performing multi-spin:', error);
    throw error;
  }
};

// Сброс баланса пользователя
export const resetBalance = async (): Promise<number> => {
  try {
    const response = await axios.post(`${API_URL}/reset_balance`);
    return response.data.balance;
  } catch (error) {
    console.error('Error resetting balance:', error);
    throw error;
  }
};
