import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { ReportCategory, ReportRecord } from '../types/report';

function asDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return undefined;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function submitReport(params: { uid: string; role: string; category: ReportCategory; urgent: boolean; message: string }): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await addDoc(collection(db, 'reports'), {
    category: params.category,
    urgent: params.urgent,
    message: params.message.trim(),
    status: 'open',
    createdBy: params.uid,
    createdByRole: params.role,
    createdAt: serverTimestamp(),
  });
}

export async function getOpenReports(): Promise<ReportRecord[]> {
  if (!db) throw new Error('Firebase is not configured.');
  const snapshot = await getDocs(query(collection(db, 'reports'), where('status', '==', 'open')));
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        category: (data.category === 'safety' ? 'safety' : 'complaint') as ReportCategory,
        urgent: data.urgent === true,
        message: asText(data.message),
        status: 'open' as const,
        createdBy: asText(data.createdBy),
        createdByRole: asText(data.createdByRole),
        createdAt: asDate(data.createdAt),
      };
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function resolveReport(id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await updateDoc(doc(db, 'reports', id), { status: 'resolved' });
}
