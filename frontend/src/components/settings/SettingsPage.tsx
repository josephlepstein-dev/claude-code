import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Tabs,
  Tab,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Person,
  Lock,
  Business,
  GroupAdd,
  Delete,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { userApi, authApi, organizationApi } from '../../services/api';
import { UserRole } from '../../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: '20px' }}>
    {value === index && children}
  </div>
);

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phone: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface OrgFormData {
  name: string;
  type: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

const SettingsPage: React.FC = () => {
  const { user, currentOrganization, refreshUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const profileForm = useForm<ProfileFormData>({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>();

  const orgForm = useForm<OrgFormData>({
    defaultValues: {
      name: currentOrganization?.name || '',
      type: currentOrganization?.type || 'club',
      email: currentOrganization?.email || '',
      phone: currentOrganization?.phone || '',
      address: currentOrganization?.address || '',
      city: currentOrganization?.city || '',
      state: currentOrganization?.state || '',
      zipCode: currentOrganization?.zipCode || '',
    },
  });

  const handleProfileSubmit = async (data: ProfileFormData) => {
    try {
      await userApi.updateProfile(data);
      await refreshUser();
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    }
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    if (data.newPassword !== data.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    try {
      await authApi.changePassword(data.currentPassword, data.newPassword);
      passwordForm.reset();
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to change password. Please check your current password.' });
    }
  };

  const handleOrgSubmit = async (data: OrgFormData) => {
    if (!currentOrganization) return;

    try {
      await organizationApi.update(currentOrganization.id, data);
      await refreshUser();
      setMessage({ type: 'success', text: 'Organization updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update organization' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {message && (
        <Alert
          severity={message.type}
          onClose={() => setMessage(null)}
          sx={{ mb: 2 }}
        >
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<Person />} label="Profile" iconPosition="start" />
          <Tab icon={<Lock />} label="Password" iconPosition="start" />
          {currentOrganization && (
            <Tab icon={<Business />} label="Organization" iconPosition="start" />
          )}
        </Tabs>

        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="firstName"
                  control={profileForm.control}
                  rules={{ required: 'First name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="First Name"
                      error={!!profileForm.formState.errors.firstName}
                      helperText={profileForm.formState.errors.firstName?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="lastName"
                  control={profileForm.control}
                  rules={{ required: 'Last name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Last Name"
                      error={!!profileForm.formState.errors.lastName}
                      helperText={profileForm.formState.errors.lastName?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Email" value={user?.email || ''} disabled />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="phone"
                  control={profileForm.control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Phone" />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained">
                  Save Changes
                </Button>
              </Grid>
            </Grid>
          </form>
        </TabPanel>

        {/* Password Tab */}
        <TabPanel value={tabValue} index={1}>
          <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}>
            <Grid container spacing={2} sx={{ maxWidth: 400 }}>
              <Grid item xs={12}>
                <Controller
                  name="currentPassword"
                  control={passwordForm.control}
                  rules={{ required: 'Current password is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Current Password"
                      type="password"
                      error={!!passwordForm.formState.errors.currentPassword}
                      helperText={passwordForm.formState.errors.currentPassword?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="newPassword"
                  control={passwordForm.control}
                  rules={{
                    required: 'New password is required',
                    minLength: { value: 12, message: 'Min 12 characters' },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="New Password"
                      type="password"
                      error={!!passwordForm.formState.errors.newPassword}
                      helperText={passwordForm.formState.errors.newPassword?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="confirmPassword"
                  control={passwordForm.control}
                  rules={{ required: 'Please confirm password' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Confirm New Password"
                      type="password"
                      error={!!passwordForm.formState.errors.confirmPassword}
                      helperText={passwordForm.formState.errors.confirmPassword?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained">
                  Change Password
                </Button>
              </Grid>
            </Grid>
          </form>
        </TabPanel>

        {/* Organization Tab */}
        {currentOrganization && (
          <TabPanel value={tabValue} index={2}>
            <form onSubmit={orgForm.handleSubmit(handleOrgSubmit)}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="name"
                    control={orgForm.control}
                    rules={{ required: 'Name is required' }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Organization Name"
                        error={!!orgForm.formState.errors.name}
                        helperText={orgForm.formState.errors.name?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="type"
                    control={orgForm.control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select {...field} label="Type">
                          <MenuItem value="club">Club</MenuItem>
                          <MenuItem value="school">School</MenuItem>
                          <MenuItem value="program">Program</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="email"
                    control={orgForm.control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Email" type="email" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="phone"
                    control={orgForm.control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Phone" />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="address"
                    control={orgForm.control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Address" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="city"
                    control={orgForm.control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="City" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="state"
                    control={orgForm.control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="State" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="zipCode"
                    control={orgForm.control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="ZIP Code" />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button type="submit" variant="contained">
                    Save Organization
                  </Button>
                </Grid>
              </Grid>
            </form>
          </TabPanel>
        )}
      </Paper>
    </Box>
  );
};

export default SettingsPage;
