import { api } from '../lib/api';

export interface ChatMessagePayload {
  sender: 'user' | 'assistant';
  content: string;
}

export interface AssistantChatRequest {
  message: string;
  conversation_history?: ChatMessagePayload[];
}

export interface AssistantChatResponse {
  reply: string;
  suggested_follow_ups: string[];
}

export const assistantService = {
  /**
   * Send a message to GUIDE, the Mbamager conversational financial assistant.
   * The backend grounds its reply in the user's real transactions and
   * budgets — it never invents figures, and never modifies any data.
   */
  async chat(payload: AssistantChatRequest): Promise<AssistantChatResponse> {
    const response = await api.post<AssistantChatResponse>('/assistant/chat', payload);
    return response.data;
  },
};
