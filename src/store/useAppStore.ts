import { create } from 'zustand';
import { getAllCategories, type Category } from '../db/categoryRepository';
import { getRecentExpenses, type ExpenseWithCategory } from '../db/expenseRepository';

type AppState = {
  categories: Category[];
  recentExpenses: ExpenseWithCategory[];
  isModelLoaded: boolean;
  isDbReady: boolean;

  refreshCategories: () => Promise<void>;
  refreshExpenses: () => Promise<void>;
  setModelLoaded: (loaded: boolean) => void;
  setDbReady: (ready: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  categories: [],
  recentExpenses: [],
  isModelLoaded: false,
  isDbReady: false,

  refreshCategories: async () => {
    const categories = await getAllCategories();
    set({ categories });
  },

  refreshExpenses: async () => {
    const recentExpenses = await getRecentExpenses(10);
    set({ recentExpenses });
  },

  setModelLoaded: (loaded) => set({ isModelLoaded: loaded }),

  setDbReady: (ready) => set({ isDbReady: ready }),
}));
