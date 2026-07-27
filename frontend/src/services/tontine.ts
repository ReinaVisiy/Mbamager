import { api } from '../lib/api';
import {
  TontineGroup,
  TontineMember,
  TontineContribution,
  TontinePayout,
  TontineCycleStatus,
  TontineFrequency,
  TontineGroupStatus,
} from '../types';

export interface CreateTontineGroupPayload {
  name: string;
  description?: string;
  contribution_amount: number;
  currency?: string;
  frequency: TontineFrequency;
  start_date?: string;
}

export interface UpdateTontineGroupPayload {
  name?: string;
  description?: string;
  contribution_amount?: number;
  status?: TontineGroupStatus;
}

export interface AddTontineMemberPayload {
  display_name: string;
  user_id?: number;
}

export interface RecordContributionPayload {
  member_id: number;
  cycle_number?: number;
  amount?: number;
  transaction_id?: number;
}

export interface RecordPayoutPayload {
  cycle_number?: number;
  transaction_id?: number;
}

export const tontineService = {
  async getGroups(): Promise<TontineGroup[]> {
    const response = await api.get<TontineGroup[]>('/tontine');
    return response.data;
  },

  async getGroup(groupId: number): Promise<TontineGroup> {
    const response = await api.get<TontineGroup>(`/tontine/${groupId}`);
    return response.data;
  },

  async createGroup(payload: CreateTontineGroupPayload): Promise<TontineGroup> {
    const response = await api.post<TontineGroup>('/tontine', payload);
    return response.data;
  },

  async updateGroup(groupId: number, payload: UpdateTontineGroupPayload): Promise<TontineGroup> {
    const response = await api.put<TontineGroup>(`/tontine/${groupId}`, payload);
    return response.data;
  },

  async deleteGroup(groupId: number): Promise<void> {
    await api.delete(`/tontine/${groupId}`);
  },

  async getMembers(groupId: number): Promise<TontineMember[]> {
    const response = await api.get<TontineMember[]>(`/tontine/${groupId}/members`);
    return response.data;
  },

  async addMember(groupId: number, payload: AddTontineMemberPayload): Promise<TontineMember> {
    const response = await api.post<TontineMember>(`/tontine/${groupId}/members`, payload);
    return response.data;
  },

  async removeMember(groupId: number, memberId: number): Promise<void> {
    await api.delete(`/tontine/${groupId}/members/${memberId}`);
  },

  async recordContribution(groupId: number, payload: RecordContributionPayload): Promise<TontineContribution> {
    const response = await api.post<TontineContribution>(`/tontine/${groupId}/contributions`, payload);
    return response.data;
  },

  async getCycleStatus(groupId: number, cycleNumber: number): Promise<TontineCycleStatus> {
    const response = await api.get<TontineCycleStatus>(`/tontine/${groupId}/cycles/${cycleNumber}`);
    return response.data;
  },

  async recordPayout(groupId: number, payload: RecordPayoutPayload = {}): Promise<TontinePayout> {
    const response = await api.post<TontinePayout>(`/tontine/${groupId}/payouts`, payload);
    return response.data;
  },
};
