import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Autocomplete,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  EmojiEvents,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { matchApi, athleteApi, eventApi } from '../../services/api';
import { Match, Athlete, Event, MatchResult, WinMethod } from '../../types';

interface MatchFormData {
  eventId: string;
  athleteId: string;
  opponentName: string;
  opponentTeam?: string;
  weightClass: string;
  result: MatchResult;
  winMethod?: WinMethod;
  athleteScore: number;
  opponentScore: number;
  takedowns?: number;
  escapes?: number;
  reversals?: number;
  notes?: string;
}

const MatchesPage: React.FC = () => {
  const { currentOrganization } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<MatchFormData>();
  const watchResult = watch('result');

  const loadData = useCallback(async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const [athletesRes, eventsRes] = await Promise.all([
        athleteApi.getAll({ limit: 200 }),
        eventApi.getAll({ limit: 100 }),
      ]);

      if (athletesRes.data.success && athletesRes.data.data) {
        const loadedAthletes = athletesRes.data.data.athletes as Athlete[];
        setAthletes(loadedAthletes);
        if (loadedAthletes.length > 0) {
          setSelectedAthleteId(loadedAthletes[0].id);
        }
      }

      if (eventsRes.data.success && eventsRes.data.data) {
        setEvents(eventsRes.data.data.events as Event[]);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  const loadMatchesForAthlete = useCallback(async () => {
    if (!selectedAthleteId) return;

    try {
      const response = await matchApi.getByAthlete(selectedAthleteId, 50);
      if (response.data.success && response.data.data) {
        setMatches(response.data.data.matches as Match[]);
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedAthleteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadMatchesForAthlete();
  }, [loadMatchesForAthlete]);

  const handleOpenDialog = (match?: Match) => {
    if (match) {
      setSelectedMatch(match);
      reset({
        eventId: match.eventId,
        athleteId: match.athleteId,
        opponentName: match.opponentName,
        opponentTeam: match.opponentTeam,
        weightClass: match.weightClass,
        result: match.result,
        winMethod: match.winMethod,
        athleteScore: match.athleteScore,
        opponentScore: match.opponentScore,
        takedowns: match.takedowns,
        escapes: match.escapes,
        reversals: match.reversals,
        notes: match.notes,
      });
    } else {
      setSelectedMatch(null);
      const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId);
      reset({
        eventId: '',
        athleteId: selectedAthleteId,
        opponentName: '',
        opponentTeam: '',
        weightClass: selectedAthlete?.weightClass || '',
        result: MatchResult.WIN,
        athleteScore: 0,
        opponentScore: 0,
        takedowns: 0,
        escapes: 0,
        reversals: 0,
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedMatch(null);
    reset();
  };

  const onSubmit = async (data: MatchFormData) => {
    try {
      if (selectedMatch) {
        await matchApi.update(selectedMatch.id, data);
      } else {
        await matchApi.create(data);
      }
      handleCloseDialog();
      loadMatchesForAthlete();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm('Are you sure you want to delete this match?')) return;

    try {
      await matchApi.delete(matchId);
      loadMatchesForAthlete();
    } catch (err) {
      console.error(err);
    }
  };

  const getResultColor = (result: MatchResult): 'success' | 'error' | 'default' => {
    switch (result) {
      case MatchResult.WIN:
        return 'success';
      case MatchResult.LOSS:
        return 'error';
      default:
        return 'default';
    }
  };

  const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId);
  const wins = matches.filter((m) => m.result === MatchResult.WIN).length;
  const losses = matches.filter((m) => m.result === MatchResult.LOSS).length;

  if (!currentOrganization) {
    return (
      <Alert severity="info">
        Please select an organization to view matches.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Match Results</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          disabled={!selectedAthleteId}
        >
          Record Match
        </Button>
      </Box>

      {/* Athlete Selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Select Athlete</InputLabel>
              <Select
                value={selectedAthleteId}
                onChange={(e) => setSelectedAthleteId(e.target.value)}
                label="Select Athlete"
              >
                {athletes.map((athlete) => (
                  <MenuItem key={athlete.id} value={athlete.id}>
                    {athlete.firstName} {athlete.lastName} ({athlete.weightClass || 'N/A'})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            {selectedAthlete && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Card variant="outlined" sx={{ minWidth: 120 }}>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Record
                    </Typography>
                    <Typography variant="h6">
                      {wins}-{losses}
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ minWidth: 120 }}>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Win %
                    </Typography>
                    <Typography variant="h6">
                      {matches.length > 0
                        ? ((wins / matches.length) * 100).toFixed(0)
                        : 0}%
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ minWidth: 120 }}>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Pins
                    </Typography>
                    <Typography variant="h6">
                      {matches.filter((m) => m.winMethod === WinMethod.PIN).length}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Opponent</TableCell>
                  <TableCell>Weight</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {matches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        No matches recorded
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  matches.map((match) => (
                    <TableRow key={match.id} hover>
                      <TableCell>
                        {match.eventDate
                          ? format(new Date(match.eventDate), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>{match.eventTitle || '-'}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{match.opponentName}</Typography>
                          {match.opponentTeam && (
                            <Typography variant="caption" color="text.secondary">
                              {match.opponentTeam}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{match.weightClass}</TableCell>
                      <TableCell>
                        <Chip
                          label={match.result.toUpperCase()}
                          size="small"
                          color={getResultColor(match.result)}
                        />
                      </TableCell>
                      <TableCell>
                        {match.athleteScore}-{match.opponentScore}
                      </TableCell>
                      <TableCell>
                        {match.winMethod ? match.winMethod.toUpperCase() : '-'}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpenDialog(match)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteMatch(match.id)}
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Add/Edit Match Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{selectedMatch ? 'Edit Match' : 'Record Match'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="eventId"
                  control={control}
                  rules={{ required: 'Event is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.eventId}>
                      <InputLabel>Event</InputLabel>
                      <Select {...field} label="Event">
                        {events.map((event) => (
                          <MenuItem key={event.id} value={event.id}>
                            {event.title} - {format(new Date(event.startDateTime), 'MMM d, yyyy')}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="opponentName"
                  control={control}
                  rules={{ required: 'Opponent name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Opponent Name"
                      error={!!errors.opponentName}
                      helperText={errors.opponentName?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="opponentTeam"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Opponent Team" />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="weightClass"
                  control={control}
                  rules={{ required: 'Weight class is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.weightClass}>
                      <InputLabel>Weight Class</InputLabel>
                      <Select {...field} label="Weight Class">
                        {['106', '113', '120', '126', '132', '138', '144', '150', '157', '165', '175', '190', '215', '285'].map((wc) => (
                          <MenuItem key={wc} value={wc}>
                            {wc}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="result"
                  control={control}
                  rules={{ required: 'Result is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Result</InputLabel>
                      <Select {...field} label="Result">
                        {Object.values(MatchResult).map((result) => (
                          <MenuItem key={result} value={result}>
                            {result.toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="winMethod"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Win Method</InputLabel>
                      <Select {...field} label="Win Method">
                        <MenuItem value="">None</MenuItem>
                        {Object.values(WinMethod).map((method) => (
                          <MenuItem key={method} value={method}>
                            {method.toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Controller
                  name="athleteScore"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Your Score" type="number" />
                  )}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Controller
                  name="opponentScore"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Opponent Score" type="number" />
                  )}
                />
              </Grid>
              <Grid item xs={4} sm={2}>
                <Controller
                  name="takedowns"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="TDs" type="number" />
                  )}
                />
              </Grid>
              <Grid item xs={4} sm={2}>
                <Controller
                  name="escapes"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Escapes" type="number" />
                  )}
                />
              </Grid>
              <Grid item xs={4} sm={2}>
                <Controller
                  name="reversals"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Reversals" type="number" />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Notes" multiline rows={2} />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedMatch ? 'Save Changes' : 'Record Match'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default MatchesPage;
