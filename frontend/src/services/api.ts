import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '../types';

const API_BASE_URL = '/api/v1';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setTokens = (access: string, refresh: string): void => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
};

export const getTokens = (): { accessToken: string | null; refreshToken: string | null } => {
  if (!accessToken) {
    accessToken = localStorage.getItem('accessToken');
  }
  if (!refreshToken) {
    refreshToken = localStorage.getItem('refreshToken');
  }
  return { accessToken, refreshToken };
};

export const clearTokens = (): void => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Organization context
let currentOrganizationId: string | null = null;

export const setOrganizationId = (orgId: string | null): void => {
  currentOrganizationId = orgId;
  if (orgId) {
    localStorage.setItem('organizationId', orgId);
  } else {
    localStorage.removeItem('organizationId');
  }
};

export const getOrganizationId = (): string | null => {
  if (!currentOrganizationId) {
    currentOrganizationId = localStorage.getItem('organizationId');
  }
  return currentOrganizationId;
};

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = getTokens();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const orgId = getOrganizationId();
    if (orgId) {
      config.headers['X-Organization-Id'] = orgId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { refreshToken: currentRefreshToken } = getTokens();
      if (currentRefreshToken) {
        try {
          const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken: currentRefreshToken }
          );

          if (response.data.success && response.data.data) {
            setTokens(response.data.data.accessToken, response.data.data.refreshToken);
            originalRequest.headers.Authorization = `Bearer ${response.data.data.accessToken}`;
            return api(originalRequest);
          }
        } catch {
          clearTokens();
          window.location.href = '/login';
        }
      } else {
        clearTokens();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ user: unknown; accessToken: string; refreshToken: string }>>('/auth/login', { email, password }),

  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    api.post<ApiResponse<{ user: unknown; accessToken: string; refreshToken: string }>>('/auth/register', data),

  logout: (refreshToken: string) =>
    api.post<ApiResponse>('/auth/logout', { refreshToken }),

  me: () =>
    api.get<ApiResponse<{ user: unknown }>>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ApiResponse>('/auth/change-password', { currentPassword, newPassword }),
};

// User API
export const userApi = {
  getProfile: () =>
    api.get<ApiResponse<{ user: unknown }>>('/users/profile'),

  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string }) =>
    api.put<ApiResponse<{ user: unknown }>>('/users/profile', data),

  getOrganizations: () =>
    api.get<ApiResponse<{ organizations: unknown[] }>>('/users/organizations'),
};

// Organization API
export const organizationApi = {
  create: (data: unknown) =>
    api.post<ApiResponse<{ organization: unknown }>>('/organizations', data),

  get: (id: string) =>
    api.get<ApiResponse<{ organization: unknown }>>(`/organizations/${id}`),

  update: (id: string, data: unknown) =>
    api.put<ApiResponse<{ organization: unknown }>>(`/organizations/${id}`, data),

  getMembers: (id: string) =>
    api.get<ApiResponse<{ members: unknown[] }>>(`/organizations/${id}/members`),

  addMember: (orgId: string, userId: string, role: string) =>
    api.post<ApiResponse>(`/organizations/${orgId}/members`, { userId, role }),

  removeMember: (orgId: string, userId: string) =>
    api.delete<ApiResponse>(`/organizations/${orgId}/members/${userId}`),

  getSeasons: (id: string) =>
    api.get<ApiResponse<{ seasons: unknown[] }>>(`/organizations/${id}/seasons`),

  createSeason: (id: string, data: unknown) =>
    api.post<ApiResponse<{ season: unknown }>>(`/organizations/${id}/seasons`, data),
};

// Athlete API
export const athleteApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; weightClass?: string; isActive?: boolean }) =>
    api.get<ApiResponse<{ athletes: unknown[] }>>('/athletes', { params }),

  get: (id: string) =>
    api.get<ApiResponse<{ athlete: unknown }>>(`/athletes/${id}`),

  create: (data: unknown) =>
    api.post<ApiResponse<{ athlete: unknown }>>('/athletes', data),

  update: (id: string, data: unknown) =>
    api.put<ApiResponse<{ athlete: unknown }>>(`/athletes/${id}`, data),

  addEmergencyContact: (athleteId: string, data: unknown) =>
    api.post<ApiResponse<{ emergencyContact: unknown }>>(`/athletes/${athleteId}/emergency-contacts`, data),

  updateMedicalInfo: (athleteId: string, data: unknown) =>
    api.put<ApiResponse<{ medicalInfo: unknown }>>(`/athletes/${athleteId}/medical-info`, data),

  addWeightEntry: (athleteId: string, data: unknown) =>
    api.post<ApiResponse<{ weightEntry: unknown }>>(`/athletes/${athleteId}/weight-entries`, data),

  getWeightHistory: (athleteId: string, limit?: number) =>
    api.get<ApiResponse<{ weightEntries: unknown[] }>>(`/athletes/${athleteId}/weight-entries`, { params: { limit } }),

  getStats: (athleteId: string, seasonId?: string) =>
    api.get<ApiResponse<{ stats: unknown }>>(`/athletes/${athleteId}/stats`, { params: { seasonId } }),
};

// Event API
export const eventApi = {
  getAll: (params?: { startDate?: string; endDate?: string; type?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<{ events: unknown[] }>>('/events', { params }),

  get: (id: string) =>
    api.get<ApiResponse<{ event: unknown }>>(`/events/${id}`),

  create: (data: unknown) =>
    api.post<ApiResponse<{ event: unknown }>>('/events', data),

  update: (id: string, data: unknown) =>
    api.put<ApiResponse<{ event: unknown }>>(`/events/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse>(`/events/${id}`),

  rsvp: (eventId: string, athleteId: string, status: string, notes?: string) =>
    api.post<ApiResponse<{ rsvp: unknown }>>(`/events/${eventId}/rsvp`, { athleteId, status, notes }),

  getRsvps: (eventId: string) =>
    api.get<ApiResponse<{ rsvps: unknown[] }>>(`/events/${eventId}/rsvps`),

  getUpcoming: (days?: number) =>
    api.get<ApiResponse<{ events: unknown[] }>>('/events/calendar/upcoming', { params: { days } }),
};

// Match API
export const matchApi = {
  getByEvent: (eventId: string) =>
    api.get<ApiResponse<{ matches: unknown[] }>>(`/matches/event/${eventId}`),

  getByAthlete: (athleteId: string, limit?: number) =>
    api.get<ApiResponse<{ matches: unknown[] }>>(`/matches/athlete/${athleteId}`, { params: { limit } }),

  get: (id: string) =>
    api.get<ApiResponse<{ match: unknown }>>(`/matches/${id}`),

  create: (data: unknown) =>
    api.post<ApiResponse<{ match: unknown }>>('/matches', data),

  update: (id: string, data: unknown) =>
    api.put<ApiResponse<{ match: unknown }>>(`/matches/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse>(`/matches/${id}`),

  bulkCreate: (matches: unknown[]) =>
    api.post<ApiResponse<{ matches: unknown[] }>>('/matches/bulk', { matches }),
};

// Announcement API
export const announcementApi = {
  getAll: (params?: { page?: number; limit?: number; category?: string; includeExpired?: boolean }) =>
    api.get<ApiResponse<{ announcements: unknown[] }>>('/announcements', { params }),

  get: (id: string) =>
    api.get<ApiResponse<{ announcement: unknown }>>(`/announcements/${id}`),

  create: (data: unknown) =>
    api.post<ApiResponse<{ announcement: unknown }>>('/announcements', data),

  update: (id: string, data: unknown) =>
    api.put<ApiResponse<{ announcement: unknown }>>(`/announcements/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse>(`/announcements/${id}`),

  markRead: (id: string) =>
    api.post<ApiResponse>(`/announcements/${id}/read`),

  getReadReceipts: (id: string) =>
    api.get<ApiResponse<{ reads: unknown[] }>>(`/announcements/${id}/reads`),

  getUnreadCount: () =>
    api.get<ApiResponse<{ unreadCount: number }>>('/announcements/unread/count'),
};
