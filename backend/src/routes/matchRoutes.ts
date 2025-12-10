import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { AuthenticatedRequest, Match, MatchResult, WinMethod } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { io } from '../index.js';

const router = Router();

// Get matches for an event
router.get(
  '/event/:eventId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId } = req.params;

      const result = await query<Match>(
        `SELECT m.*, a.first_name as athlete_first_name, a.last_name as athlete_last_name
         FROM matches m
         JOIN athletes a ON m.athlete_id = a.id
         WHERE m.event_id = $1
         ORDER BY m.match_number, m.weight_class`,
        [eventId]
      );

      res.json({ success: true, data: { matches: result.rows } });
    } catch (error) {
      logger.error('Get matches error', { error });
      res.status(500).json({ success: false, message: 'Failed to get matches' });
    }
  }
);

// Get matches for an athlete
router.get(
  '/athlete/:athleteId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { athleteId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const result = await query<Match>(
        `SELECT m.*, e.title as event_title, e.type as event_type, e.start_date_time as event_date
         FROM matches m
         JOIN events e ON m.event_id = e.id
         WHERE m.athlete_id = $1
         ORDER BY e.start_date_time DESC
         LIMIT $2`,
        [athleteId, limit]
      );

      res.json({ success: true, data: { matches: result.rows } });
    } catch (error) {
      logger.error('Get athlete matches error', { error });
      res.status(500).json({ success: false, message: 'Failed to get matches' });
    }
  }
);

// Get match by ID
router.get(
  '/:matchId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { matchId } = req.params;

      const result = await query<Match>(
        `SELECT m.*,
         a.first_name as athlete_first_name, a.last_name as athlete_last_name,
         e.title as event_title, e.type as event_type, e.start_date_time as event_date
         FROM matches m
         JOIN athletes a ON m.athlete_id = a.id
         JOIN events e ON m.event_id = e.id
         WHERE m.id = $1`,
        [matchId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Match not found' });
        return;
      }

      res.json({ success: true, data: { match: result.rows[0] } });
    } catch (error) {
      logger.error('Get match error', { error });
      res.status(500).json({ success: false, message: 'Failed to get match' });
    }
  }
);

// Create match
router.post(
  '/',
  authenticate,
  [
    body('eventId').isUUID(),
    body('athleteId').isUUID(),
    body('opponentName').trim().isLength({ min: 1, max: 200 }),
    body('weightClass').trim().isLength({ min: 1, max: 20 }),
    body('result').isIn(Object.values(MatchResult)),
    body('winMethod').optional().isIn(Object.values(WinMethod)),
    body('athleteScore').optional().isInt({ min: 0 }),
    body('opponentScore').optional().isInt({ min: 0 }),
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
        eventId, athleteId, opponentName, opponentTeam, weightClass,
        matchNumber, round, mat, result, winMethod, athleteScore, opponentScore,
        period1AthleteScore, period1OpponentScore, period2AthleteScore, period2OpponentScore,
        period3AthleteScore, period3OpponentScore, duration, takedowns, escapes, reversals,
        nearFalls2, nearFalls3, ridingTime, notes, videoUrl, scoresheetPhoto
      } = req.body;

      const matchResult = await query<Match>(
        `INSERT INTO matches (
          event_id, athlete_id, opponent_name, opponent_team, weight_class,
          match_number, round, mat, result, win_method, athlete_score, opponent_score,
          period1_athlete_score, period1_opponent_score, period2_athlete_score, period2_opponent_score,
          period3_athlete_score, period3_opponent_score, duration, takedowns, escapes, reversals,
          near_falls_2, near_falls_3, riding_time, notes, video_url, scoresheet_photo, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
        RETURNING *`,
        [
          eventId, athleteId, opponentName, opponentTeam, weightClass,
          matchNumber, round, mat, result, winMethod, athleteScore || 0, opponentScore || 0,
          period1AthleteScore, period1OpponentScore, period2AthleteScore, period2OpponentScore,
          period3AthleteScore, period3OpponentScore, duration, takedowns || 0, escapes || 0, reversals || 0,
          nearFalls2 || 0, nearFalls3 || 0, ridingTime, notes, videoUrl, scoresheetPhoto, req.user.userId
        ]
      );

      // Get organization ID for socket notification
      const eventResult = await query(
        'SELECT organization_id FROM events WHERE id = $1',
        [eventId]
      );

      if (eventResult.rows.length > 0) {
        const organizationId = eventResult.rows[0].organization_id;
        // Emit real-time update
        io.to(`org:${organizationId}`).emit('match-recorded', {
          match: matchResult.rows[0],
        });
      }

      res.status(201).json({
        success: true,
        data: { match: matchResult.rows[0] },
        message: 'Match recorded successfully',
      });
    } catch (error) {
      logger.error('Create match error', { error });
      res.status(500).json({ success: false, message: 'Failed to record match' });
    }
  }
);

// Update match
router.put(
  '/:matchId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { matchId } = req.params;
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const allowedFields = [
        'opponent_name', 'opponent_team', 'weight_class', 'match_number', 'round', 'mat',
        'result', 'win_method', 'athlete_score', 'opponent_score',
        'period1_athlete_score', 'period1_opponent_score',
        'period2_athlete_score', 'period2_opponent_score',
        'period3_athlete_score', 'period3_opponent_score',
        'duration', 'takedowns', 'escapes', 'reversals',
        'near_falls_2', 'near_falls_3', 'riding_time', 'notes', 'video_url', 'scoresheet_photo'
      ];

      const fieldMapping: Record<string, string> = {
        opponentName: 'opponent_name',
        opponentTeam: 'opponent_team',
        weightClass: 'weight_class',
        matchNumber: 'match_number',
        winMethod: 'win_method',
        athleteScore: 'athlete_score',
        opponentScore: 'opponent_score',
        period1AthleteScore: 'period1_athlete_score',
        period1OpponentScore: 'period1_opponent_score',
        period2AthleteScore: 'period2_athlete_score',
        period2OpponentScore: 'period2_opponent_score',
        period3AthleteScore: 'period3_athlete_score',
        period3OpponentScore: 'period3_opponent_score',
        nearFalls2: 'near_falls_2',
        nearFalls3: 'near_falls_3',
        ridingTime: 'riding_time',
        videoUrl: 'video_url',
        scoresheetPhoto: 'scoresheet_photo',
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

      values.push(matchId);

      const result = await query<Match>(
        `UPDATE matches SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Match not found' });
        return;
      }

      res.json({
        success: true,
        data: { match: result.rows[0] },
        message: 'Match updated successfully',
      });
    } catch (error) {
      logger.error('Update match error', { error });
      res.status(500).json({ success: false, message: 'Failed to update match' });
    }
  }
);

// Delete match
router.delete(
  '/:matchId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { matchId } = req.params;

      const result = await query(
        'DELETE FROM matches WHERE id = $1 RETURNING id',
        [matchId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Match not found' });
        return;
      }

      res.json({ success: true, message: 'Match deleted successfully' });
    } catch (error) {
      logger.error('Delete match error', { error });
      res.status(500).json({ success: false, message: 'Failed to delete match' });
    }
  }
);

// Bulk create matches (for tournament/dual meet entry)
router.post(
  '/bulk',
  authenticate,
  [
    body('matches').isArray({ min: 1 }),
    body('matches.*.eventId').isUUID(),
    body('matches.*.athleteId').isUUID(),
    body('matches.*.opponentName').trim().isLength({ min: 1 }),
    body('matches.*.weightClass').trim().isLength({ min: 1 }),
    body('matches.*.result').isIn(Object.values(MatchResult)),
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

      const { matches } = req.body;
      const createdMatches: Match[] = [];

      for (const match of matches) {
        const result = await query<Match>(
          `INSERT INTO matches (
            event_id, athlete_id, opponent_name, opponent_team, weight_class,
            match_number, round, result, win_method, athlete_score, opponent_score,
            takedowns, escapes, reversals, notes, recorded_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *`,
          [
            match.eventId, match.athleteId, match.opponentName, match.opponentTeam,
            match.weightClass, match.matchNumber, match.round, match.result,
            match.winMethod, match.athleteScore || 0, match.opponentScore || 0,
            match.takedowns || 0, match.escapes || 0, match.reversals || 0,
            match.notes, req.user.userId
          ]
        );
        createdMatches.push(result.rows[0]);
      }

      res.status(201).json({
        success: true,
        data: { matches: createdMatches },
        message: `${createdMatches.length} matches recorded successfully`,
      });
    } catch (error) {
      logger.error('Bulk create matches error', { error });
      res.status(500).json({ success: false, message: 'Failed to record matches' });
    }
  }
);

export default router;
