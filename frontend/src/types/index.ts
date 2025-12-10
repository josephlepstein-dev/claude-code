// User Roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ORGANIZATION_ADMIN = 'organization_admin',
  HEAD_COACH = 'head_coach',
  ASSISTANT_COACH = 'assistant_coach',
  PARENT = 'parent',
  ATHLETE = 'athlete',
  BOARD_MEMBER = 'board_member'
}

// Event Types
export enum EventType {
  PRACTICE = 'practice',
  DUAL_MEET = 'dual_meet',
  TOURNAMENT = 'tournament',
  WEIGH_IN = 'weigh_in',
  TEAM_MEETING = 'team_meeting',
  FUNDRAISER = 'fundraiser',
  SOCIAL = 'social'
}

// Match Results
export enum MatchResult {
  WIN = 'win',
  LOSS = 'loss',
  DRAW = 'draw'
}

export enum WinMethod {
  PIN = 'pin',
  DECISION = 'decision',
  MAJOR_DECISION = 'major',
  TECHNICAL_FALL = 'tech',
  FORFEIT = 'forfeit',
  INJURY_DEFAULT = 'injury',
  DISQUALIFICATION = 'dq'
}

// RSVP Status
export enum RSVPStatus {
  PENDING = 'pending',
  ATTENDING = 'attending',
  NOT_ATTENDING = 'not_attending',
  MAYBE = 'maybe'
}

// User Interface
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePhoto?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Organization Interface
export interface Organization {
  id: string;
  name: string;
  type: 'club' | 'school' | 'program';
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive: boolean;
  role?: UserRole;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Athlete Interface
export interface Athlete {
  id: string;
  organizationId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  nickname?: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  gradeLevel?: number;
  schoolName?: string;
  profilePhoto?: string;
  jerseyNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  weightClass?: string;
  eligibilityStatus: 'eligible' | 'ineligible' | 'pending' | 'probation';
  academicStatus: 'good_standing' | 'probation' | 'ineligible';
  yearsExperience?: number;
  startDate?: string;
  isActive: boolean;
  emergencyContacts?: EmergencyContact[];
  medicalInfo?: MedicalInfo;
  guardians?: Guardian[];
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  id: string;
  athleteId: string;
  name: string;
  relationship: string;
  phone1: string;
  phone2?: string;
  email?: string;
  isPrimary: boolean;
}

export interface MedicalInfo {
  id: string;
  athleteId: string;
  bloodType?: string;
  allergies?: string;
  medications?: string;
  conditions?: string;
  doctorName?: string;
  doctorPhone?: string;
  insuranceProvider?: string;
  policyNumber?: string;
  medicalClearanceDate?: string;
  clearanceDocument?: string;
}

export interface Guardian {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  relationship: string;
  isPrimary: boolean;
}

// Event Interface
export interface Event {
  id: string;
  organizationId: string;
  type: EventType;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  allDay: boolean;
  locationName?: string;
  locationAddress?: string;
  locationMapLink?: string;
  opponents?: string[];
  weightClasses?: string[];
  rsvpDeadline?: string;
  transportDepartTime?: string;
  transportReturnTime?: string;
  uniform?: string;
  notes?: string;
  isRecurring: boolean;
  recurringPattern?: string;
  parentEventId?: string;
  createdBy: string;
  attendingCount?: number;
  rsvps?: EventRSVP[];
  createdAt: string;
  updatedAt: string;
}

export interface EventRSVP {
  id: string;
  eventId: string;
  athleteId: string;
  athleteName?: string;
  status: RSVPStatus;
  notes?: string;
}

// Match Interface
export interface Match {
  id: string;
  eventId: string;
  athleteId: string;
  athleteFirstName?: string;
  athleteLastName?: string;
  opponentName: string;
  opponentTeam?: string;
  weightClass: string;
  matchNumber?: number;
  round?: string;
  mat?: string;
  result: MatchResult;
  winMethod?: WinMethod;
  athleteScore: number;
  opponentScore: number;
  period1AthleteScore?: number;
  period1OpponentScore?: number;
  period2AthleteScore?: number;
  period2OpponentScore?: number;
  period3AthleteScore?: number;
  period3OpponentScore?: number;
  duration?: string;
  takedowns: number;
  escapes: number;
  reversals: number;
  nearFalls2: number;
  nearFalls3: number;
  ridingTime?: string;
  notes?: string;
  videoUrl?: string;
  scoresheetPhoto?: string;
  eventTitle?: string;
  eventType?: EventType;
  eventDate?: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

// Announcement Interface
export interface Announcement {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  category: 'general' | 'practice' | 'schedule' | 'administrative' | 'urgent';
  isUrgent: boolean;
  isPinned: boolean;
  publishAt?: string;
  expiresAt?: string;
  targetRoles?: UserRole[];
  attachments?: string[];
  createdBy: string;
  createdByFirstName?: string;
  createdByLastName?: string;
  readCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Season Interface
export interface Season {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  weightClasses: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Weight Entry Interface
export interface WeightEntry {
  id: string;
  athleteId: string;
  seasonId?: string;
  weight: number;
  bodyFatPercentage?: number;
  recordedBy: string;
  recordedByFirstName?: string;
  recordedByLastName?: string;
  location?: string;
  isCertified: boolean;
  hydrationStatus?: 'good' | 'concerning' | 'critical';
  notes?: string;
  createdAt: string;
}

// Athlete Stats
export interface AthleteStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  pins: number;
  techFalls: number;
  majorDecisions: number;
  decisions: number;
  totalTakedowns: number;
  totalEscapes: number;
  totalReversals: number;
  totalNearFalls2: number;
  totalNearFalls3: number;
  totalPointsScored: number;
  totalPointsAllowed: number;
  winPercentage: number;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
