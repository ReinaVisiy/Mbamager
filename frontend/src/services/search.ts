import { api } from '../lib/api';

export type SearchResultType = 'account' | 'transaction' | 'goal' | 'recurring' | 'notification' | 'tontine';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  meta?: string | null;
  url: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
}

export const searchService = {
  /**
   * Run one server-side search across accounts, transactions, goals,
   * recurring transactions, notifications, and tontine groups. Filtering
   * and limiting happens in the database, so this stays fast regardless
   * of how much data the user has -- unlike fetching whole collections
   * and filtering them in the browser.
   */
  async search(query: string): Promise<SearchResponse> {
    const response = await api.get<SearchResponse>('/search', {
      params: { q: query },
    });
    return response.data;
  },
};
