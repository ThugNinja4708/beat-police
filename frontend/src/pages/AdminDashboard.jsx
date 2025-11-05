import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MapPin, Route as RouteIcon, Calendar, Users, LogOut, Trash2, Plus, ClipboardCheck } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard({ user, onLogout }) {
  const [patrolPoints, setPatrolPoints] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);

  // New forms state
  const [newPoint, setNewPoint] = useState({ name: '', description: '', address: '' });
  const [newRoute, setNewRoute] = useState({ name: '', description: '', patrol_point_ids: [] });
  const [newAssignment, setNewAssignment] = useState({ officer_id: '', route_id: '', date: '' });

  const [openPointDialog, setOpenPointDialog] = useState(false);
  const [openRouteDialog, setOpenRouteDialog] = useState(false);
  const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false);

  const token = localStorage.getItem('token');
  const config = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pointsRes, routesRes, officersRes, attendanceRes, assignmentsRes] = await Promise.all([
        axios.get(`${API}/patrol-points`, config),
        axios.get(`${API}/routes`, config),
        axios.get(`${API}/users/officers`, config),
        axios.get(`${API}/attendance`, config),
        axios.get(`${API}/route-assignments`, config)
      ]);
      setPatrolPoints(pointsRes.data);
      setRoutes(routesRes.data);
      setOfficers(officersRes.data);
      setAttendance(attendanceRes.data);
      setAssignments(assignmentsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    }
  };

  const handleCreatePoint = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/patrol-points`, newPoint, config);
      toast.success('Patrol point created successfully');
      setNewPoint({ name: '', description: '', address: '' });
      setOpenPointDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create patrol point');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePoint = async (pointId) => {
    try {
      await axios.delete(`${API}/patrol-points/${pointId}`, config);
      toast.success('Patrol point deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete patrol point');
    }
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/routes`, newRoute, config);
      toast.success('Route created successfully');
      setNewRoute({ name: '', description: '', patrol_point_ids: [] });
      setOpenRouteDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create route');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    try {
      await axios.delete(`${API}/routes/${routeId}`, config);
      toast.success('Route deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete route');
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/route-assignments`, newAssignment, config);
      toast.success('Route assigned successfully');
      setNewAssignment({ officer_id: '', route_id: '', date: '' });
      setOpenAssignmentDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign route');
    } finally {
      setLoading(false);
    }
  };

  const togglePointInRoute = (pointId) => {
    setNewRoute((prev) => {
      const ids = prev.patrol_point_ids.includes(pointId)
        ? prev.patrol_point_ids.filter((id) => id !== pointId)
        : [...prev.patrol_point_ids, pointId];
      return { ...prev, patrol_point_ids: ids };
    });
  };

  const getPointName = (pointId) => {
    const point = patrolPoints.find((p) => p.id === pointId);
    return point?.name || 'Unknown';
  };

  const getRouteName = (routeId) => {
    const route = routes.find((r) => r.id === routeId);
    return route?.name || 'Unknown';
  };

  const getOfficerName = (officerId) => {
    const officer = officers.find((o) => o.id === officerId);
    return officer?.full_name || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {user.full_name}</p>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="patrol-points" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 h-auto bg-white/80 backdrop-blur-sm p-1">
            <TabsTrigger value="patrol-points" data-testid="patrol-points-tab" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <MapPin className="w-4 h-4 mr-2" />
              Patrol Points
            </TabsTrigger>
            <TabsTrigger value="routes" data-testid="routes-tab" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <RouteIcon className="w-4 h-4 mr-2" />
              Routes
            </TabsTrigger>
            <TabsTrigger value="assignments" data-testid="assignments-tab" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="attendance" data-testid="attendance-tab" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Attendance
            </TabsTrigger>
          </TabsList>

          {/* Patrol Points Tab */}
          <TabsContent value="patrol-points" data-testid="patrol-points-content">
            <Card className="shadow-lg border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Patrol Points</CardTitle>
                  <CardDescription>Manage location checkpoints for patrols</CardDescription>
                </div>
                <Dialog open={openPointDialog} onOpenChange={setOpenPointDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-patrol-point-button" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Point
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Patrol Point</DialogTitle>
                      <DialogDescription>Add a new checkpoint for patrol routes</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreatePoint} className="space-y-4">
                      <div>
                        <Label htmlFor="point-name">Name</Label>
                        <Input
                          id="point-name"
                          data-testid="point-name-input"
                          value={newPoint.name}
                          onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="point-description">Description</Label>
                        <Input
                          id="point-description"
                          data-testid="point-description-input"
                          value={newPoint.description}
                          onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="point-address">Address</Label>
                        <Input
                          id="point-address"
                          data-testid="point-address-input"
                          value={newPoint.address}
                          onChange={(e) => setNewPoint({ ...newPoint, address: e.target.value })}
                          required
                        />
                      </div>
                      <Button type="submit" data-testid="create-point-submit" className="w-full" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Point'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {patrolPoints.map((point) => (
                    <div
                      key={point.id}
                      data-testid={`patrol-point-${point.id}`}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 hover:shadow-md transition-all duration-200"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-900">{point.name}</h3>
                        <p className="text-sm text-gray-600">{point.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{point.address}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`delete-point-${point.id}`}
                        onClick={() => handleDeletePoint(point.id)}
                        className="hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {patrolPoints.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No patrol points yet. Create one to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Routes Tab */}
          <TabsContent value="routes" data-testid="routes-content">
            <Card className="shadow-lg border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Patrol Routes</CardTitle>
                  <CardDescription>Define patrol sequences with multiple checkpoints</CardDescription>
                </div>
                <Dialog open={openRouteDialog} onOpenChange={setOpenRouteDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-route-button" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Route
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Patrol Route</DialogTitle>
                      <DialogDescription>Define a sequence of patrol points</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateRoute} className="space-y-4">
                      <div>
                        <Label htmlFor="route-name">Route Name</Label>
                        <Input
                          id="route-name"
                          data-testid="route-name-input"
                          value={newRoute.name}
                          onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="route-description">Description</Label>
                        <Input
                          id="route-description"
                          data-testid="route-description-input"
                          value={newRoute.description}
                          onChange={(e) => setNewRoute({ ...newRoute, description: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Select Patrol Points (in order)</Label>
                        <div className="space-y-2 mt-2 max-h-60 overflow-y-auto border rounded-md p-3">
                          {patrolPoints.map((point) => (
                            <div
                              key={point.id}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                              onClick={() => togglePointInRoute(point.id)}
                            >
                              <input
                                type="checkbox"
                                data-testid={`route-point-${point.id}`}
                                checked={newRoute.patrol_point_ids.includes(point.id)}
                                onChange={() => togglePointInRoute(point.id)}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">{point.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button type="submit" data-testid="create-route-submit" className="w-full" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Route'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {routes.map((route) => (
                    <div
                      key={route.id}
                      data-testid={`route-${route.id}`}
                      className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{route.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{route.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {route.patrol_point_ids.map((pointId, index) => (
                              <span
                                key={pointId}
                                className="text-xs bg-white px-2 py-1 rounded-full border border-indigo-200"
                              >
                                {index + 1}. {getPointName(pointId)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`delete-route-${route.id}`}
                          onClick={() => handleDeleteRoute(route.id)}
                          className="hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {routes.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No routes yet. Create one to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" data-testid="assignments-content">
            <Card className="shadow-lg border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Route Assignments</CardTitle>
                  <CardDescription>Assign patrol routes to officers</CardDescription>
                </div>
                <Dialog open={openAssignmentDialog} onOpenChange={setOpenAssignmentDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-assignment-button" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Assign Route
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Route to Officer</DialogTitle>
                      <DialogDescription>Schedule a patrol route for a specific date</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateAssignment} className="space-y-4">
                      <div>
                        <Label htmlFor="assignment-officer">Officer</Label>
                        <select
                          id="assignment-officer"
                          data-testid="assignment-officer-select"
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={newAssignment.officer_id}
                          onChange={(e) => setNewAssignment({ ...newAssignment, officer_id: e.target.value })}
                          required
                        >
                          <option value="">Select an officer</option>
                          {officers.map((officer) => (
                            <option 
                              key={officer.id} 
                              value={officer.id}
                              data-testid={`officer-option-${officer.id}`}
                            >
                              {officer.full_name} {officer.badge_number ? `(#${officer.badge_number})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="assignment-route">Route</Label>
                        <select
                          id="assignment-route"
                          data-testid="assignment-route-select"
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={newAssignment.route_id}
                          onChange={(e) => setNewAssignment({ ...newAssignment, route_id: e.target.value })}
                          required
                        >
                          <option value="">Select a route</option>
                          {routes.map((route) => (
                            <option 
                              key={route.id} 
                              value={route.id}
                              data-testid={`route-option-${route.id}`}
                            >
                              {route.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="assignment-date">Date</Label>
                        <Input
                          id="assignment-date"
                          data-testid="assignment-date-input"
                          type="date"
                          value={newAssignment.date}
                          onChange={(e) => setNewAssignment({ ...newAssignment, date: e.target.value })}
                          required
                        />
                      </div>
                      <Button type="submit" data-testid="create-assignment-submit" className="w-full" disabled={loading}>
                        {loading ? 'Assigning...' : 'Assign Route'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      data-testid={`assignment-${assignment.id}`}
                      className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-100 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{getOfficerName(assignment.officer_id)}</h3>
                          <p className="text-sm text-gray-600">Route: {getRouteName(assignment.route_id)}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Date: {assignment.date} • Status: <span className="capitalize">{assignment.status}</span>
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              assignment.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : assignment.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {assignment.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {assignments.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No assignments yet. Create one to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" data-testid="attendance-content">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-2xl">Attendance Records</CardTitle>
                <CardDescription>View all officer check-ins at patrol points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attendance.map((record) => (
                    <div
                      key={record.id}
                      data-testid={`attendance-${record.id}`}
                      className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{record.officer_name}</h3>
                          {record.badge_number && (
                            <p className="text-xs text-gray-500">Badge: {record.badge_number}</p>
                          )}
                          <p className="text-sm text-gray-600 mt-1">{record.patrol_point_name}</p>
                          <p className="text-xs text-gray-500">{record.patrol_point_address}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{record.date}</p>
                          <p className="text-sm font-medium text-gray-700">
                            {new Date(record.check_in_time).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {record.notes && (
                        <p className="text-xs text-gray-600 mt-2 italic">Note: {record.notes}</p>
                      )}
                    </div>
                  ))}
                  {attendance.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No attendance records yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}