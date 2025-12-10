import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { authService } from '../services/authService.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

class AuthController {
  // Register new user
  async register(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array().map(err => ({
            field: (err as { path?: string }).path || 'unknown',
            message: err.msg,
          })),
        } as ApiResponse);
        return;
      }

      const { email, password, firstName, lastName, phone } = req.body;

      const result = await authService.register({
        email,
        password,
        firstName,
        lastName,
        phone,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Registration successful',
      } as ApiResponse);
    } catch (error) {
      logger.error('Registration error', { error });
      const message = (error as Error).message;

      if (message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message,
        } as ApiResponse);
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
      } as ApiResponse);
    }
  }

  // Login
  async login(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array().map(err => ({
            field: (err as { path?: string }).path || 'unknown',
            message: err.msg,
          })),
        } as ApiResponse);
        return;
      }

      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.json({
        success: true,
        data: result,
        message: 'Login successful',
      } as ApiResponse);
    } catch (error) {
      logger.error('Login error', { error: (error as Error).message });

      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      } as ApiResponse);
    }
  }

  // Refresh tokens
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        } as ApiResponse);
        return;
      }

      const tokens = await authService.refreshTokens(refreshToken);

      res.json({
        success: true,
        data: tokens,
        message: 'Tokens refreshed successfully',
      } as ApiResponse);
    } catch (error) {
      logger.error('Token refresh error', { error: (error as Error).message });

      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      } as ApiResponse);
    }
  }

  // Logout
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      res.json({
        success: true,
        message: 'Logout successful',
      } as ApiResponse);
    } catch (error) {
      logger.error('Logout error', { error });

      // Still return success even if token revocation fails
      res.json({
        success: true,
        message: 'Logout successful',
      } as ApiResponse);
    }
  }

  // Logout all sessions
  async logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        } as ApiResponse);
        return;
      }

      await authService.logoutAll(req.user.userId);

      res.json({
        success: true,
        message: 'All sessions have been logged out',
      } as ApiResponse);
    } catch (error) {
      logger.error('Logout all error', { error });

      res.status(500).json({
        success: false,
        message: 'Failed to logout all sessions',
      } as ApiResponse);
    }
  }

  // Get current user
  async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        } as ApiResponse);
        return;
      }

      const user = await authService.getUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: { user },
      } as ApiResponse);
    } catch (error) {
      logger.error('Get current user error', { error });

      res.status(500).json({
        success: false,
        message: 'Failed to get user information',
      } as ApiResponse);
    }
  }

  // Change password
  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array().map(err => ({
            field: (err as { path?: string }).path || 'unknown',
            message: err.msg,
          })),
        } as ApiResponse);
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        } as ApiResponse);
        return;
      }

      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user.userId, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.',
      } as ApiResponse);
    } catch (error) {
      logger.error('Change password error', { error: (error as Error).message });

      const message = (error as Error).message;
      if (message.includes('incorrect')) {
        res.status(400).json({
          success: false,
          message,
        } as ApiResponse);
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to change password',
      } as ApiResponse);
    }
  }
}

export const authController = new AuthController();
export default authController;
