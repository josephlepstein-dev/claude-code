import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  People,
  Event,
  EmojiEvents,
  Announcement,
  Add,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { eventApi, announcementApi, athleteApi, organizationApi } from '../../services/api';
import { Event as EventType, Announcement as AnnouncementType } from '../../types';

// Helper to get date field (handles both snake_case and camelCase from API)
const getDateField = (obj: Record<string, unknown>, camelCase: string, snakeCase: string): string | null => {
  const value = obj[camelCase] || obj[snakeCase];
  return value ? String(value) : null;
};

const getStringField = (obj: Record<string, unknown>, camelCase: string, snakeCase: string): string | undefined => {
  const value = obj[camelCase] || obj[snakeCase];
  return value ? String(value) : undefined;
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography color="text.secondary" variant="body2" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div" fontWeight="bold">
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            backgroundColor: `${color}15`,
            color: color,
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const DashboardPage: React.FC = () => {
  const { currentOrganization, user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAthletes: 0,
    upcomingEvents: 0,
    unreadAnnouncements: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<EventType[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<AnnouncementType[]>([]);

  // Create organization dialog state
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [createOrgLoading, setCreateOrgLoading] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: '',
    type: 'club' as 'club' | 'school' | 'program',
    email: '',
    phone: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!currentOrganization) {
        setLoading(false);
        return;
      }

      try {
        const [athletesRes, eventsRes, announcementsRes, unreadRes] = await Promise.all([
          athleteApi.getAll({ limit: 1 }),
          eventApi.getUpcoming(14),
          announcementApi.getAll({ limit: 5 }),
          announcementApi.getUnreadCount(),
        ]);

        if (athletesRes.data.success && athletesRes.data.pagination) {
          setStats((prev) => ({ ...prev, totalAthletes: athletesRes.data.pagination!.total }));
        }

        if (eventsRes.data.success && eventsRes.data.data) {
          const events = eventsRes.data.data.events as EventType[];
          setUpcomingEvents(events.slice(0, 5));
          setStats((prev) => ({ ...prev, upcomingEvents: events.length }));
        }

        if (announcementsRes.data.success && announcementsRes.data.data) {
          setRecentAnnouncements(announcementsRes.data.data.announcements as AnnouncementType[]);
        }

        if (unreadRes.data.success && unreadRes.data.data) {
          setStats((prev) => ({ ...prev, unreadAnnouncements: unreadRes.data.data!.unreadCount }));
        }
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [currentOrganization]);

  const handleCreateOrganization = async () => {
    if (!orgForm.name.trim()) {
      setCreateOrgError('Organization name is required');
      return;
    }

    setCreateOrgLoading(true);
    setCreateOrgError(null);

    try {
      const response = await organizationApi.create({
        name: orgForm.name.trim(),
        type: orgForm.type,
        email: orgForm.email || undefined,
        phone: orgForm.phone || undefined,
        city: orgForm.city || undefined,
        state: orgForm.state || undefined,
      });

      if (response.data.success) {
        setCreateOrgOpen(false);
        setOrgForm({ name: '', type: 'club', email: '', phone: '', city: '', state: '' });
        // Refresh user data to load the new organization
        await refreshUser();
      } else {
        setCreateOrgError(response.data.message || 'Failed to create organization');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setCreateOrgError(error.response?.data?.message || 'Failed to create organization');
    } finally {
      setCreateOrgLoading(false);
    }
  };

  if (!currentOrganization) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h5" gutterBottom>
          Welcome to WrestleManager!
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          You are not part of any organization yet. Create an organization to get started.
        </Typography>

        <Button
          variant="contained"
          size="large"
          startIcon={<Add />}
          onClick={() => setCreateOrgOpen(true)}
        >
          Create Organization
        </Button>

        {/* Create Organization Dialog */}
        <Dialog open={createOrgOpen} onClose={() => setCreateOrgOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogContent>
            {createOrgError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createOrgError}
              </Alert>
            )}
            <TextField
              autoFocus
              margin="dense"
              label="Organization Name"
              fullWidth
              required
              value={orgForm.name}
              onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
              sx={{ mt: 1 }}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Organization Type</InputLabel>
              <Select
                value={orgForm.type}
                label="Organization Type"
                onChange={(e) => setOrgForm({ ...orgForm, type: e.target.value as 'club' | 'school' | 'program' })}
              >
                <MenuItem value="club">Club</MenuItem>
                <MenuItem value="school">School</MenuItem>
                <MenuItem value="program">Program</MenuItem>
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Email"
              type="email"
              fullWidth
              value={orgForm.email}
              onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Phone"
              fullWidth
              value={orgForm.phone}
              onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  margin="dense"
                  label="City"
                  fullWidth
                  value={orgForm.city}
                  onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  margin="dense"
                  label="State"
                  fullWidth
                  value={orgForm.state}
                  onChange={(e) => setOrgForm({ ...orgForm, state: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOrgOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateOrganization}
              variant="contained"
              disabled={createOrgLoading}
            >
              {createOrgLoading ? <CircularProgress size={24} /> : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const eventTypeColors: Record<string, string> = {
    practice: '#4CAF50',
    dual_meet: '#2196F3',
    tournament: '#FF9800',
    weigh_in: '#9C27B0',
    team_meeting: '#607D8B',
    fundraiser: '#E91E63',
    social: '#00BCD4',
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.firstName}!
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Here's what's happening with {currentOrganization.name}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Athletes"
            value={stats.totalAthletes}
            icon={<People />}
            color="#2196F3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Upcoming Events"
            value={stats.upcomingEvents}
            icon={<Event />}
            color="#4CAF50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Unread Announcements"
            value={stats.unreadAnnouncements}
            icon={<Announcement />}
            color="#FF9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Season Record"
            value="--"
            icon={<EmojiEvents />}
            color="#9C27B0"
          />
        </Grid>

        {/* Upcoming Events */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Upcoming Events
            </Typography>
            {upcomingEvents.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No upcoming events
              </Typography>
            ) : (
              <List>
                {upcomingEvents.map((event) => {
                  const eventObj = event as unknown as Record<string, unknown>;
                  const startDate = getDateField(eventObj, 'startDateTime', 'start_date_time');
                  const locationName = getStringField(eventObj, 'locationName', 'location_name');
                  return (
                    <ListItem key={event.id} divider>
                      <ListItemText
                        primary={event.title}
                        secondary={
                          <>
                            {startDate ? format(new Date(startDate), 'MMM d, yyyy h:mm a') : 'No date'}
                            {locationName && ` - ${locationName}`}
                          </>
                        }
                      />
                      <Chip
                        label={event.type.replace('_', ' ')}
                        size="small"
                        sx={{
                          backgroundColor: `${eventTypeColors[event.type]}20`,
                          color: eventTypeColors[event.type],
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Recent Announcements */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Recent Announcements
            </Typography>
            {recentAnnouncements.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No announcements
              </Typography>
            ) : (
              <List>
                {recentAnnouncements.map((announcement) => {
                  const announcementObj = announcement as unknown as Record<string, unknown>;
                  const createdAt = getDateField(announcementObj, 'createdAt', 'created_at');
                  const isUrgent = announcementObj['isUrgent'] || announcementObj['is_urgent'];
                  return (
                    <ListItem key={announcement.id} divider>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {announcement.title}
                            {isUrgent && (
                              <Chip label="Urgent" size="small" color="error" />
                            )}
                          </Box>
                        }
                        secondary={createdAt ? format(new Date(createdAt), 'MMM d, yyyy') : 'No date'}
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
