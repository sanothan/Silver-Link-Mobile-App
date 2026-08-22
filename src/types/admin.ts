export interface AdminDashboardStats {
  totalUsers: number;
  activeVolunteers: number;
  pendingVerifications: number;
  activeRequests: number;
  completedActivities: number;
  openReports: number;
}

export interface PendingVolunteer {
  uid: string;
  fullName: string;
  email: string;
  submittedAt?: Date;
}

export type ActionPriority = 'high' | 'normal';
export type ActionItemType = 'verification' | 'safety' | 'complaint';

export interface ActionItem {
  id: string;
  type: ActionItemType;
  priority: ActionPriority;
  title: string;
  createdAt?: Date;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  pendingVolunteers: PendingVolunteer[];
  actionItems: ActionItem[];
}

export interface AdminUserRow {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}
