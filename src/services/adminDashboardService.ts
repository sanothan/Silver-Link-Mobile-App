import { collection, getDocs, doc, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getOpenReports } from './reportService';
import type { ActionItem, AdminDashboardData, AdminDashboardStats, AdminRequestRow, AdminUserRow, PendingVolunteer } from '../types/admin';

const ACTIVE_ASSIGNMENT_STATUSES = ['accepted', 'scheduled', 'ready_to_start', 'in_progress'];
const OPEN_REQUEST_STATUSES = ['pending', 'open', 'available'];

function asText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function asDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return undefined;
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  if (!db) throw new Error('Firebase is not configured.');

  const [userDocs, openRequestDocs, activeAssignmentDocs, completedAssignmentDocs, openReports] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(query(collection(db, 'requests'), where('status', 'in', OPEN_REQUEST_STATUSES))),
    getDocs(query(collection(db, 'requestAssignments'), where('status', 'in', ACTIVE_ASSIGNMENT_STATUSES))),
    getDocs(query(collection(db, 'requestAssignments'), where('status', '==', 'completed'))),
    getOpenReports(),
  ]);

  let totalUsers = 0;
  let activeVolunteers = 0;
  const pendingVolunteers: PendingVolunteer[] = [];

  for (const snapshot of userDocs.docs) {
    const data = snapshot.data();
    const role = asText(data.role);
    const status = asText(data.status);
    totalUsers += 1;
    if (role === 'volunteer' && status === 'active') activeVolunteers += 1;
    if (role === 'volunteer' && status === 'pending') {
      pendingVolunteers.push({
        uid: snapshot.id,
        fullName: asText(data.fullName) || 'Unnamed volunteer',
        email: asText(data.email),
        submittedAt: asDate(data.createdAt),
      });
    }
  }
  pendingVolunteers.sort((a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0));

  const urgentReports = openReports.filter((report) => report.urgent);
  const nonUrgentReports = openReports.filter((report) => !report.urgent);

  const stats: AdminDashboardStats = {
    totalUsers,
    activeVolunteers,
    pendingVerifications: pendingVolunteers.length,
    activeRequests: openRequestDocs.size + activeAssignmentDocs.size,
    completedActivities: completedAssignmentDocs.size,
    openReports: openReports.length,
  };

  const actionItems: ActionItem[] = [
    ...urgentReports.map((report): ActionItem => ({ id: report.id, type: 'safety', priority: 'high', title: 'Safety Report', createdAt: report.createdAt })),
    ...pendingVolunteers.map((volunteer): ActionItem => ({ id: volunteer.uid, type: 'verification', priority: 'normal', title: 'Volunteer Verification', createdAt: volunteer.submittedAt })),
    ...nonUrgentReports.map((report): ActionItem => ({ id: report.id, type: 'complaint', priority: 'normal', title: 'User Complaint', createdAt: report.createdAt })),
  ];

  return { stats, pendingVolunteers, actionItems };
}

export async function approveVolunteer(uid: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await updateDoc(doc(db, 'users', uid), { status: 'active' });
}

export async function listRequests(): Promise<AdminRequestRow[]> {
  if (!db) throw new Error('Firebase is not configured.');
  const snapshot = await getDocs(collection(db, 'requests'));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      ownerName: asText(data.createdByName) || 'Unknown user',
      category: asText(data.activityType) || 'Other',
      status: asText(data.status) || 'unknown',
      assignedVolunteerName: asText(data.volunteerName) || undefined,
      createdAt: asDate(data.createdAt),
    };
  }).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function listUsers(): Promise<AdminUserRow[]> {
  if (!db) throw new Error('Firebase is not configured.');
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      uid: item.id,
      fullName: asText(data.fullName) || 'Unnamed user',
      email: asText(data.email),
      role: asText(data.role) || 'unknown',
      status: asText(data.status) || 'unknown',
    };
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));
}
