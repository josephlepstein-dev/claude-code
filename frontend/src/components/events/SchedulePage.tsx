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
  Card,
  CardContent,
  CardActions,
  IconButton,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  LocationOn,
  CalendarMonth,
  ViewList,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { eventApi } from '../../services/api';
import { Event, EventType } from '../../types';

interface EventFormData {
  title: string;
  type: EventType;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  locationName?: string;
  locationAddress?: string;
  uniform?: string;
  notes?: string;
}

const eventTypeColors: Record<string, { bg: string; color: string }> = {
  practice: { bg: '#E8F5E9', color: '#2E7D32' },
  dual_meet: { bg: '#E3F2FD', color: '#1565C0' },
  tournament: { bg: '#FFF3E0', color: '#EF6C00' },
  weigh_in: { bg: '#F3E5F5', color: '#7B1FA2' },
  team_meeting: { bg: '#ECEFF1', color: '#455A64' },
  fundraiser: { bg: '#FCE4EC', color: '#C2185B' },
  social: { bg: '#E0F7FA', color: '#00838F' },
};

const SchedulePage: React.FC = () => {
  const { currentOrganization } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<EventFormData>();

  const loadEvents = useCallback(async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const response = await eventApi.getAll({
        startDate,
        endDate,
        limit: 100,
      });

      if (response.data.success && response.data.data) {
        setEvents(response.data.data.events as Event[]);
      }
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, currentMonth]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleOpenDialog = (event?: Event) => {
    if (event) {
      setSelectedEvent(event);
      reset({
        title: event.title,
        type: event.type,
        description: event.description,
        startDateTime: event.startDateTime.slice(0, 16),
        endDateTime: event.endDateTime.slice(0, 16),
        locationName: event.locationName,
        locationAddress: event.locationAddress,
        uniform: event.uniform,
        notes: event.notes,
      });
    } else {
      setSelectedEvent(null);
      reset({
        title: '',
        type: EventType.PRACTICE,
        description: '',
        startDateTime: '',
        endDateTime: '',
        locationName: '',
        locationAddress: '',
        uniform: '',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedEvent(null);
    reset();
  };

  const onSubmit = async (data: EventFormData) => {
    if (!currentOrganization) return;

    try {
      if (selectedEvent) {
        await eventApi.update(selectedEvent.id, data);
      } else {
        await eventApi.create({
          ...data,
          organizationId: currentOrganization.id,
        });
      }
      handleCloseDialog();
      loadEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await eventApi.delete(eventId);
      loadEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  // Add padding days for the calendar grid
  const firstDayOfWeek = calendarDays[0].getDay();
  const paddingDays = Array(firstDayOfWeek).fill(null);

  const getEventsForDay = (date: Date): Event[] => {
    return events.filter((event) => isSameDay(new Date(event.startDateTime), date));
  };

  if (!currentOrganization) {
    return (
      <Alert severity="info">
        Please select an organization to view the schedule.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Schedule</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, v) => v && setView(v)}
            size="small"
          >
            <ToggleButton value="calendar">
              <CalendarMonth />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewList />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Event
          </Button>
        </Box>
      </Box>

      {/* Month Navigation */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6">
            {format(currentMonth, 'MMMM yyyy')}
          </Typography>
          <IconButton onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight />
          </IconButton>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : view === 'calendar' ? (
        /* Calendar View */
        <Paper sx={{ p: 2 }}>
          <Grid container>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Grid item xs={12 / 7} key={day}>
                <Box sx={{ p: 1, textAlign: 'center', fontWeight: 'bold' }}>
                  {day}
                </Box>
              </Grid>
            ))}
            {paddingDays.map((_, index) => (
              <Grid item xs={12 / 7} key={`padding-${index}`}>
                <Box sx={{ p: 1, minHeight: 100 }} />
              </Grid>
            ))}
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              return (
                <Grid item xs={12 / 7} key={day.toISOString()}>
                  <Box
                    sx={{
                      p: 1,
                      minHeight: 100,
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: isToday(day) ? 'primary.light' : 'transparent',
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={isToday(day) ? 'bold' : 'normal'}
                      color={isToday(day) ? 'primary.contrastText' : 'text.primary'}
                    >
                      {format(day, 'd')}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {dayEvents.slice(0, 3).map((event) => (
                        <Chip
                          key={event.id}
                          label={event.title}
                          size="small"
                          sx={{
                            mb: 0.5,
                            width: '100%',
                            justifyContent: 'flex-start',
                            backgroundColor: eventTypeColors[event.type]?.bg,
                            color: eventTypeColors[event.type]?.color,
                            fontSize: '0.7rem',
                          }}
                          onClick={() => handleOpenDialog(event)}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{dayEvents.length - 3} more
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      ) : (
        /* List View */
        <Grid container spacing={2}>
          {events.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No events this month
                </Typography>
              </Paper>
            </Grid>
          ) : (
            events.map((event) => (
              <Grid item xs={12} md={6} key={event.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Chip
                          label={event.type.replace('_', ' ')}
                          size="small"
                          sx={{
                            mb: 1,
                            backgroundColor: eventTypeColors[event.type]?.bg,
                            color: eventTypeColors[event.type]?.color,
                          }}
                        />
                        <Typography variant="h6">{event.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(event.startDateTime), 'MMM d, yyyy h:mm a')}
                        </Typography>
                      </Box>
                    </Box>
                    {event.locationName && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <LocationOn fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                          {event.locationName}
                        </Typography>
                      </Box>
                    )}
                    {event.description && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {event.description}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    <IconButton size="small" onClick={() => handleOpenDialog(event)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteEvent(event.id)} color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{selectedEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="title"
                  control={control}
                  rules={{ required: 'Title is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Event Title"
                      error={!!errors.title}
                      helperText={errors.title?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="type"
                  control={control}
                  rules={{ required: 'Event type is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Event Type</InputLabel>
                      <Select {...field} label="Event Type">
                        {Object.values(EventType).map((type) => (
                          <MenuItem key={type} value={type}>
                            {type.replace('_', ' ')}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="uniform"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Uniform/Attire" />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="startDateTime"
                  control={control}
                  rules={{ required: 'Start date/time is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Start Date/Time"
                      type="datetime-local"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.startDateTime}
                      helperText={errors.startDateTime?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="endDateTime"
                  control={control}
                  rules={{ required: 'End date/time is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="End Date/Time"
                      type="datetime-local"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.endDateTime}
                      helperText={errors.endDateTime?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="locationName"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Location Name" />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="locationAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Address" />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Description" multiline rows={3} />
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
              {selectedEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default SchedulePage;
