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
} from '@mui/material';
import {
  People,
  Event,
  EmojiEvents,
  Announcement,
  TrendingUp,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { eventApi, announcementApi, athleteApi } from '../../services/api';
import { Event as EventType, Announcement as AnnouncementType, Athlete } from '../../types';

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
  const { currentOrganization, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAthletes: 0,
    upcomingEvents: 0,
    unreadAnnouncements: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<EventType[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<AnnouncementType[]>([]);

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

  if (!currentOrganization) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" gutterBottom>
          Welcome to WrestleManager!
        </Typography>
        <Typography color="text.secondary">
          You are not part of any organization yet. Create or join an organization to get started.
        </Typography>
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
                {upcomingEvents.map((event) => (
                  <ListItem key={event.id} divider>
                    <ListItemText
                      primary={event.title}
                      secondary={
                        <>
                          {format(new Date(event.startDateTime), 'MMM d, yyyy h:mm a')}
                          {event.locationName && ` - ${event.locationName}`}
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
                ))}
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
                {recentAnnouncements.map((announcement) => (
                  <ListItem key={announcement.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {announcement.title}
                          {announcement.isUrgent && (
                            <Chip label="Urgent" size="small" color="error" />
                          )}
                        </Box>
                      }
                      secondary={format(new Date(announcement.createdAt), 'MMM d, yyyy')}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
