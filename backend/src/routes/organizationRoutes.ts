import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authenticate, withOrganization, isOrgAdmin, isMember } from '../middleware/auth.js';
import { query, withTransaction } from '../database/connection.js';
import { AuthenticatedRequest, ApiResponse, Organization, UserRole } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Create organization
router.post(
  '/',
  authenticate,
  [
    body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Organization name is required'),
    body('type').isIn(['club', 'school', 'program']).withMessage('Invalid organization type'),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone('any'),
    body('website').optional().isURL(),
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

      const { name, type, address, city, state, zipCode, phone, email, website, logo, primaryColor, secondaryColor } = req.body;

      const result = await withTransaction(async (client) => {
        // Create organization
        const orgResult = await client.query<Organization>(
          `INSERT INTO organizations (name, type, address, city, state, zip_code, phone, email, website, logo, primary_color, secondary_color)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [name, type, address, city, state, zipCode, phone, email, website, logo, primaryColor, secondaryColor]
        );

        const org = orgResult.rows[0];

        // Add creator as organization admin
        await client.query(
          `INSERT INTO organization_members (user_id, organization_id, role)
           VALUES ($1, $2, $3)`,
          [req.user!.userId, org.id, UserRole.ORGANIZATION_ADMIN]
        );

        return org;
      });

      res.status(201).json({
        success: true,
        data: { organization: result },
        message: 'Organization created successfully',
      });
    } catch (error) {
      logger.error('Create organization error', { error });
      res.status(500).json({ success: false, message: 'Failed to create organization' });
    }
  }
);

// Get organization by ID
router.get(
  '/:organizationId',
  authenticate,
  withOrganization,
  isMember,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await query<Organization>(
        'SELECT * FROM organizations WHERE id = $1 AND is_active = true',
        [req.organizationId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Organization not found' });
        return;
      }

      res.json({ success: true, data: { organization: result.rows[0] } });
    } catch (error) {
      logger.error('Get organization error', { error });
      res.status(500).json({ success: false, message: 'Failed to get organization' });
    }
  }
);

// Update organization
router.put(
  '/:organizationId',
  authenticate,
  withOrganization,
  isOrgAdmin,
  [
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('type').optional().isIn(['club', 'school', 'program']),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone('any'),
    body('website').optional().isURL(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { name, type, address, city, state, zipCode, phone, email, website, logo, primaryColor, secondaryColor } = req.body;
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fields = { name, type, address, city, state, zip_code: zipCode, phone, email, website, logo, primary_color: primaryColor, secondary_color: secondaryColor };

      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          updates.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      }

      if (updates.length === 0) {
        res.status(400).json({ success: false, message: 'No fields to update' });
        return;
      }

      values.push(req.organizationId);

      const result = await query<Organization>(
        `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      res.json({
        success: true,
        data: { organization: result.rows[0] },
        message: 'Organization updated successfully',
      });
    } catch (error) {
      logger.error('Update organization error', { error });
      res.status(500).json({ success: false, message: 'Failed to update organization' });
    }
  }
);

// Get organization members
router.get(
  '/:organizationId/members',
  authenticate,
  withOrganization,
  isMember,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.profile_photo, om.role, om.joined_at
         FROM users u
         JOIN organization_members om ON u.id = om.user_id
         WHERE om.organization_id = $1 AND om.is_active = true AND u.is_active = true
         ORDER BY om.role, u.last_name, u.first_name`,
        [req.organizationId]
      );

      res.json({ success: true, data: { members: result.rows } });
    } catch (error) {
      logger.error('Get organization members error', { error });
      res.status(500).json({ success: false, message: 'Failed to get members' });
    }
  }
);

// Add member to organization
router.post(
  '/:organizationId/members',
  authenticate,
  withOrganization,
  isOrgAdmin,
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('role').isIn(Object.values(UserRole)).withMessage('Invalid role'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { userId, role } = req.body;

      // Check if already a member
      const existing = await query(
        'SELECT id FROM organization_members WHERE user_id = $1 AND organization_id = $2 AND role = $3',
        [userId, req.organizationId, role]
      );

      if (existing.rows.length > 0) {
        res.status(409).json({ success: false, message: 'User already has this role in the organization' });
        return;
      }

      await query(
        `INSERT INTO organization_members (user_id, organization_id, role)
         VALUES ($1, $2, $3)`,
        [userId, req.organizationId, role]
      );

      res.status(201).json({
        success: true,
        message: 'Member added successfully',
      });
    } catch (error) {
      logger.error('Add organization member error', { error });
      res.status(500).json({ success: false, message: 'Failed to add member' });
    }
  }
);

// Remove member from organization
router.delete(
  '/:organizationId/members/:userId',
  authenticate,
  withOrganization,
  isOrgAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;

      await query(
        'UPDATE organization_members SET is_active = false WHERE user_id = $1 AND organization_id = $2',
        [userId, req.organizationId]
      );

      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      logger.error('Remove organization member error', { error });
      res.status(500).json({ success: false, message: 'Failed to remove member' });
    }
  }
);

// Get organization seasons
router.get(
  '/:organizationId/seasons',
  authenticate,
  withOrganization,
  isMember,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT * FROM seasons WHERE organization_id = $1 ORDER BY start_date DESC`,
        [req.organizationId]
      );

      res.json({ success: true, data: { seasons: result.rows } });
    } catch (error) {
      logger.error('Get seasons error', { error });
      res.status(500).json({ success: false, message: 'Failed to get seasons' });
    }
  }
);

// Create season
router.post(
  '/:organizationId/seasons',
  authenticate,
  withOrganization,
  isOrgAdmin,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('weightClasses').optional().isArray(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { name, startDate, endDate, weightClasses, isActive } = req.body;

      const result = await query(
        `INSERT INTO seasons (organization_id, name, start_date, end_date, weight_classes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.organizationId, name, startDate, endDate, weightClasses || [], isActive !== false]
      );

      res.status(201).json({
        success: true,
        data: { season: result.rows[0] },
        message: 'Season created successfully',
      });
    } catch (error) {
      logger.error('Create season error', { error });
      res.status(500).json({ success: false, message: 'Failed to create season' });
    }
  }
);

export default router;
