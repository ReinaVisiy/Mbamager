import { api } from '../lib/api';
import { 
  Budget, 
  BudgetCoaching,
  SavingsGoal, 
  RecurringTransaction,
  RecurringFrequency,
  TransactionDirection
} from '../types';

export interface CreateBudgetPayload {
  category: string;
  limit_amount: number;
  start_date: string;
  end_date: string;
}

export interface UpdateBudgetPayload {
  category?: string;
  limit_amount?: number;
  start_date?: string;
  end_date?: string;
}


export interface CreateGoalPayload {
  name: string;
  target_amount: number;
  current_amount?: number;
  target_date: string;
}

export interface UpdateGoalPayload {
  name?: string;
  target_amount?: number;
  current_amount?: number;
  target_date?: string;
  status?: string;
}

export interface CreateRecurringPayload {
  account_id: number;
  amount: number;
  category: string;
  direction: TransactionDirection;
  frequency: RecurringFrequency;
  start_date: string;
  end_date?: string;
  narrative?: string;
}

export interface UpdateRecurringPayload {
  account_id?: number;
  amount?: number;
  category?: string;
  direction?: TransactionDirection;
  frequency?: RecurringFrequency;
  start_date?: string;
  end_date?: string;
  active?: boolean;
  narrative?: string;
}

export interface SavingsGoalProgress {
  goal_id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  remaining_amount: number;
  percentage_completed: number;
  target_date: string;
  status: string;
  monthly_contribution_recommended: number;
}

export const financeService = {
  // === BUDGETS ===
  async getBudgets(): Promise<Budget[]> {
    const response = await api.get<Budget[]>('/budgets/');
    return response.data;
  },

  async createBudget(payload: CreateBudgetPayload): Promise<Budget> {
    const response = await api.post<Budget>('/budgets/', payload);
    return response.data;
  },

  async updateBudget(budgetId: number, payload: UpdateBudgetPayload): Promise<Budget> {
    const response = await api.put<Budget>(`/budgets/${budgetId}`, payload);
    return response.data;
  },

  async deleteBudget(budgetId: number): Promise<void> {
    await api.delete(`/budgets/${budgetId}`);
  },

  /**
   * Fetch COMPASS coaching for a single budget: deterministic progress
   * metrics (spent/remaining/percentage_used/risk_level) plus an
   * AI-authored message, tips, and encouragement. Rate-limited on the
   * backend (limit_ai) since it calls the Gemini AI layer.
   */
  async getBudgetCoaching(budgetId: number): Promise<BudgetCoaching> {
    const response = await api.get<BudgetCoaching>(`/budgets/${budgetId}/coach`);
    return response.data;
  },

  // === SAVINGS GOALS ===
  async getGoals(): Promise<SavingsGoal[]> {
    const response = await api.get<SavingsGoal[]>('/goals');
    return response.data;
  },

  async createGoal(payload: CreateGoalPayload): Promise<SavingsGoal> {
    const response = await api.post<SavingsGoal>('/goals', payload);
    return response.data;
  },

  async updateGoal(goalId: number, payload: UpdateGoalPayload): Promise<SavingsGoal> {
    const response = await api.put<SavingsGoal>(`/goals/${goalId}`, payload);
    return response.data;
  },

  async deleteGoal(goalId: number): Promise<void> {
    await api.delete(`/goals/${goalId}`);
  },

  async getGoalProgress(goalId: number): Promise<SavingsGoalProgress> {
    const response = await api.get<SavingsGoalProgress>(`/goals/${goalId}/progress`);
    return response.data;
  },

  // === RECURRING TRANSACTIONS ===
  async getRecurring(): Promise<RecurringTransaction[]> {
    const response = await api.get<RecurringTransaction[]>('/recurring-transactions');
    return response.data;
  },

  async createRecurring(payload: CreateRecurringPayload): Promise<RecurringTransaction> {
    const response = await api.post<RecurringTransaction>('/recurring-transactions', payload);
    return response.data;
  },

  async updateRecurring(id: number, payload: UpdateRecurringPayload): Promise<RecurringTransaction> {
    const response = await api.put<RecurringTransaction>(`/recurring-transactions/${id}`, payload);
    return response.data;
  },

  async deleteRecurring(id: number): Promise<void> {
    await api.delete(`/recurring-transactions/${id}`);
  },

  async triggerProcessRecurring(): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/recurring-transactions/process');
    return response.data;
  },
};

