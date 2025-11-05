from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== Models ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    full_name: str
    role: str  # "admin" or "officer"
    badge_number: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    badge_number: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    badge_number: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class PatrolPoint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PatrolPointCreate(BaseModel):
    name: str
    description: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class Route(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    patrol_point_ids: List[str]  # Ordered list of patrol point IDs
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteCreate(BaseModel):
    name: str
    description: str
    patrol_point_ids: List[str]

class RouteAssignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    route_id: str
    date: str  # Format: YYYY-MM-DD
    status: str = "assigned"  # "assigned", "in_progress", "completed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteAssignmentCreate(BaseModel):
    officer_id: str
    route_id: str
    date: str

class Attendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    route_assignment_id: str
    patrol_point_id: str
    check_in_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: Optional[str] = None

class AttendanceCreate(BaseModel):
    route_assignment_id: str
    patrol_point_id: str
    notes: Optional[str] = None

# ==================== Auth Utilities ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== Auth Routes ====================

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    password_hash = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        password_hash=password_hash,
        full_name=user_data.full_name,
        role=user_data.role,
        badge_number=user_data.badge_number
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        badge_number=user.badge_number
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"username": login_data.username}, {"_id": 0})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            full_name=user["full_name"],
            role=user["role"],
            badge_number=user.get("badge_number")
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        full_name=current_user["full_name"],
        role=current_user["role"],
        badge_number=current_user.get("badge_number")
    )

# ==================== Patrol Points Routes ====================

@api_router.post("/patrol-points", response_model=PatrolPoint)
async def create_patrol_point(point_data: PatrolPointCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create patrol points")
    
    point = PatrolPoint(**point_data.model_dump())
    doc = point.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.patrol_points.insert_one(doc)
    return point

@api_router.get("/patrol-points", response_model=List[PatrolPoint])
async def get_patrol_points(current_user: dict = Depends(get_current_user)):
    points = await db.patrol_points.find({}, {"_id": 0}).to_list(1000)
    for point in points:
        if isinstance(point['created_at'], str):
            point['created_at'] = datetime.fromisoformat(point['created_at'])
    return points

@api_router.delete("/patrol-points/{point_id}")
async def delete_patrol_point(point_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete patrol points")
    
    result = await db.patrol_points.delete_one({"id": point_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patrol point not found")
    return {"message": "Patrol point deleted successfully"}

# ==================== Routes (Patrol Routes) ====================

@api_router.post("/routes", response_model=Route)
async def create_route(route_data: RouteCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create routes")
    
    route = Route(**route_data.model_dump())
    doc = route.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.routes.insert_one(doc)
    return route

@api_router.get("/routes", response_model=List[Route])
async def get_routes(current_user: dict = Depends(get_current_user)):
    routes = await db.routes.find({}, {"_id": 0}).to_list(1000)
    for route in routes:
        if isinstance(route['created_at'], str):
            route['created_at'] = datetime.fromisoformat(route['created_at'])
    return routes

@api_router.delete("/routes/{route_id}")
async def delete_route(route_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete routes")
    
    result = await db.routes.delete_one({"id": route_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"message": "Route deleted successfully"}

# ==================== Route Assignments ====================

@api_router.post("/route-assignments", response_model=RouteAssignment)
async def create_route_assignment(assignment_data: RouteAssignmentCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can assign routes")
    
    assignment = RouteAssignment(**assignment_data.model_dump())
    doc = assignment.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.route_assignments.insert_one(doc)
    return assignment

@api_router.get("/route-assignments", response_model=List[RouteAssignment])
async def get_route_assignments(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == "officer":
        query["officer_id"] = current_user["id"]
    
    assignments = await db.route_assignments.find(query, {"_id": 0}).to_list(1000)
    for assignment in assignments:
        if isinstance(assignment['created_at'], str):
            assignment['created_at'] = datetime.fromisoformat(assignment['created_at'])
    return assignments

@api_router.get("/route-assignments/today")
async def get_today_assignment(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "officer":
        raise HTTPException(status_code=403, detail="Only officers can access this endpoint")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    assignment = await db.route_assignments.find_one(
        {"officer_id": current_user["id"], "date": today},
        {"_id": 0}
    )
    
    if not assignment:
        return {"message": "No route assigned for today"}
    
    # Get route details
    route = await db.routes.find_one({"id": assignment["route_id"]}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Get patrol points
    patrol_points = await db.patrol_points.find(
        {"id": {"$in": route["patrol_point_ids"]}},
        {"_id": 0}
    ).to_list(1000)
    
    # Get attendance for today
    attendance_records = await db.attendance.find(
        {"route_assignment_id": assignment["id"]},
        {"_id": 0}
    ).to_list(1000)
    
    completed_point_ids = [att["patrol_point_id"] for att in attendance_records]
    
    # Order patrol points and mark completed
    ordered_points = []
    for point_id in route["patrol_point_ids"]:
        point = next((p for p in patrol_points if p["id"] == point_id), None)
        if point:
            point["completed"] = point_id in completed_point_ids
            ordered_points.append(point)
    
    return {
        "assignment": assignment,
        "route": route,
        "patrol_points": ordered_points
    }

# ==================== Attendance Routes ====================

@api_router.post("/attendance", response_model=Attendance)
async def mark_attendance(attendance_data: AttendanceCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "officer":
        raise HTTPException(status_code=403, detail="Only officers can mark attendance")
    
    # Check if assignment exists
    assignment = await db.route_assignments.find_one(
        {"id": attendance_data.route_assignment_id},
        {"_id": 0}
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Route assignment not found")
    
    # Check if already marked
    existing = await db.attendance.find_one(
        {
            "route_assignment_id": attendance_data.route_assignment_id,
            "patrol_point_id": attendance_data.patrol_point_id
        },
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already marked for this point")
    
    attendance = Attendance(
        officer_id=current_user["id"],
        route_assignment_id=attendance_data.route_assignment_id,
        patrol_point_id=attendance_data.patrol_point_id,
        notes=attendance_data.notes
    )
    
    doc = attendance.model_dump()
    doc['check_in_time'] = doc['check_in_time'].isoformat()
    await db.attendance.insert_one(doc)
    
    # Update assignment status
    route = await db.routes.find_one({"id": assignment["route_id"]}, {"_id": 0})
    if route:
        attendance_count = await db.attendance.count_documents({"route_assignment_id": attendance_data.route_assignment_id})
        if attendance_count >= len(route["patrol_point_ids"]):
            await db.route_assignments.update_one(
                {"id": attendance_data.route_assignment_id},
                {"$set": {"status": "completed"}}
            )
        elif attendance_count > 0:
            await db.route_assignments.update_one(
                {"id": attendance_data.route_assignment_id},
                {"$set": {"status": "in_progress"}}
            )
    
    return attendance

@api_router.get("/attendance")
async def get_all_attendance(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view all attendance")
    
    # Get all attendance records
    attendance_records = await db.attendance.find({}, {"_id": 0}).to_list(10000)
    
    # Enrich with user and patrol point details
    result = []
    for record in attendance_records:
        officer = await db.users.find_one({"id": record["officer_id"]}, {"_id": 0})
        patrol_point = await db.patrol_points.find_one({"id": record["patrol_point_id"]}, {"_id": 0})
        assignment = await db.route_assignments.find_one({"id": record["route_assignment_id"]}, {"_id": 0})
        
        result.append({
            "id": record["id"],
            "officer_name": officer["full_name"] if officer else "Unknown",
            "badge_number": officer.get("badge_number") if officer else None,
            "patrol_point_name": patrol_point["name"] if patrol_point else "Unknown",
            "patrol_point_address": patrol_point["address"] if patrol_point else "Unknown",
            "check_in_time": record["check_in_time"],
            "notes": record.get("notes"),
            "date": assignment["date"] if assignment else None
        })
    
    return result

# ==================== Users (Officers) Management ====================

@api_router.get("/users/officers", response_model=List[UserResponse])
async def get_officers(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view officers")
    
    officers = await db.users.find({"role": "officer"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**officer) for officer in officers]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()