import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../database/connection.js';
import { config } from '../config/index.js';
import { User, JWTPayload, UserRole } from '../types/index.js';
import { logger } from '../utils/logger.js';

const SALT_ROUNDS = 12;

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginResult {
  user: Omit<User, 'passwordHash' | 'mfaSecret'>;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  // Hash password
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate access token
  generateAccessToken(payload: Omit<JWTPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  // Generate refresh token
  generateRefreshToken(payload: Omit<JWTPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  // Verify access token
  verifyAccessToken(token: string): JWTPayload {
    const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return payload;
  }

  // Verify refresh token
  verifyRefreshToken(token: string): JWTPayload {
    const payload = jwt.verify(token, config.jwt.refreshSecret) as JWTPayload;
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return payload;
  }

  // Hash refresh token for storage
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Register new user
  async register(data: RegisterData): Promise<LoginResult> {
    // Check if user exists
    const existingUser = await query<User>(
      'SELECT id FROM users WHERE email = $1',
      [data.email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user
    const result = await query<User>(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, phone, profile_photo, is_active, is_email_verified, mfa_enabled, created_at, updated_at`,
      [data.email.toLowerCase(), passwordHash, data.firstName, data.lastName, data.phone || null]
    );

    const user = result.rows[0];

    // Generate tokens
    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    logger.info(`User registered: ${user.email}`);

    return {
      user: this.formatUser(user),
      accessToken,
      refreshToken,
    };
  }

  // Login user
  async login(email: string, password: string): Promise<LoginResult> {
    // Find user
    const result = await query<User>(
      `SELECT * FROM users WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await this.verifyPassword(password, user.password_hash as unknown as string);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    logger.info(`User logged in: ${user.email}`);

    return {
      user: this.formatUser(user),
      accessToken,
      refreshToken,
    };
  }

  // Refresh tokens
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Verify token
    const payload = this.verifyRefreshToken(refreshToken);

    // Check if token exists and is not revoked
    const tokenHash = this.hashToken(refreshToken);
    const result = await query(
      `SELECT id FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [payload.userId, tokenHash]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired refresh token');
    }

    // Revoke old token
    await query(
      'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
      [tokenHash]
    );

    // Generate new tokens
    const tokenPayload = { userId: payload.userId, email: payload.email };
    const newAccessToken = this.generateAccessToken(tokenPayload);
    const newRefreshToken = this.generateRefreshToken(tokenPayload);

    // Store new refresh token
    await this.storeRefreshToken(payload.userId, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // Logout (revoke refresh token)
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await query(
      'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
      [tokenHash]
    );
    logger.info('User logged out');
  }

  // Logout all sessions
  async logoutAll(userId: string): Promise<void> {
    await query(
      'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
    logger.info(`All sessions revoked for user: ${userId}`);
  }

  // Store refresh token
  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  }

  // Get user by ID
  async getUserById(userId: string): Promise<Omit<User, 'passwordHash' | 'mfaSecret'> | null> {
    const result = await query<User>(
      `SELECT id, email, first_name, last_name, phone, profile_photo, is_active, is_email_verified, mfa_enabled, last_login_at, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatUser(result.rows[0]);
  }

  // Get user roles for an organization
  async getUserRoles(userId: string, organizationId?: string): Promise<UserRole[]> {
    let queryStr = `SELECT role FROM organization_members WHERE user_id = $1 AND is_active = true`;
    const params: string[] = [userId];

    if (organizationId) {
      queryStr += ` AND organization_id = $2`;
      params.push(organizationId);
    }

    const result = await query<{ role: UserRole }>(queryStr, params);
    return result.rows.map(row => row.role);
  }

  // Check if user has role in organization
  async hasRole(userId: string, organizationId: string, roles: UserRole[]): Promise<boolean> {
    const result = await query(
      `SELECT id FROM organization_members
       WHERE user_id = $1 AND organization_id = $2 AND role = ANY($3) AND is_active = true`,
      [userId, organizationId, roles]
    );
    return result.rows.length > 0;
  }

  // Change password
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const result = await query<User>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const isValid = await this.verifyPassword(currentPassword, result.rows[0].password_hash as unknown as string);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newHash = await this.hashPassword(newPassword);
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newHash, userId]
    );

    // Revoke all refresh tokens
    await this.logoutAll(userId);

    logger.info(`Password changed for user: ${userId}`);
  }

  // Format user for response (remove sensitive fields)
  private formatUser(user: User): Omit<User, 'passwordHash' | 'mfaSecret'> {
    return {
      id: user.id,
      email: user.email,
      firstName: (user as Record<string, string>).first_name || user.firstName,
      lastName: (user as Record<string, string>).last_name || user.lastName,
      phone: user.phone,
      profilePhoto: (user as Record<string, string>).profile_photo || user.profilePhoto,
      isActive: (user as Record<string, boolean>).is_active ?? user.isActive,
      isEmailVerified: (user as Record<string, boolean>).is_email_verified ?? user.isEmailVerified,
      mfaEnabled: (user as Record<string, boolean>).mfa_enabled ?? user.mfaEnabled,
      lastLoginAt: (user as Record<string, Date>).last_login_at || user.lastLoginAt,
      createdAt: (user as Record<string, Date>).created_at || user.createdAt,
      updatedAt: (user as Record<string, Date>).updated_at || user.updatedAt,
    };
  }
}

export const authService = new AuthService();
export default authService;
