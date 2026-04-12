export interface CampaignStatsDto {
  campaignId: string;
  name: string;
  totalContacts: number;
  sessions: {
    pending: number;
    active: number;
    completed: number;
    abandoned: number;
  };
  avgResponseTimeSeconds: number;
  avgSessionDurationSeconds: number;
}
