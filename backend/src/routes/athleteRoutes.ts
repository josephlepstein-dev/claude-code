import { Router, Response } from 'express';
import { body, param, query as queryValidator } from 'express-validator';
import { validationResult } from 'express-validator';
import { authenticate, withOrganization, isCoach, isMember } from '../middleware/auth.js';
import { query, withTransaction } from '../database/connection.js';
import { AuthenticatedRequest, Athlete, PaginationQuery } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get all athletes for organization
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
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;
      const search = req.query.search as string;
      const weightClass = req.query.weightClass as string;
      const isActive = req.query.isActive !== 'false';

      let whereClause = 'WHERE organization_id = $1 AND is_active = $2';
      const params: unknown[] = [organizationId, isActive];
      let paramIndex = 3;

      if (search) {
        whereClause += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR nickname ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (weightClass) {
        whereClause += ` AND weight_class = $${paramIndex}`;
        params.push(weightClass);
        paramIndex++;
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM athletes ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get athletes
      const result = await query<Athlete>(
        `SELECT * FROM athletes ${whereClause}
         ORDER BY last_name, first_name
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      res.json({
        success: true,
        data: { athletes: result.rows },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Get athletes error', { error });
      res.status(500).json({ success: false, message: 'Failed to get athletes' });
    }
  }
);

// Get athlete by ID
router.get(
  '/:athleteId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { athleteId } = req.params;

      const result = await query<Athlete>(
        `SELECT a.*,
         (SELECT json_agg(ec.*) FROM emergency_contacts ec WHERE ec.athlete_id = a.id) as emergency_contacts,
         (SELECT row_to_json(mi.*) FROM medical_info mi WHERE mi.athlete_id = a.id) as medical_info,
         (SELECT json_agg(json_build_object('id', u.id, 'email', u.email, 'firstName', u.first_name, 'lastName', u.last_name, 'relationship', gl.relationship, 'isPrimary', gl.is_primary))
          FROM guardian_links gl JOIN users u ON gl.user_id = u.id WHERE gl.athlete_id = a.id) as guardians
         FROM athletes a WHERE a.id = $1`,
        [athleteId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Athlete not found' });
        return;
      }

      res.json({ success: true, data: { athlete: result.rows[0] } });
    } catch (error) {
      logger.error('Get athlete error', { error });
      res.status(500).json({ success: false, message: 'Failed to get athlete' });
    }
  }
);

// Create athlete
router.post(
  '/',
  authenticate,
  [
    body('organizationId').isUUID(),
    body('firstName').trim().isLength({ min: 1, max: 100 }),
    body('lastName').trim().isLength({ min: 1, max: 100 }),
    body('dateOfBirth').isISO8601(),
    body('gender').isIn(['male', 'female', 'other']),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone('any'),
    body('gradeLevel').optional().isInt({ min: 1, max: 12 }),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const {
        organizationId, firstName, lastName, middleName, nickname,
        dateOfBirth, gender, gradeLevel, schoolName, profilePhoto,
        jerseyNumber, email, phone, address, city, state, zipCode,
        weightClass, eligibilityStatus, academicStatus, yearsExperience, startDate
      } = req.body;

      const result = await query<Athlete>(
        `INSERT INTO athletes (
          organization_id, first_name, last_name, middle_name, nickname,
          date_of_birth, gender, grade_level, school_name, profile_photo,
          jersey_number, email, phone, address, city, state, zip_code,
          weight_class, eligibility_status, academic_status, years_experience, start_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *`,
        [
          organizationId, firstName, lastName, middleName, nickname,
          dateOfBirth, gender, gradeLevel, schoolName, profilePhoto,
          jerseyNumber, email, phone, address, city, state, zipCode,
          weightClass, eligibilityStatus || 'pending', academicStatus || 'good_standing',
          yearsExperience || 0, startDate
        ]
      );

      res.status(201).json({
        success: true,
        data: { athlete: result.rows[0] },
        message: 'Athlete created successfully',
      });
    } catch (error) {
      logger.error('Create athlete error', { error });
      res.status(500).json({ success: false, message: 'Failed to create athlete' });
    }
  }
);

// Update athlete
router.put(
  '/:athleteId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { athleteId } = req.params;
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const allowedFields = [
        'first_name', 'last_name', 'middle_name', 'nickname', 'date_of_birth',
        'gender', 'grade_level', 'school_name', 'profile_photo', 'jersey_number',
        'email', 'phone', 'address', 'city', 'state', 'zip_code', 'weight_class',
        'eligibility_status', 'academic_status', 'years_experience', 'start_date', 'is_active'
      ];

      const fieldMapping: Record<string, string> = {
        firstName: 'first_name',
        lastName: 'last_name',
        middleName: 'middle_name',
        dateOfBirth: 'date_of_birth',
        gradeLevel: 'grade_level',
        schoolName: 'school_name',
        profilePhoto: 'profile_photo',
        jerseyNumber: 'jersey_number',
        zipCode: 'zip_code',
        weightClass: 'weight_class',
        eligibilityStatus: 'eligibility_status',
        academicStatus: 'academic_status',
        yearsExperience: 'years_experience',
        startDate: 'start_date',
        isActive: 'is_active',
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

      values.push(athleteId);

      const result = await query<Athlete>(
        `UPDATE athletes SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Athlete not found' });
        return;
      }

      res.json({
        success: true,
        data: { athlete: result.rows[0] },
        message: 'Athlete updated successfully',
      });
    } catch (error) {
      logger.error('Update athlete error', { error });
      res.status(500).json({ success: false, message: 'Failed to update athlete' });
    }
  }
);

// Add emergency contact
router.post(
  '/:athleteId/emergency-contacts',
  authenticate,
  [
    body('name').trim().isLength({ min: 1, max: 200 }),
    body('relationship').trim().isLength({ min: 1, max: 50 }),
    body('phone1').isMobilePhone('any'),
    body('phone2').optional().isMobilePhone('any'),
    body('email').optional().isEmail(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { athleteId } = req.params;
      const { name, relationship, phone1, phone2, email, isPrimary } = req.body;

      const result = await query(
        `INSERT INTO emergency_contacts (athlete_id, name, relationship, phone1, phone2, email, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [athleteId, name, relationship, phone1, phone2, email, isPrimary || false]
      );

      res.status(201).json({
        success: true,
        data: { emergencyContact: result.rows[0] },
        message: 'Emergency contact added successfully',
      });
    } catch (error) {
      logger.error('Add emergency contact error', { error });
      res.status(500).json({ success: false, message: 'Failed to add emergency contact' });
    }
  }
);

// Update medical info
router.put(
  '/:athleteId/medical-info',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { athleteId } = req.params;
      const {
        bloodType, allergies, medications, conditions,
        doctorName, doctorPhone, insuranceProvider, policyNumber,
        medicalClearanceDate, clearanceDocument
      } = req.body;

      const result = await query(
        `INSERT INTO medical_info (
          athlete_id, blood_type, allergies, medications, conditions,
          doctor_name, doctor_phone, insurance_provider, policy_number,
          medical_clearance_date, clearance_document
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (athlete_id) DO UPDATE SET
          blood_type = EXCLUDED.blood_type,
          allergies = EXCLUDED.allergies,
          medications = EXCLUDED.medications,
          conditions = EXCLUDED.conditions,
          doctor_name = EXCLUDED.doctor_name,
          doctor_phone = EXCLUDED.doctor_phone,
          insurance_provider = EXCLUDED.insurance_provider,
          policy_number = EXCLUDED.policy_number,
          medical_clearance_date = EXCLUDED.medical_clearance_date,
          clearance_document = EXCLUDED.clearance_document
        RETURNING *`,
        [
          athleteId, bloodType, allergies, medications, conditions,
          doctorName, doctorPhone, insuranceProvider, policyNumber,
          medicalClearanceDate, clearanceDocument
        ]
      );

      res.json({
        success: true,
        data: { medicalInfo: result.rows[0] },
        message: 'Medical info updated successfully',
      });
    } catch (error) {
      logger.error('Update medical info error', { error });
      res.status(500).json({ success: false, message: 'Failed to update medical info' });
    }
  }
);

// Add weight entry
router.post(
  '/:athleteId/weight-entries',
  authenticate,
  [
    body('weight').isFloat({ min: 50, max: 400 }),
    body('bodyFatPercentage').optional().isFloat({ min: 0, max: 100 }),
    body('location').optional().trim(),
    body('isCertified').optional().isBoolean(),
    body('hydrationStatus').optional().isIn(['good', 'concerning', 'critical']),
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

      const { athleteId } = req.params;
      const { weight, bodyFatPercentage, seasonId, location, isCertified, hydrationStatus, notes } = req.body;

      const result = await query(
        `INSERT INTO weight_entries (athlete_id, season_id, weight, body_fat_percentage, recorded_by, location, is_certified, hydration_status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [athleteId, seasonId, weight, bodyFatPercentage, req.user.userId, location, isCertified || false, hydrationStatus, notes]
      );

      res.status(201).json({
        success: true,
        data: { weightEntry: result.rows[0] },
        message: 'Weight entry recorded successfully',
      });
    } catch (error) {
      logger.error('Add weight entry error', { error });
      res.status(500).json({ success: false, message: 'Failed to record weight entry' });
    }
  }
);

// Get weight history
router.get(
  '/:athleteId/weight-entries',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { athleteId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const result = await query(
        `SELECT we.*, u.first_name as recorded_by_first_name, u.last_name as recorded_by_last_name
         FROM weight_entries we
         LEFT JOIN users u ON we.recorded_by = u.id
         WHERE we.athlete_id = $1
         ORDER BY we.created_at DESC
         LIMIT $2`,
        [athleteId, limit]
      );

      res.json({ success: true, data: { weightEntries: result.rows } });
    } catch (error) {
      logger.error('Get weight history error', { error });
      res.status(500).json({ success: false, message: 'Failed to get weight history' });
    }
  }
);

// Get athlete statistics
router.get(
  '/:athleteId/stats',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { athleteId } = req.params;
      const seasonId = req.query.seasonId as string;

      let matchFilter = 'WHERE m.athlete_id = $1';
      const params: unknown[] = [athleteId];

      if (seasonId) {
        matchFilter += ` AND e.id IN (SELECT id FROM events WHERE organization_id IN (SELECT organization_id FROM seasons WHERE id = $2))`;
        params.push(seasonId);
      }

      const result = await query(
        `SELECT
          COUNT(*) as total_matches,
          COUNT(*) FILTER (WHERE result = 'win') as wins,
          COUNT(*) FILTER (WHERE result = 'loss') as losses,
          COUNT(*) FILTER (WHERE result = 'draw') as draws,
          COUNT(*) FILTER (WHERE win_method = 'pin') as pins,
          COUNT(*) FILTER (WHERE win_method = 'tech') as tech_falls,
          COUNT(*) FILTER (WHERE win_method = 'major') as major_decisions,
          COUNT(*) FILTER (WHERE win_method = 'decision') as decisions,
          SUM(takedowns) as total_takedowns,
          SUM(escapes) as total_escapes,
          SUM(reversals) as total_reversals,
          SUM(near_falls_2) as total_near_falls_2,
          SUM(near_falls_3) as total_near_falls_3,
          SUM(athlete_score) as total_points_scored,
          SUM(opponent_score) as total_points_allowed
         FROM matches m
         JOIN events e ON m.event_id = e.id
         ${matchFilter}`,
        params
      );

      const stats = result.rows[0] as Record<string, string>;
      const totalMatches = parseInt(stats.total_matches) || 0;
      const wins = parseInt(stats.wins) || 0;

      res.json({
        success: true,
        data: {
          stats: {
            ...stats,
            winPercentage: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0,
          },
        },
      });
    } catch (error) {
      logger.error('Get athlete stats error', { error });
      res.status(500).json({ success: false, message: 'Failed to get athlete statistics' });
    }
  }
);

export default router;
