// Mbamager TypeScript Schema and Domain Model Type Definitions

export interface User {
  id: number;
  username: string;
  phone_number?: string | null;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

export type AccountType = 'MOBILE_MONEY' | 'BANK' | 'CASH' | 'OTHER';
export type AccountProvider = 'MTN_MOMO' | 'ORANGE_MONEY' | 'CASH' | 'BANK' | 'OTHER';

export interface Account {
  id: number;
  user_id: number;
  name: string;
  type?: AccountType;
  account_type?: AccountType;
  provider: AccountProvider;
  balance: number;
  currency: string; // E.g., 'XAF'
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TransactionDirection = 'CREDIT' | 'DEBIT';
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FAILED';

export interface Transaction {
  id: number;
  account_id: number;
  user_id?: number;
  amount: number;
  fee?: number;
  direction: TransactionDirection;
  category: string;
  narrative?: string;
  status?: TransactionStatus;
  external_id?: string; // E.g. Mobile Money TxID
  tx_id_external?: string;
  timestamp?: string;
  ai_confidence?: number;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: number;
  user_id: number;
  category: string;
  limit_amount: number;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetProgress {
  budget_id: number;
  category: string;
  limit_amount: number;
  spent_amount: number;
  remaining_amount: number;
  percentage_used: number;
  start_date: string;
  end_date: string;
}

export interface BudgetCoaching extends BudgetProgress {
  risk_level: 'SAFE' | 'WARNING' | 'EXCEEDED';
  message: string;
  tips: string[];
  encouragement: string;
}

export type GoalStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface SavingsGoal {
  id: number;
  user_id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurringTransaction {
  id: number;
  user_id: number;
  account_id: number;
  amount: number;
  category: string;
  direction: TransactionDirection;
  frequency: RecurringFrequency;
  start_date: string;
  end_date?: string;
  narrative?: string;
  active: boolean;
  last_processed?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'LOW_BALANCE' | 'BUDGET_WARNING' | 'GOAL_REACHED' | 'UNUSUAL_SPENDING' | 'RECURRING_PAYMENT' | 'SMS_IMPORT_FAILED';
  is_read: boolean;
  created_at: string;
}

export interface SMS {
  id: number;
  user_id: number;
  sender: string; // E.g., 'MTNMOMO', 'OrangeMoney'
  message_text: string;
  received_at: string;
  is_parsed: boolean;
  parsed_transaction_id?: number;
  created_at: string;
}

export interface AIInsights {
  id: number;
  user_id: number;
  prompt_type: string;
  raw_response: string;
  extracted_insights: Record<string, any>;
  created_at: string;
}

export interface DashboardSummary {
  total_net_worth: number;
  total_income: number;
  total_expenses: number;
  account_balances: Record<number, number>;
  active_budgets: BudgetProgress[];
  savings_goals: SavingsGoal[];
  upcoming_payments: RecurringTransaction[];
  unread_notifications: Notification[];
}

export type TontineFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type TontineGroupStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TontineContributionStatus = 'PAID' | 'LATE';

export interface TontineGroup {
  id: number;
  creator_id: number;
  name: string;
  description?: string | null;
  contribution_amount: number;
  currency: string;
  frequency: TontineFrequency;
  status: TontineGroupStatus;
  current_cycle: number;
  start_date: string;
  created_at: string;
  updated_at: string;
}

export interface TontineMember {
  id: number;
  group_id: number;
  user_id?: number | null;
  display_name: string;
  payout_position: number;
  has_received_payout: boolean;
  joined_at: string;
}

export interface TontineContribution {
  id: number;
  group_id: number;
  member_id: number;
  cycle_number: number;
  amount: number;
  status: TontineContributionStatus;
  transaction_id?: number | null;
  paid_at: string;
}

export interface TontinePayout {
  id: number;
  group_id: number;
  member_id: number;
  cycle_number: number;
  amount: number;
  transaction_id?: number | null;
  paid_at: string;
}

export interface TontineMemberCycleStatus {
  member_id: number;
  display_name: string;
  payout_position: number;
  has_paid: boolean;
}

export interface TontineCycleStatus {
  group_id: number;
  cycle_number: number;
  contribution_amount: number;
  expected_total: number;
  collected_total: number;
  members: TontineMemberCycleStatus[];
  all_members_paid: boolean;
  recipient_member_id?: number | null;
  payout_made: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
