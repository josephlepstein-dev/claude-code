import { Router, Response } from 'express';
import { body, param, query as queryValidator } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { AuthenticatedRequest, ApiResponse, User } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { validationResult } from 'express-validator';

const router = Router();

// Get user profile
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const result = await query<User>(
      `SELECT id, email, first_name, last_name, phone, profile_photo, is_active, is_email_verified, mfa_enabled, last_login_at, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    logger.error('Get user profile error', { error });
    res.status(500).json({ success: false, message: 'Failed to get user profile' });
  }
});

// Update user profile
router.put(
  '/profile',
  authenticate,
  [
    body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
    body('phone').optional().isMobilePhone('any'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const { firstName, lastName, phone } = req.body;
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (firstName !== undefined) {
        updates.push(`first_name = $${paramIndex++}`);
        values.push(firstName);
      }
      if (lastName !== undefined) {
        updates.push(`last_name = $${paramIndex++}`);
        values.push(lastName);
      }
      if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }

      if (updates.length === 0) {
        res.status(400).json({ success: false, message: 'No fields to update' });
        return;
      }

      values.push(req.user.userId);

      const result = await query<User>(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, email, first_name, last_name, phone, profile_photo, is_active, is_email_verified, mfa_enabled, created_at, updated_at`,
        values
      );

      res.json({
        success: true,
        data: { user: result.rows[0] },
        message: 'Profile updated successfully',
      });
    } catch (error) {
      logger.error('Update user profile error', { error });
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  }
);

// Get user's organizations
router.get('/organizations', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const result = await query(
      `SELECT o.*, om.role, om.joined_at
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1 AND om.is_active = true AND o.is_active = true
       ORDER BY o.name`,
      [req.user.userId]
    );

    res.json({ success: true, data: { organizations: result.rows } });
  } catch (error) {
    logger.error('Get user organizations error', { error });
    res.status(500).json({ success: false, message: 'Failed to get organizations' });
  }
});

export default router;
