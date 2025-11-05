import requests
import sys
import json
from datetime import datetime, timedelta

class PatrolTrackerAPITester:
    def __init__(self, base_url="https://patrol-tracker-13.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.officer_token = None
        self.admin_user = None
        self.officer_user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'patrol_points': [],
            'routes': [],
            'assignments': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration for both admin and officer"""
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Register admin
        admin_data = {
            "username": f"admin_{timestamp}",
            "password": "AdminPass123!",
            "full_name": "Test Admin",
            "role": "admin",
            "badge_number": "A001"
        }
        
        success, response = self.run_test(
            "Admin Registration",
            "POST",
            "auth/register",
            200,
            data=admin_data
        )
        
        if success:
            self.admin_user = response
            print(f"   Admin created: {response.get('username')}")
        
        # Register officer
        officer_data = {
            "username": f"officer_{timestamp}",
            "password": "OfficerPass123!",
            "full_name": "Test Officer",
            "role": "officer",
            "badge_number": "O001"
        }
        
        success, response = self.run_test(
            "Officer Registration",
            "POST",
            "auth/register",
            200,
            data=officer_data
        )
        
        if success:
            self.officer_user = response
            print(f"   Officer created: {response.get('username')}")
        
        return self.admin_user and self.officer_user

    def test_user_login(self):
        """Test login for both users"""
        if not self.admin_user or not self.officer_user:
            print("❌ Cannot test login - users not created")
            return False
        
        # Admin login
        admin_login = {
            "username": self.admin_user['username'],
            "password": "AdminPass123!"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=admin_login
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained")
        
        # Officer login
        officer_login = {
            "username": self.officer_user['username'],
            "password": "OfficerPass123!"
        }
        
        success, response = self.run_test(
            "Officer Login",
            "POST",
            "auth/login",
            200,
            data=officer_login
        )
        
        if success and 'access_token' in response:
            self.officer_token = response['access_token']
            print(f"   Officer token obtained")
        
        return self.admin_token and self.officer_token

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        if not self.admin_token:
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        
        return success and response.get('role') == 'admin'

    def test_patrol_points_crud(self):
        """Test patrol points CRUD operations"""
        if not self.admin_token:
            print("❌ Cannot test patrol points - admin not logged in")
            return False
        
        # Create patrol point
        point_data = {
            "name": "Test Checkpoint Alpha",
            "description": "Main entrance checkpoint",
            "address": "123 Main Street, City Center"
        }
        
        success, response = self.run_test(
            "Create Patrol Point",
            "POST",
            "patrol-points",
            200,
            data=point_data,
            token=self.admin_token
        )
        
        if success:
            point_id = response.get('id')
            self.created_resources['patrol_points'].append(point_id)
            print(f"   Created patrol point: {point_id}")
        
        # Get patrol points
        success, response = self.run_test(
            "Get Patrol Points",
            "GET",
            "patrol-points",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   Retrieved {len(response)} patrol points")
        
        # Test officer access to patrol points
        success, response = self.run_test(
            "Officer Get Patrol Points",
            "GET",
            "patrol-points",
            200,
            token=self.officer_token
        )
        
        return success

    def test_routes_crud(self):
        """Test routes CRUD operations"""
        if not self.admin_token or not self.created_resources['patrol_points']:
            print("❌ Cannot test routes - admin not logged in or no patrol points")
            return False
        
        # Create another patrol point for the route
        point_data = {
            "name": "Test Checkpoint Beta",
            "description": "Secondary checkpoint",
            "address": "456 Second Street, Downtown"
        }
        
        success, response = self.run_test(
            "Create Second Patrol Point",
            "POST",
            "patrol-points",
            200,
            data=point_data,
            token=self.admin_token
        )
        
        if success:
            second_point_id = response.get('id')
            self.created_resources['patrol_points'].append(second_point_id)
        
        # Create route with multiple points
        route_data = {
            "name": "Test Route Alpha",
            "description": "Main patrol route covering downtown area",
            "patrol_point_ids": self.created_resources['patrol_points']
        }
        
        success, response = self.run_test(
            "Create Route",
            "POST",
            "routes",
            200,
            data=route_data,
            token=self.admin_token
        )
        
        if success:
            route_id = response.get('id')
            self.created_resources['routes'].append(route_id)
            print(f"   Created route: {route_id}")
        
        # Get routes
        success, response = self.run_test(
            "Get Routes",
            "GET",
            "routes",
            200,
            token=self.admin_token
        )
        
        return success

    def test_route_assignments(self):
        """Test route assignment operations"""
        if not self.admin_token or not self.created_resources['routes'] or not self.officer_user:
            print("❌ Cannot test assignments - missing prerequisites")
            return False
        
        # Create assignment for today
        today = datetime.now().strftime("%Y-%m-%d")
        assignment_data = {
            "officer_id": self.officer_user['id'],
            "route_id": self.created_resources['routes'][0],
            "date": today
        }
        
        success, response = self.run_test(
            "Create Route Assignment",
            "POST",
            "route-assignments",
            200,
            data=assignment_data,
            token=self.admin_token
        )
        
        if success:
            assignment_id = response.get('id')
            self.created_resources['assignments'].append(assignment_id)
            print(f"   Created assignment: {assignment_id}")
        
        # Get all assignments (admin view)
        success, response = self.run_test(
            "Get All Assignments (Admin)",
            "GET",
            "route-assignments",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   Admin sees {len(response)} assignments")
        
        # Get assignments (officer view - should only see their own)
        success, response = self.run_test(
            "Get Officer Assignments",
            "GET",
            "route-assignments",
            200,
            token=self.officer_token
        )
        
        if success:
            print(f"   Officer sees {len(response)} assignments")
        
        # Get today's assignment for officer
        success, response = self.run_test(
            "Get Today's Assignment",
            "GET",
            "route-assignments/today",
            200,
            token=self.officer_token
        )
        
        return success

    def test_attendance_marking(self):
        """Test attendance marking by officer"""
        if not self.officer_token or not self.created_resources['assignments']:
            print("❌ Cannot test attendance - officer not logged in or no assignments")
            return False
        
        # First get today's assignment to get the assignment ID
        success, today_data = self.run_test(
            "Get Today's Assignment for Attendance",
            "GET",
            "route-assignments/today",
            200,
            token=self.officer_token
        )
        
        if not success or not today_data.get('assignment'):
            print("❌ No assignment found for today")
            return False
        
        assignment_id = today_data['assignment']['id']
        patrol_points = today_data.get('patrol_points', [])
        
        if not patrol_points:
            print("❌ No patrol points in assignment")
            return False
        
        # Mark attendance at first patrol point
        attendance_data = {
            "route_assignment_id": assignment_id,
            "patrol_point_id": patrol_points[0]['id'],
            "notes": "Test attendance marking - all clear"
        }
        
        success, response = self.run_test(
            "Mark Attendance",
            "POST",
            "attendance",
            200,
            data=attendance_data,
            token=self.officer_token
        )
        
        if success:
            print(f"   Marked attendance at {patrol_points[0]['name']}")
        
        # Try to mark attendance again (should fail)
        success, response = self.run_test(
            "Mark Duplicate Attendance",
            "POST",
            "attendance",
            400,  # Should fail with 400
            data=attendance_data,
            token=self.officer_token
        )
        
        if success:
            print("   ✅ Duplicate attendance correctly rejected")
        
        return True

    def test_admin_attendance_view(self):
        """Test admin viewing all attendance records"""
        if not self.admin_token:
            print("❌ Cannot test admin attendance view - admin not logged in")
            return False
        
        success, response = self.run_test(
            "Get All Attendance (Admin)",
            "GET",
            "attendance",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   Admin sees {len(response)} attendance records")
            if response:
                record = response[0]
                print(f"   Sample record: {record.get('officer_name')} at {record.get('patrol_point_name')}")
        
        return success

    def test_officers_list(self):
        """Test getting list of officers (admin only)"""
        if not self.admin_token:
            return False
        
        success, response = self.run_test(
            "Get Officers List",
            "GET",
            "users/officers",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   Found {len(response)} officers")
        
        # Test officer cannot access this endpoint
        success, response = self.run_test(
            "Officer Access Officers List (Should Fail)",
            "GET",
            "users/officers",
            403,  # Should be forbidden
            token=self.officer_token
        )
        
        return success

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        # Test without token
        success, response = self.run_test(
            "Access Without Token",
            "GET",
            "patrol-points",
            401  # Should be unauthorized
        )
        
        # Test officer trying admin operations
        if self.officer_token:
            success, response = self.run_test(
                "Officer Create Patrol Point (Should Fail)",
                "POST",
                "patrol-points",
                403,  # Should be forbidden
                data={"name": "Test", "description": "Test", "address": "Test"},
                token=self.officer_token
            )
        
        return True

    def cleanup_resources(self):
        """Clean up created test resources"""
        if not self.admin_token:
            return
        
        print("\n🧹 Cleaning up test resources...")
        
        # Delete patrol points (this will cascade to routes)
        for point_id in self.created_resources['patrol_points']:
            try:
                success, _ = self.run_test(
                    f"Delete Patrol Point {point_id}",
                    "DELETE",
                    f"patrol-points/{point_id}",
                    200,
                    token=self.admin_token
                )
                if success:
                    print(f"   ✅ Deleted patrol point {point_id}")
            except:
                pass
        
        # Delete routes
        for route_id in self.created_resources['routes']:
            try:
                success, _ = self.run_test(
                    f"Delete Route {route_id}",
                    "DELETE",
                    f"routes/{route_id}",
                    200,
                    token=self.admin_token
                )
                if success:
                    print(f"   ✅ Deleted route {route_id}")
            except:
                pass

def main():
    print("🚔 Starting Patrol Tracker API Tests...")
    print("=" * 50)
    
    tester = PatrolTrackerAPITester()
    
    try:
        # Test sequence
        if not tester.test_user_registration():
            print("❌ User registration failed, stopping tests")
            return 1
        
        if not tester.test_user_login():
            print("❌ User login failed, stopping tests")
            return 1
        
        if not tester.test_auth_me():
            print("❌ Auth verification failed, stopping tests")
            return 1
        
        tester.test_patrol_points_crud()
        tester.test_routes_crud()
        tester.test_route_assignments()
        tester.test_attendance_marking()
        tester.test_admin_attendance_view()
        tester.test_officers_list()
        tester.test_unauthorized_access()
        
    finally:
        # Always try to cleanup
        tester.cleanup_resources()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())