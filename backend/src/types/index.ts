import { Request } from 'express';

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

// Eligibility Status
export enum EligibilityStatus {
  ELIGIBLE = 'eligible',
  INELIGIBLE = 'ineligible',
  PENDING = 'pending',
  PROBATION = 'probation'
}

// Academic Status
export enum AcademicStatus {
  GOOD_STANDING = 'good_standing',
  PROBATION = 'probation',
  INELIGIBLE = 'ineligible'
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
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePhoto?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

// Organization Membership
export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  isActive: boolean;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
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
  dateOfBirth: Date;
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
  eligibilityStatus: EligibilityStatus;
  academicStatus: AcademicStatus;
  yearsExperience?: number;
  startDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Emergency Contact
export interface EmergencyContact {
  id: string;
  athleteId: string;
  name: string;
  relationship: string;
  phone1: string;
  phone2?: string;
  email?: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Medical Info
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
  medicalClearanceDate?: Date;
  clearanceDocument?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Guardian Link
export interface GuardianLink {
  id: string;
  athleteId: string;
  userId: string;
  relationship: string;
  isPrimary: boolean;
  canPickup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Event Interface
export interface Event {
  id: string;
  organizationId: string;
  type: EventType;
  title: string;
  description?: string;
  startDateTime: Date;
  endDateTime: Date;
  allDay: boolean;
  locationName?: string;
  locationAddress?: string;
  locationMapLink?: string;
  opponents?: string[];
  weightClasses?: string[];
  rsvpDeadline?: Date;
  transportDepartTime?: Date;
  transportReturnTime?: Date;
  uniform?: string;
  notes?: string;
  isRecurring: boolean;
  recurringPattern?: string;
  parentEventId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Event RSVP
export interface EventRSVP {
  id: string;
  eventId: string;
  athleteId: string;
  status: RSVPStatus;
  respondedBy: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Match Interface
export interface Match {
  id: string;
  eventId: string;
  athleteId: string;
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
  takedowns?: number;
  escapes?: number;
  reversals?: number;
  nearFalls2?: number;
  nearFalls3?: number;
  ridingTime?: string;
  notes?: string;
  videoUrl?: string;
  scoresheetPhoto?: string;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
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
  publishAt?: Date;
  expiresAt?: Date;
  targetRoles?: UserRole[];
  attachments?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Announcement Read Receipt
export interface AnnouncementRead {
  id: string;
  announcementId: string;
  userId: string;
  readAt: Date;
}

// Season Interface
export interface Season {
  id: string;
  organizationId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  weightClasses: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Weight Entry Interface
export interface WeightEntry {
  id: string;
  athleteId: string;
  seasonId?: string;
  weight: number;
  bodyFatPercentage?: number;
  recordedBy: string;
  location?: string;
  isCertified: boolean;
  hydrationStatus?: 'good' | 'concerning' | 'critical';
  notes?: string;
  createdAt: Date;
}

// Audit Log
export interface AuditLog {
  id: string;
  userId: string;
  organizationId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

// Extended Request with User
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
  organizationId?: string;
  userRole?: UserRole;
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

// Pagination Query
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}
