import { Router, Response } from 'express';
import { body, param, query as queryValidator } from 'express-validator';
import { validationResult } from 'express-validator';
import { authenticate, withOrganization, isCoach, isMember } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { AuthenticatedRequest, Event, EventType, RSVPStatus } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get events for organization
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

      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const type = req.query.type as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE organization_id = $1';
      const params: unknown[] = [organizationId];
      let paramIndex = 2;

      if (startDate) {
        whereClause += ` AND start_date_time >= $${paramIndex++}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND start_date_time <= $${paramIndex++}`;
        params.push(endDate);
      }

      if (type) {
        whereClause += ` AND type = $${paramIndex++}`;
        params.push(type);
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM events ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get events
      const result = await query<Event>(
        `SELECT e.*,
         (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND status = 'attending') as attending_count
         FROM events e
         ${whereClause}
         ORDER BY start_date_time ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      res.json({
        success: true,
        data: { events: result.rows },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Get events error', { error });
      res.status(500).json({ success: false, message: 'Failed to get events' });
    }
  }
);

// Get event by ID
router.get(
  '/:eventId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId } = req.params;

      const result = await query<Event>(
        `SELECT e.*,
         (SELECT json_agg(json_build_object(
           'id', er.id, 'athleteId', er.athlete_id, 'status', er.status, 'notes', er.notes,
           'athleteName', a.first_name || ' ' || a.last_name
         ))
         FROM event_rsvps er
         JOIN athletes a ON er.athlete_id = a.id
         WHERE er.event_id = e.id) as rsvps
         FROM events e
         WHERE e.id = $1`,
        [eventId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Event not found' });
        return;
      }

      res.json({ success: true, data: { event: result.rows[0] } });
    } catch (error) {
      logger.error('Get event error', { error });
      res.status(500).json({ success: false, message: 'Failed to get event' });
    }
  }
);

// Create event
router.post(
  '/',
  authenticate,
  [
    body('organizationId').isUUID(),
    body('type').isIn(Object.values(EventType)),
    body('title').trim().isLength({ min: 1, max: 255 }),
    body('startDateTime').isISO8601(),
    body('endDateTime').isISO8601(),
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
        organizationId, type, title, description, startDateTime, endDateTime,
        allDay, locationName, locationAddress, locationMapLink, opponents,
        weightClasses, rsvpDeadline, transportDepartTime, transportReturnTime,
        uniform, notes, isRecurring, recurringPattern
      } = req.body;

      const result = await query<Event>(
        `INSERT INTO events (
          organization_id, type, title, description, start_date_time, end_date_time,
          all_day, location_name, location_address, location_map_link, opponents,
          weight_classes, rsvp_deadline, transport_depart_time, transport_return_time,
          uniform, notes, is_recurring, recurring_pattern, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *`,
        [
          organizationId, type, title, description, startDateTime, endDateTime,
          allDay || false, locationName, locationAddress, locationMapLink, opponents || [],
          weightClasses || [], rsvpDeadline, transportDepartTime, transportReturnTime,
          uniform, notes, isRecurring || false, recurringPattern, req.user.userId
        ]
      );

      res.status(201).json({
        success: true,
        data: { event: result.rows[0] },
        message: 'Event created successfully',
      });
    } catch (error) {
      logger.error('Create event error', { error });
      res.status(500).json({ success: false, message: 'Failed to create event' });
    }
  }
);

// Update event
router.put(
  '/:eventId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId } = req.params;
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const allowedFields = [
        'type', 'title', 'description', 'start_date_time', 'end_date_time',
        'all_day', 'location_name', 'location_address', 'location_map_link',
        'opponents', 'weight_classes', 'rsvp_deadline', 'transport_depart_time',
        'transport_return_time', 'uniform', 'notes'
      ];

      const fieldMapping: Record<string, string> = {
        startDateTime: 'start_date_time',
        endDateTime: 'end_date_time',
        allDay: 'all_day',
        locationName: 'location_name',
        locationAddress: 'location_address',
        locationMapLink: 'location_map_link',
        weightClasses: 'weight_classes',
        rsvpDeadline: 'rsvp_deadline',
        transportDepartTime: 'transport_depart_time',
        transportReturnTime: 'transport_return_time',
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

      values.push(eventId);

      const result = await query<Event>(
        `UPDATE events SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Event not found' });
        return;
      }

      res.json({
        success: true,
        data: { event: result.rows[0] },
        message: 'Event updated successfully',
      });
    } catch (error) {
      logger.error('Update event error', { error });
      res.status(500).json({ success: false, message: 'Failed to update event' });
    }
  }
);

// Delete event
router.delete(
  '/:eventId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId } = req.params;

      const result = await query(
        'DELETE FROM events WHERE id = $1 RETURNING id',
        [eventId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Event not found' });
        return;
      }

      res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
      logger.error('Delete event error', { error });
      res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
  }
);

// RSVP to event
router.post(
  '/:eventId/rsvp',
  authenticate,
  [
    body('athleteId').isUUID(),
    body('status').isIn(Object.values(RSVPStatus)),
    body('notes').optional().trim(),
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

      const { eventId } = req.params;
      const { athleteId, status, notes } = req.body;

      const result = await query(
        `INSERT INTO event_rsvps (event_id, athlete_id, status, responded_by, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id, athlete_id) DO UPDATE SET
           status = EXCLUDED.status,
           responded_by = EXCLUDED.responded_by,
           notes = EXCLUDED.notes
         RETURNING *`,
        [eventId, athleteId, status, req.user.userId, notes]
      );

      res.json({
        success: true,
        data: { rsvp: result.rows[0] },
        message: 'RSVP updated successfully',
      });
    } catch (error) {
      logger.error('RSVP error', { error });
      res.status(500).json({ success: false, message: 'Failed to update RSVP' });
    }
  }
);

// Get event RSVPs
router.get(
  '/:eventId/rsvps',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId } = req.params;

      const result = await query(
        `SELECT er.*, a.first_name, a.last_name, a.weight_class
         FROM event_rsvps er
         JOIN athletes a ON er.athlete_id = a.id
         WHERE er.event_id = $1
         ORDER BY a.last_name, a.first_name`,
        [eventId]
      );

      res.json({ success: true, data: { rsvps: result.rows } });
    } catch (error) {
      logger.error('Get RSVPs error', { error });
      res.status(500).json({ success: false, message: 'Failed to get RSVPs' });
    }
  }
);

// Get upcoming events for calendar
router.get(
  '/calendar/upcoming',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.headers['x-organization-id'] as string;
      if (!organizationId) {
        res.status(400).json({ success: false, message: 'Organization ID required' });
        return;
      }

      const days = parseInt(req.query.days as string) || 30;

      const result = await query<Event>(
        `SELECT * FROM events
         WHERE organization_id = $1
         AND start_date_time >= CURRENT_TIMESTAMP
         AND start_date_time <= CURRENT_TIMESTAMP + INTERVAL '1 day' * $2
         ORDER BY start_date_time ASC`,
        [organizationId, days]
      );

      res.json({ success: true, data: { events: result.rows } });
    } catch (error) {
      logger.error('Get upcoming events error', { error });
      res.status(500).json({ success: false, message: 'Failed to get upcoming events' });
    }
  }
);

export default router;
