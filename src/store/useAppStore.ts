import { create } from 'zustand';
import { getAllCategories, type Category } from '../db/categoryRepository';
import { getRecentExpenses, getGrandTotal, type ExpenseWithCategory } from '../db/expenseRepository';
import { resolvePeriod } from '../db/queries';
import {
  getBoolSetting,
  setBoolSetting,
  SETTING_CONFIRM_BEFORE_SUBMIT,
} from '../db/settingsRepository';

type AppState = {
  categories: Category[];
  recentExpenses: ExpenseWithCategory[];
  // Grand total spent in the current calendar month — drives the Home summary card.
  monthlyTotal: number;
  isModelLoaded: boolean;
  isDbReady: boolean;
  // When true, a recognized/typed command opens an editable confirm popup before
  // it is executed. Persisted in the settings table.
  confirmBeforeSubmit: boolean;

  refreshCategories: () => Promise<void>;
  refreshExpenses: () => Promise<void>;
  refreshMonthlyTotal: () => Promise<void>;
  // Convenience: refresh everything the Home screen shows after a mutation.
  refreshAll: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setConfirmBeforeSubmit: (value: boolean) => Promise<void>;
  setModelLoaded: (loaded: boolean) => void;
  setDbReady: (ready: boolean) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  categories: [],
  recentExpenses: [],
  monthlyTotal: 0,
  isModelLoaded: false,
  isDbReady: false,
  confirmBeforeSubmit: false,

  refreshCategories: async () => {
    const categories = await getAllCategories();
    set({ categories });
  },

  refreshExpenses: async () => {
    const recentExpenses = await getRecentExpenses(10);
    set({ recentExpenses });
  },

  refreshMonthlyTotal: async () => {
    const { startDate, endDate } = resolvePeriod('this_month');
    const monthlyTotal = await getGrandTotal(startDate, endDate);
    set({ monthlyTotal });
  },

  refreshAll: async () => {
    await Promise.all([
      get().refreshCategories(),
      get().refreshExpenses(),
      get().refreshMonthlyTotal(),
    ]);
  },

  loadSettings: async () => {
    const confirmBeforeSubmit = await getBoolSetting(SETTING_CONFIRM_BEFORE_SUBMIT, false);
    set({ confirmBeforeSubmit });
  },

  setConfirmBeforeSubmit: async (value) => {
    set({ confirmBeforeSubmit: value });
    await setBoolSetting(SETTING_CONFIRM_BEFORE_SUBMIT, value);
  },

  setModelLoaded: (loaded) => set({ isModelLoaded: loaded }),

  setDbReady: (ready) => set({ isDbReady: ready }),
}));
