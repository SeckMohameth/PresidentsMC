export type UserRole = 'admin' | 'officer' | 'member';

export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
  bike?: string;
  joinedAt: string;
  preferences?: UserPreferences;
  lastActiveAt?: string;
}

export interface CrewMember extends User {
  role: UserRole;
  isDeveloperSupport?: boolean;
  ridesAttended: number;
  milesTraveled: number;
  joinedCrewAt: string;
}

export interface Crew {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  logoUrl?: string;
  nameLower?: string;
  isDiscoverable?: boolean;
  requiresApproval?: boolean;
  inviteCode?: string;
  createdAt: string;
  memberCount: number;
  totalRides: number;
  totalMiles: number;
  totalPhotos: number;
  ownerId?: string;
  subscriptionOwnerId?: string | null;
  subscriptionStatus?: 'active' | 'inactive' | 'past_due' | 'trialing';
  status?: 'active' | 'archived';
  archivedAt?: string | null;
  purgeAt?: string | null;
}

export interface Announcement {
  id: string;
  crewId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  title: string;
  content: string;
  link?: string;
  createdAt: string;
  isPinned: boolean;
  likedBy?: string[];
  imageUrl?: string;
  imageAttribution?: ImageAttribution;
}

export interface Location {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Ride {
  id: string;
  crewId: string;
  title: string;
  description: string;
  startLocation: Location;
  endLocation: Location;
  dateTime: string;
  estimatedDuration: string;
  estimatedDistance: number;
  pace: 'casual' | 'moderate' | 'spirited';
  notes: string;
  coverImage: string;
  coverAttribution?: ImageAttribution;
  createdBy: string;
  createdByName: string;
  attendees: string[];
  checkedIn: string[];
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  photos: RidePhoto[];
}

export interface ImageAttribution {
  source: 'unsplash';
  name: string;
  username: string;
  link: string;
}

export interface RidePhoto {
  id: string;
  rideId: string;
  uploadedBy: string;
  uploadedByName: string;
  imageUrl: string;
  uploadedAt: string;
}

export interface AttendanceRecord {
  rideId: string;
  rideName: string;
  date: string;
  checkedIn: boolean;
  miles: number;
}

export interface MemberStats {
  ridesAttended: number;
  milesTraveled: number;
  currentStreak: number;
  longestStreak: number;
  memberSince: string;
}

export interface CrewStats {
  totalRides: number;
  totalMiles: number;
  totalPhotos: number;
  totalMembers: number;
  ridesThisMonth: number;
  milesThisMonth: number;
}

export interface CrewStatsSnapshot {
  id: string;
  crewId: string;
  period: 'week' | 'month' | 'year';
  periodStart: string;
  periodEnd: string;
  totalRides: number;
  totalMiles: number;
  totalPhotos: number;
  totalMembers: number;
  createdAt: string;
}

export interface UserPreferences {
  pushEnabled: boolean;
  announcements: boolean;
  rides: boolean;
  joinRequests: boolean;
}

export interface JoinRequest {
  id: string;
  crewId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  message?: string;
}

export * from './analytics';
