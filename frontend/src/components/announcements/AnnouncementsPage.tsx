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
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PushPin,
  Warning,
  Visibility,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { announcementApi } from '../../services/api';
import { Announcement } from '../../types';

interface AnnouncementFormData {
  title: string;
  content: string;
  category: 'general' | 'practice' | 'schedule' | 'administrative' | 'urgent';
  isUrgent: boolean;
  isPinned: boolean;
}

const categoryColors: Record<string, { bg: string; color: string }> = {
  general: { bg: '#E3F2FD', color: '#1565C0' },
  practice: { bg: '#E8F5E9', color: '#2E7D32' },
  schedule: { bg: '#FFF3E0', color: '#EF6C00' },
  administrative: { bg: '#F3E5F5', color: '#7B1FA2' },
  urgent: { bg: '#FFEBEE', color: '#C62828' },
};

const AnnouncementsPage: React.FC = () => {
  const { currentOrganization, user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const { control, handleSubmit, reset, formState: { errors } } = useForm<AnnouncementFormData>();

  const loadAnnouncements = useCallback(async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const response = await announcementApi.getAll({
        category: filterCategory || undefined,
        limit: 50,
      });

      if (response.data.success && response.data.data) {
        setAnnouncements(response.data.data.announcements as Announcement[]);
      }
    } catch (err) {
      setError('Failed to load announcements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, filterCategory]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleOpenDialog = (announcement?: Announcement) => {
    if (announcement) {
      setSelectedAnnouncement(announcement);
      reset({
        title: announcement.title,
        content: announcement.content,
        category: announcement.category,
        isUrgent: announcement.isUrgent,
        isPinned: announcement.isPinned,
      });
    } else {
      setSelectedAnnouncement(null);
      reset({
        title: '',
        content: '',
        category: 'general',
        isUrgent: false,
        isPinned: false,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedAnnouncement(null);
    reset();
  };

  const handleViewAnnouncement = async (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setViewDialogOpen(true);

    // Mark as read
    try {
      await announcementApi.markRead(announcement.id);
    } catch {
      // Ignore errors
    }
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setSelectedAnnouncement(null);
  };

  const onSubmit = async (data: AnnouncementFormData) => {
    if (!currentOrganization) return;

    try {
      if (selectedAnnouncement) {
        await announcementApi.update(selectedAnnouncement.id, data);
      } else {
        await announcementApi.create({
          ...data,
          organizationId: currentOrganization.id,
        });
      }
      handleCloseDialog();
      loadAnnouncements();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
      await announcementApi.delete(announcementId);
      loadAnnouncements();
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentOrganization) {
    return (
      <Alert severity="info">
        Please select an organization to view announcements.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Announcements</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          New Announcement
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="practice">Practice</MenuItem>
                <MenuItem value="schedule">Schedule</MenuItem>
                <MenuItem value="administrative">Administrative</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : announcements.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No announcements yet
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {announcements.map((announcement) => (
            <Grid item xs={12} key={announcement.id}>
              <Card
                sx={{
                  borderLeft: announcement.isUrgent ? '4px solid #C62828' : 'none',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {announcement.isPinned && (
                          <PushPin fontSize="small" color="primary" />
                        )}
                        {announcement.isUrgent && (
                          <Warning fontSize="small" color="error" />
                        )}
                        <Chip
                          label={announcement.category}
                          size="small"
                          sx={{
                            backgroundColor: categoryColors[announcement.category]?.bg,
                            color: categoryColors[announcement.category]?.color,
                          }}
                        />
                      </Box>
                      <Typography variant="h6">{announcement.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {announcement.content.length > 200
                          ? `${announcement.content.substring(0, 200)}...`
                          : announcement.content}
                      </Typography>
                      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Posted by {announcement.createdByFirstName} {announcement.createdByLastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(announcement.createdAt), 'MMM d, yyyy h:mm a')}
                        </Typography>
                        {announcement.readCount !== undefined && (
                          <Chip
                            label={`${announcement.readCount} read`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<Visibility />}
                    onClick={() => handleViewAnnouncement(announcement)}
                  >
                    View
                  </Button>
                  <IconButton size="small" onClick={() => handleOpenDialog(announcement)}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteAnnouncement(announcement.id)}
                    color="error"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedAnnouncement ? 'Edit Announcement' : 'New Announcement'}
        </DialogTitle>
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
                      label="Title"
                      error={!!errors.title}
                      helperText={errors.title?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select {...field} label="Category">
                        <MenuItem value="general">General</MenuItem>
                        <MenuItem value="practice">Practice</MenuItem>
                        <MenuItem value="schedule">Schedule</MenuItem>
                        <MenuItem value="administrative">Administrative</MenuItem>
                        <MenuItem value="urgent">Urgent</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Controller
                  name="isUrgent"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Urgent"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Controller
                  name="isPinned"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Pinned"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="content"
                  control={control}
                  rules={{ required: 'Content is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Content"
                      multiline
                      rows={6}
                      error={!!errors.content}
                      helperText={errors.content?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedAnnouncement ? 'Save Changes' : 'Post Announcement'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={handleCloseViewDialog} maxWidth="md" fullWidth>
        {selectedAnnouncement && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedAnnouncement.isPinned && (
                  <PushPin fontSize="small" color="primary" />
                )}
                {selectedAnnouncement.isUrgent && (
                  <Warning fontSize="small" color="error" />
                )}
                {selectedAnnouncement.title}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={selectedAnnouncement.category}
                  size="small"
                  sx={{
                    backgroundColor: categoryColors[selectedAnnouncement.category]?.bg,
                    color: categoryColors[selectedAnnouncement.category]?.color,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  Posted by {selectedAnnouncement.createdByFirstName}{' '}
                  {selectedAnnouncement.createdByLastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(selectedAnnouncement.createdAt), 'MMM d, yyyy h:mm a')}
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography style={{ whiteSpace: 'pre-wrap' }}>
                {selectedAnnouncement.content}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseViewDialog}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AnnouncementsPage;
