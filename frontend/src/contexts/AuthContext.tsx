import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Organization, LoginCredentials, RegisterData } from '../types';
import { authApi, userApi, setTokens, clearTokens, getTokens, setOrganizationId, getOrganizationId } from '../services/api';

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const { accessToken } = getTokens();
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      const [userResponse, orgsResponse] = await Promise.all([
        authApi.me(),
        userApi.getOrganizations(),
      ]);

      if (userResponse.data.success && userResponse.data.data) {
        setUser(userResponse.data.data.user as User);
      }

      if (orgsResponse.data.success && orgsResponse.data.data) {
        const orgs = orgsResponse.data.data.organizations as Organization[];
        setOrganizations(orgs);

        // Restore current organization from localStorage
        const savedOrgId = getOrganizationId();
        if (savedOrgId) {
          const savedOrg = orgs.find(o => o.id === savedOrgId);
          if (savedOrg) {
            setCurrentOrg(savedOrg);
          } else if (orgs.length > 0) {
            setCurrentOrg(orgs[0]);
            setOrganizationId(orgs[0].id);
          }
        } else if (orgs.length > 0) {
          setCurrentOrg(orgs[0]);
          setOrganizationId(orgs[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (credentials: LoginCredentials) => {
    const response = await authApi.login(credentials.email, credentials.password);

    if (response.data.success && response.data.data) {
      const { user: userData, accessToken, refreshToken } = response.data.data;
      setTokens(accessToken, refreshToken);
      setUser(userData as User);

      // Load organizations
      const orgsResponse = await userApi.getOrganizations();
      if (orgsResponse.data.success && orgsResponse.data.data) {
        const orgs = orgsResponse.data.data.organizations as Organization[];
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setCurrentOrg(orgs[0]);
          setOrganizationId(orgs[0].id);
        }
      }
    } else {
      throw new Error(response.data.message || 'Login failed');
    }
  };

  const register = async (data: RegisterData) => {
    const response = await authApi.register(data);

    if (response.data.success && response.data.data) {
      const { user: userData, accessToken, refreshToken } = response.data.data;
      setTokens(accessToken, refreshToken);
      setUser(userData as User);
    } else {
      throw new Error(response.data.message || 'Registration failed');
    }
  };

  const logout = async () => {
    const { refreshToken } = getTokens();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Ignore logout errors
      }
    }

    clearTokens();
    setOrganizationId(null);
    setUser(null);
    setOrganizations([]);
    setCurrentOrg(null);
  };

  const setCurrentOrganization = (org: Organization | null) => {
    setCurrentOrg(org);
    setOrganizationId(org?.id || null);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  const value: AuthContextType = {
    user,
    organizations,
    currentOrganization,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    setCurrentOrganization,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
