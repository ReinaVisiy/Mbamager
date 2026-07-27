import { api } from '../lib/api';

export interface ScamAnalysisRequest {
  text: string;
  sender?: string;
}

export interface ScamAnalysisResponse {
  is_suspicious: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_score: number;
  reasons: string[];
  recommended_action: string;
}

export const scamService = {
  /**
   * Submit an SMS, chat message, or link for a scam/fraud risk assessment.
   * Advisory only — does not store the message or modify any data.
   */
  async analyze(payload: ScamAnalysisRequest): Promise<ScamAnalysisResponse> {
    const response = await api.post<ScamAnalysisResponse>('/scam/analyze', payload);
    return response.data;
  },
};
