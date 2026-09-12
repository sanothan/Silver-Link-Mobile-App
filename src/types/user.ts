export type UserRole = 'elderly' | 'volunteer' | 'caregiver' | 'admin';
export type UserStatus = 'active' | 'pending' | 'suspended';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  caregiverId?: string;
  caregiverLinkId?: string;
  phone?: string;
  locality?: string;
  preferredLanguage?: string;
  photoUrl?: string;
}
