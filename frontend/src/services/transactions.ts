import { api } from '../lib/api';
import { Transaction, TransactionDirection } from '../types';

export interface CreateTransactionPayload {
  account_id: number;
  amount: number;
  fee?: number;
  direction: TransactionDirection;
  category: string;
  narrative?: string;
  tx_id_external?: string;
  timestamp?: string;
}

export interface UpdateTransactionPayload {
  amount?: number;
  fee?: number;
  direction?: TransactionDirection;
  category?: string;
  narrative?: string;
  tx_id_external?: string;
  timestamp?: string;
}

export interface TransactionFilters {
  account_id?: number;
  category?: string;
  direction?: TransactionDirection;
  search?: string;
}

export interface AlternativeCategory {
  category: string;
  confidence: number;
  reason: string;
}

export interface TransactionExplainResponse {
  assigned_category: string;
  confidence: number;
  explanation: string;
  alternatives: AlternativeCategory[];
}

export interface TransactionReclassifyResponse {
  predicted_category: string;
  confidence: number;
}

export const transactionsService = {
  /**
   * Get all transactions for the current user, optionally filtered by
   * account, category, or direction. Backed by GET /transactions/, which
   * lists across every account server-side.
   */
  async getAll(filters: TransactionFilters = {}): Promise<Transaction[]> {
    const params: Record<string, string | number> = {};
    if (filters.account_id) params.account_id = filters.account_id;
    if (filters.category) params.category = filters.category;
    if (filters.direction) params.direction = filters.direction;

    const response = await api.get<Transaction[]>('/transactions/', { params });
    return response.data || [];
  },

  /**
   * Fetch specific transaction details by ID
   */
  async getById(id: number): Promise<Transaction> {
    const response = await api.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },

  /**
   * Log a standard transaction manually
   */
  async create(payload: CreateTransactionPayload): Promise<Transaction> {
    const response = await api.post<Transaction>('/transactions/', payload);
    return response.data;
  },

  /**
   * Update an existing transaction
   */
  async update(id: number, payload: UpdateTransactionPayload): Promise<Transaction> {
    const response = await api.put<Transaction>(`/transactions/${id}`, payload);
    return response.data;
  },

  /**
   * Delete an existing transaction
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/transactions/${id}`);
  },

  /**
   * Get AI-generated explanation of the transaction's category classification
   */
  async explain(id: number): Promise<TransactionExplainResponse> {
    const response = await api.get<TransactionExplainResponse>(`/transactions/${id}/explain`);
    return response.data;
  },

  /**
   * Trigger manual AI re-evaluation of the transaction categorization
   */
  async reclassify(id: number): Promise<TransactionReclassifyResponse> {
    const response = await api.post<TransactionReclassifyResponse>(`/transactions/${id}/reclassify`);
    return response.data;
  },

  // Note: SMS import lives in services/sms.ts (smsService.importSingle /
  // importBatch), which correctly targets POST /sms/import with the
  // {sender, message_body, received_at} payload the backend expects. An
  // earlier duplicate here targeted a nonexistent /sms/parse endpoint with
  // the wrong payload shape and was unused anywhere in the app, so it was
  // removed rather than fixed in place.
};
