import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authenticate, withOrganization, isCoach, isMember } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { AuthenticatedRequest, Announcement, UserRole } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { io } from '../index.js';

const router = Router();

// Get announcements for organization
router.get(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.headers['x-organization-id'] as string;
      if (!organizationId) {
        res.status(400).json({ success: false, message: 'Organization ID required' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = (page - 1) * limit;
      const category = req.query.category as string;
      const includeExpired = req.query.includeExpired === 'true';

      let whereClause = `WHERE organization_id = $1 AND (publish_at IS NULL OR publish_at <= CURRENT_TIMESTAMP)`;
      const params: unknown[] = [organizationId];
      let paramIndex = 2;

      if (!includeExpired) {
        whereClause += ` AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)`;
      }

      if (category) {
        whereClause += ` AND category = $${paramIndex++}`;
        params.push(category);
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM announcements ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get announcements
      const result = await query<Announcement>(
        `SELECT a.*,
         u.first_name as created_by_first_name, u.last_name as created_by_last_name,
         (SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.id) as read_count
         FROM announcements a
         LEFT JOIN users u ON a.created_by = u.id
         ${whereClause}
         ORDER BY a.is_pinned DESC, a.is_urgent DESC, a.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      res.json({
        success: true,
        data: { announcements: result.rows },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Get announcements error', { error });
      res.status(500).json({ success: false, message: 'Failed to get announcements' });
    }
  }
);

// Get announcement by ID
router.get(
  '/:announcementId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { announcementId } = req.params;

      const result = await query<Announcement>(
        `SELECT a.*,
         u.first_name as created_by_first_name, u.last_name as created_by_last_name
         FROM announcements a
         LEFT JOIN users u ON a.created_by = u.id
         WHERE a.id = $1`,
        [announcementId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Announcement not found' });
        return;
      }

      // Mark as read if user is authenticated
      if (req.user) {
        await query(
          `INSERT INTO announcement_reads (announcement_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (announcement_id, user_id) DO NOTHING`,
          [announcementId, req.user.userId]
        );
      }

      res.json({ success: true, data: { announcement: result.rows[0] } });
    } catch (error) {
      logger.error('Get announcement error', { error });
      res.status(500).json({ success: false, message: 'Failed to get announcement' });
    }
  }
);

// Create announcement
router.post(
  '/',
  authenticate,
  [
    body('organizationId').isUUID(),
    body('title').trim().isLength({ min: 1, max: 255 }),
    body('content').trim().isLength({ min: 1 }),
    body('category').optional().isIn(['general', 'practice', 'schedule', 'administrative', 'urgent']),
    body('isUrgent').optional().isBoolean(),
    body('isPinned').optional().isBoolean(),
    body('publishAt').optional().isISO8601(),
    body('expiresAt').optional().isISO8601(),
    body('targetRoles').optional().isArray(),
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

      const {
        organizationId, title, content, category, isUrgent, isPinned,
        publishAt, expiresAt, targetRoles, attachments
      } = req.body;

      const result = await query<Announcement>(
        `INSERT INTO announcements (
          organization_id, title, content, category, is_urgent, is_pinned,
          publish_at, expires_at, target_roles, attachments, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          organizationId, title, content, category || 'general',
          isUrgent || false, isPinned || false, publishAt, expiresAt,
          targetRoles || [], attachments || [], req.user.userId
        ]
      );

      // Emit real-time notification if published immediately
      const announcement = result.rows[0];
      if (!publishAt || new Date(publishAt) <= new Date()) {
        io.to(`org:${organizationId}`).emit('new-announcement', {
          announcement,
          isUrgent: isUrgent || false,
        });
      }

      res.status(201).json({
        success: true,
        data: { announcement },
        message: 'Announcement created successfully',
      });
    } catch (error) {
      logger.error('Create announcement error', { error });
      res.status(500).json({ success: false, message: 'Failed to create announcement' });
    }
  }
);

// Update announcement
router.put(
  '/:announcementId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { announcementId } = req.params;
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const allowedFields = [
        'title', 'content', 'category', 'is_urgent', 'is_pinned',
        'publish_at', 'expires_at', 'target_roles', 'attachments'
      ];

      const fieldMapping: Record<string, string> = {
        isUrgent: 'is_urgent',
        isPinned: 'is_pinned',
        publishAt: 'publish_at',
        expiresAt: 'expires_at',
        targetRoles: 'target_roles',
      };

      for (const [key, value] of Object.entries(req.body)) {
        const dbField = fieldMapping[key] || key;
        if (allowedFields.includes(dbField) && value !== undefined) {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(value);
        }
      }

      if (updates.length === 0) {
        res.status(400).json({ success: false, message: 'No fields to update' });
        return;
      }

      values.push(announcementId);

      const result = await query<Announcement>(
        `UPDATE announcements SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Announcement not found' });
        return;
      }

      res.json({
        success: true,
        data: { announcement: result.rows[0] },
        message: 'Announcement updated successfully',
      });
    } catch (error) {
      logger.error('Update announcement error', { error });
      res.status(500).json({ success: false, message: 'Failed to update announcement' });
    }
  }
);

// Delete announcement
router.delete(
  '/:announcementId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { announcementId } = req.params;

      const result = await query(
        'DELETE FROM announcements WHERE id = $1 RETURNING id',
        [announcementId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Announcement not found' });
        return;
      }

      res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (error) {
      logger.error('Delete announcement error', { error });
      res.status(500).json({ success: false, message: 'Failed to delete announcement' });
    }
  }
);

// Mark announcement as read
router.post(
  '/:announcementId/read',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const { announcementId } = req.params;

      await query(
        `INSERT INTO announcement_reads (announcement_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (announcement_id, user_id) DO NOTHING`,
        [announcementId, req.user.userId]
      );

      res.json({ success: true, message: 'Announcement marked as read' });
    } catch (error) {
      logger.error('Mark announcement read error', { error });
      res.status(500).json({ success: false, message: 'Failed to mark announcement as read' });
    }
  }
);

// Get read receipts for announcement
router.get(
  '/:announcementId/reads',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { announcementId } = req.params;

      const result = await query(
        `SELECT ar.read_at, u.id as user_id, u.first_name, u.last_name, u.email
         FROM announcement_reads ar
         JOIN users u ON ar.user_id = u.id
         WHERE ar.announcement_id = $1
         ORDER BY ar.read_at DESC`,
        [announcementId]
      );

      res.json({ success: true, data: { reads: result.rows } });
    } catch (error) {
      logger.error('Get announcement reads error', { error });
      res.status(500).json({ success: false, message: 'Failed to get read receipts' });
    }
  }
);

// Get unread count for user
router.get(
  '/unread/count',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const organizationId = req.headers['x-organization-id'] as string;
      if (!organizationId) {
        res.status(400).json({ success: false, message: 'Organization ID required' });
        return;
      }

      const result = await query(
        `SELECT COUNT(*) FROM announcements a
         WHERE a.organization_id = $1
         AND (a.publish_at IS NULL OR a.publish_at <= CURRENT_TIMESTAMP)
         AND (a.expires_at IS NULL OR a.expires_at >= CURRENT_TIMESTAMP)
         AND NOT EXISTS (
           SELECT 1 FROM announcement_reads ar
           WHERE ar.announcement_id = a.id AND ar.user_id = $2
         )`,
        [organizationId, req.user.userId]
      );

      res.json({
        success: true,
        data: { unreadCount: parseInt(result.rows[0].count) },
      });
    } catch (error) {
      logger.error('Get unread count error', { error });
      res.status(500).json({ success: false, message: 'Failed to get unread count' });
    }
  }
);

export default router;
