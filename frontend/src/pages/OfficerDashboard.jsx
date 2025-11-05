import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MapPin, CheckCircle2, Circle, LogOut, Navigation, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function OfficerDashboard({ user, onLogout }) {
  const [todayData, setTodayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [notes, setNotes] = useState('');
  const [openDialog, setOpenDialog] = useState(false);

  const token = localStorage.getItem('token');
  const config = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchTodayRoute();
  }, []);

  const fetchTodayRoute = async () => {
    try {
      const response = await axios.get(`${API}/route-assignments/today`, config);
      setTodayData(response.data);
    } catch (error) {
      console.error('Failed to fetch today\'s route:', error);
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedPoint) return;

    setLoading(true);
    try {
      await axios.post(
        `${API}/attendance`,
        {
          route_assignment_id: todayData.assignment.id,
          patrol_point_id: selectedPoint.id,
          notes: notes || null
        },
        config
      );
      toast.success(`Attendance marked at ${selectedPoint.name}`);
      setNotes('');
      setSelectedPoint(null);
      setOpenDialog(false);
      fetchTodayRoute();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const openAttendanceDialog = (point) => {
    if (point.completed) {
      toast.info('Attendance already marked for this point');
      return;
    }
    setSelectedPoint(point);
    setOpenDialog(true);
  };

  const completedCount = todayData?.patrol_points?.filter((p) => p.completed).length || 0;
  const totalCount = todayData?.patrol_points?.length || 0;
  const nextPoint = todayData?.patrol_points?.find((p) => !p.completed);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Officer Dashboard</h1>
              <p className="text-sm text-gray-600">
                {user.full_name} {user.badge_number && `• Badge #${user.badge_number}`}
              </p>
            </div>
          </div>
          <Button
            onClick={onLogout}
            data-testid="logout-button"
            variant="outline"
            className="hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!todayData || todayData.message ? (
          <Card className="shadow-lg border-0">
            <CardContent className="py-12 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Route Assigned</h2>
              <p className="text-gray-500">You don't have a patrol route assigned for today.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Route Info Card */}
            <Card className="shadow-lg border-0 bg-gradient-to-r from-teal-50 to-cyan-50">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center">
                  <Navigation className="w-6 h-6 mr-2 text-teal-600" />
                  Today's Route: {todayData.route.name}
                </CardTitle>
                <CardDescription className="text-base">{todayData.route.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Progress</p>
                    <p className="text-3xl font-bold text-teal-600">
                      {completedCount} / {totalCount}
                    </p>
                  </div>
                  <div className="flex-1 mx-8">
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
                        style={{ width: `${(completedCount / totalCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <p className="text-sm font-semibold text-gray-700 capitalize">{todayData.assignment.status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next Point Card */}
            {nextPoint && (
              <Card className="shadow-lg border-0 bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-500">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-amber-600" />
                    Next Patrol Point
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">{nextPoint.name}</h3>
                      <p className="text-gray-600 mb-2">{nextPoint.description}</p>
                      <p className="text-sm text-gray-500">{nextPoint.address}</p>
                    </div>
                    <Button
                      onClick={() => openAttendanceDialog(nextPoint)}
                      data-testid="mark-attendance-next-point"
                      className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-8 py-6 text-lg"
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Check In
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Patrol Points */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-2xl">All Patrol Points</CardTitle>
                <CardDescription>Complete your patrol in the order listed below</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todayData.patrol_points.map((point, index) => (
                    <div
                      key={point.id}
                      data-testid={`patrol-point-${point.id}`}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        point.completed
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200 hover:shadow-md cursor-pointer'
                      }`}
                      onClick={() => !point.completed && openAttendanceDialog(point)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            {point.completed ? (
                              <CheckCircle2 className="w-8 h-8 text-green-600" data-testid={`point-completed-${point.id}`} />
                            ) : (
                              <Circle className="w-8 h-8 text-gray-400" data-testid={`point-pending-${point.id}`} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                #{index + 1}
                              </span>
                              <h3 className="text-lg font-semibold text-gray-900">{point.name}</h3>
                            </div>
                            <p className="text-sm text-gray-600">{point.description}</p>
                            <p className="text-xs text-gray-500 mt-1">{point.address}</p>
                          </div>
                        </div>
                        {!point.completed && (
                          <Button
                            size="sm"
                            data-testid={`check-in-button-${point.id}`}
                            className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAttendanceDialog(point);
                            }}
                          >
                            Check In
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Attendance Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
            <DialogDescription>
              Confirm your check-in at {selectedPoint?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{selectedPoint?.name}</h3>
              <p className="text-sm text-gray-600">{selectedPoint?.address}</p>
            </div>
            <div>
              <Label htmlFor="attendance-notes">Notes (Optional)</Label>
              <Textarea
                id="attendance-notes"
                data-testid="attendance-notes-input"
                placeholder="Add any observations or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={handleMarkAttendance}
              data-testid="confirm-attendance-button"
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
              disabled={loading}
            >
              {loading ? 'Marking...' : 'Confirm Check-In'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}