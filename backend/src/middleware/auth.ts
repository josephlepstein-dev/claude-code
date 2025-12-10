import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import { authService } from '../services/authService.js';
import { logger } from '../utils/logger.js';

// Authentication middleware
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = authService.verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    logger.debug('Authentication failed', { error: (error as Error).message });
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

// Optional authentication (doesn't fail if no token)
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = authService.verifyAccessToken(token);
      req.user = {
        userId: payload.userId,
        email: payload.email,
      };
    }

    next();
  } catch {
    // Continue without authentication
    next();
  }
}

// Organization context middleware
export function withOrganization(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const organizationId = req.headers['x-organization-id'] as string || req.params.organizationId;

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message: 'Organization ID is required',
    });
    return;
  }

  req.organizationId = organizationId;
  next();
}

// Role-based authorization middleware
export function authorize(...allowedRoles: UserRole[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (!req.organizationId) {
        res.status(400).json({
          success: false,
          message: 'Organization context required',
        });
        return;
      }

      // Check if super_admin (has access to everything)
      const userRoles = await authService.getUserRoles(req.user.userId, req.organizationId);

      if (userRoles.includes(UserRole.SUPER_ADMIN)) {
        req.userRole = UserRole.SUPER_ADMIN;
        next();
        return;
      }

      // Check if user has any of the allowed roles
      const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));

      if (!hasAllowedRole) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action',
        });
        return;
      }

      // Set the user's highest role
      req.userRole = userRoles.find(role => allowedRoles.includes(role));
      next();
    } catch (error) {
      logger.error('Authorization error', { error });
      res.status(500).json({
        success: false,
        message: 'Authorization check failed',
      });
    }
  };
}

// Check if user is organization admin or higher
export const isOrgAdmin = authorize(
  UserRole.SUPER_ADMIN,
  UserRole.ORGANIZATION_ADMIN
);

// Check if user is coach or higher
export const isCoach = authorize(
  UserRole.SUPER_ADMIN,
  UserRole.ORGANIZATION_ADMIN,
  UserRole.HEAD_COACH,
  UserRole.ASSISTANT_COACH
);

// Check if user is head coach or higher
export const isHeadCoach = authorize(
  UserRole.SUPER_ADMIN,
  UserRole.ORGANIZATION_ADMIN,
  UserRole.HEAD_COACH
);

// Check if user is any member of the organization
export const isMember = authorize(
  UserRole.SUPER_ADMIN,
  UserRole.ORGANIZATION_ADMIN,
  UserRole.HEAD_COACH,
  UserRole.ASSISTANT_COACH,
  UserRole.PARENT,
  UserRole.ATHLETE,
  UserRole.BOARD_MEMBER
);

export default { authenticate, optionalAuth, withOrganization, authorize };
