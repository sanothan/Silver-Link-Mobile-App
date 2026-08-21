export type ReportCategory = 'complaint' | 'safety';
export type ReportStatus = 'open' | 'resolved';

export interface ReportRecord {
  id: string;
  category: ReportCategory;
  urgent: boolean;
  message: string;
  status: ReportStatus;
  createdBy: string;
  createdByRole: string;
  createdAt?: Date;
}
