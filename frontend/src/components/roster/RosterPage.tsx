import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  InputAdornment,
  Avatar,
} from '@mui/material';
import {
  Add,
  Search,
  Edit,
  Visibility,
  FilterList,
} from '@mui/icons-material';
import { format, differenceInYears } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { athleteApi } from '../../services/api';
import { Athlete } from '../../types';

interface AthleteFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  gradeLevel?: number;
  schoolName?: string;
  email?: string;
  phone?: string;
  weightClass?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

const RosterPage: React.FC = () => {
  const { currentOrganization } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWeightClass, setFilterWeightClass] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<AthleteFormData>();

  const loadAthletes = useCallback(async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const response = await athleteApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery || undefined,
        weightClass: filterWeightClass || undefined,
      });

      if (response.data.success && response.data.data) {
        setAthletes(response.data.data.athletes as Athlete[]);
        if (response.data.pagination) {
          setTotalCount(response.data.pagination.total);
        }
      }
    } catch (err) {
      setError('Failed to load athletes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, page, rowsPerPage, searchQuery, filterWeightClass]);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenDialog = (athlete?: Athlete) => {
    if (athlete) {
      setSelectedAthlete(athlete);
      reset({
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        dateOfBirth: athlete.dateOfBirth.split('T')[0],
        gender: athlete.gender,
        gradeLevel: athlete.gradeLevel,
        schoolName: athlete.schoolName,
        email: athlete.email,
        phone: athlete.phone,
        weightClass: athlete.weightClass,
        address: athlete.address,
        city: athlete.city,
        state: athlete.state,
        zipCode: athlete.zipCode,
      });
    } else {
      setSelectedAthlete(null);
      reset({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: 'male',
        gradeLevel: undefined,
        schoolName: '',
        email: '',
        phone: '',
        weightClass: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedAthlete(null);
    reset();
  };

  const onSubmit = async (data: AthleteFormData) => {
    if (!currentOrganization) return;

    try {
      if (selectedAthlete) {
        await athleteApi.update(selectedAthlete.id, data);
      } else {
        await athleteApi.create({
          ...data,
          organizationId: currentOrganization.id,
        });
      }
      handleCloseDialog();
      loadAthletes();
    } catch (err) {
      console.error(err);
    }
  };

  const getAge = (dateOfBirth: string): number => {
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  const getEligibilityColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case 'eligible':
        return 'success';
      case 'ineligible':
        return 'error';
      case 'probation':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (!currentOrganization) {
    return (
      <Alert severity="info">
        Please select an organization to view the roster.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Roster</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Athlete
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              placeholder="Search athletes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Weight Class</InputLabel>
              <Select
                value={filterWeightClass}
                onChange={(e) => setFilterWeightClass(e.target.value)}
                label="Weight Class"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="106">106</MenuItem>
                <MenuItem value="113">113</MenuItem>
                <MenuItem value="120">120</MenuItem>
                <MenuItem value="126">126</MenuItem>
                <MenuItem value="132">132</MenuItem>
                <MenuItem value="138">138</MenuItem>
                <MenuItem value="144">144</MenuItem>
                <MenuItem value="150">150</MenuItem>
                <MenuItem value="157">157</MenuItem>
                <MenuItem value="165">165</MenuItem>
                <MenuItem value="175">175</MenuItem>
                <MenuItem value="190">190</MenuItem>
                <MenuItem value="215">215</MenuItem>
                <MenuItem value="285">285</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Athletes Table */}
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
                  <TableCell>Name</TableCell>
                  <TableCell>Age</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>Weight Class</TableCell>
                  <TableCell>Eligibility</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {athletes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        No athletes found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  athletes.map((athlete) => (
                    <TableRow key={athlete.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {athlete.firstName[0]}{athlete.lastName[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {athlete.firstName} {athlete.lastName}
                            </Typography>
                            {athlete.nickname && (
                              <Typography variant="caption" color="text.secondary">
                                "{athlete.nickname}"
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{getAge(athlete.dateOfBirth)}</TableCell>
                      <TableCell>{athlete.gradeLevel || '-'}</TableCell>
                      <TableCell>{athlete.weightClass || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={athlete.eligibilityStatus}
                          size="small"
                          color={getEligibilityColor(athlete.eligibilityStatus)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{athlete.email || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {athlete.phone || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpenDialog(athlete)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{selectedAthlete ? 'Edit Athlete' : 'Add Athlete'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="firstName"
                  control={control}
                  rules={{ required: 'First name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="First Name"
                      error={!!errors.firstName}
                      helperText={errors.firstName?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="lastName"
                  control={control}
                  rules={{ required: 'Last name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Last Name"
                      error={!!errors.lastName}
                      helperText={errors.lastName?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="dateOfBirth"
                  control={control}
                  rules={{ required: 'Date of birth is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Date of Birth"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.dateOfBirth}
                      helperText={errors.dateOfBirth?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="gender"
                  control={control}
                  rules={{ required: 'Gender is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Gender</InputLabel>
                      <Select {...field} label="Gender">
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="gradeLevel"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Grade Level</InputLabel>
                      <Select {...field} label="Grade Level">
                        {[...Array(12)].map((_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>
                            {i + 1}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="weightClass"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
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
              <Grid item xs={12} sm={6}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Email" type="email" />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Phone" />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="schoolName"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="School Name" />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedAthlete ? 'Save Changes' : 'Add Athlete'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default RosterPage;
