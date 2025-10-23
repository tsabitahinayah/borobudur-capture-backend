# Borobudur Capture Backend

Backend service for the Borobudur relief image acquisition project. This system handles image and metadata uploads from STM32 devices, manages photo capture sessions, and provides endpoints for data validation and retrieval.

## System Architecture

The system consists of:
- **Express.js Backend**: Handles HTTP requests for image and metadata uploads
- **MongoDB Database**: Manages session tracking and state
- **Azure Blob Storage**: Stores images and metadata in a structured format
- **Two STM32 Devices**:
  - STM32F407 (camera, master): Takes photos and uploads them
  - STM32F401 (motion, slave): Records position metadata and uploads it

## Session Management

The system uses a completion-based session tracking approach:

1. **Session Records**: MongoDB stores completed session records ONLY after photo capture is finished
2. **STM Robot Query**: When STM robot starts, it queries for the last completed session (or null if first time)
3. **Photo Storage**: All photos are stored in Azure Blob Storage under the next session folder (determined automatically)
4. **Session Completion**: When robot finishes, it calls end session which creates the completed session record in MongoDB

**Key Features:**
- Sessions are recorded in MongoDB ONLY after completion
- First day: No records exist → Robot starts session_001 → End creates session_001 record
- Subsequent days: Robot queries last completed session → Uses next sequential session → End creates new record
- Automatic session ID determination
- Separate storage systems (MongoDB for completion tracking, Azure for photos)

## Setup Instructions

### Prerequisites
- Node.js (v14+)
- MongoDB Database (local or cloud)
- Azure Storage Account
- Vercel account (for deployment)

### Installation

**1. Clone the repository**
**2. Install dependencies:**
```
npm install
```

**3. Configure environment variables in `.env` file:**
```
# Server Configuration
PORT=3000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/borobudur-capture

# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=yourstorageaccount;AccountKey=yourstoragekey;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=borobudur-capture
```

**4. Set up MongoDB:**

**Option A: Local MongoDB Installation**
- Install MongoDB Community Edition
- Start MongoDB service: `mongod`
- The database and collection will be created automatically

**Option B: MongoDB Cloud (Atlas)**
- Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
- Create a new cluster
- Get connection string and update `MONGODB_URI` in `.env`
- Example: `mongodb+srv://username:password@cluster.mongodb.net/borobudur-capture`

**Option C: Docker MongoDB**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**5. Start the server:**
```
npm start
```

For development with auto-reload:
```
npm run dev
```

The server will automatically:
- Connect to MongoDB
- Create the session collection if it doesn't exist
- Ready to track completed sessions (no initial records created)

### Deploying to Vercel

1. Install Vercel CLI (optional):
```
npm install -g vercel
```

2. Deploy using Vercel CLI:
```
vercel
```

3. Or deploy via Vercel Dashboard:
   - Connect your GitHub repository to Vercel
   - Import the project
   - Configure the following environment variables in Vercel:
     - `MONGODB_URI`: Your MongoDB connection string
     - `AZURE_STORAGE_CONNECTION_STRING`: Your Azure Storage connection string
     - `AZURE_STORAGE_CONTAINER_NAME`: Your Azure container name
   - Deploy the project

4. Troubleshooting Vercel Deployment:
   - Ensure all environment variables are correctly set in Vercel dashboard
   - Check that MongoDB Atlas allows connections from Vercel's IP addresses
   - Verify Azure Storage account has proper permissions
   - Review Vercel logs for specific error messages

## API Endpoints

### Session Management Endpoints

#### 1. Get Last Completed Session Status
```
GET /session/current
```

**Purpose**: STM robot calls this when turned on to check the last completed session.

**First Time Response** (no previous sessions):
```json
{
  "status": "success",
  "message": "No previous sessions found - this is the first session",
  "data": {
    "last_completed_session": null,
    "next_session_id": "session_001",
    "is_first_session": true
  }
}
```

**Subsequent Times Response** (previous sessions exist):
```json
{
  "status": "success",
  "message": "Last completed session retrieved successfully",
  "data": {
    "last_completed_session": "session_003",
    "completed_at": "2025-10-01T16:45:00.000Z",
    "next_session_id": "session_004",
    "is_first_session": false
  }
}
```

#### 2. End Session
```
POST /session/end
```

**Purpose**: STM robot calls this when photo capture is complete. Creates completed session record in MongoDB.

Response:
```json
{
  "status": "success",
  "message": "Session completed and recorded successfully",
  "data": {
    "completed_session_id": "session_003",
    "completed_at": "2025-10-02T16:45:00.000Z",
    "status": "completed"
  }
}
```

### Upload Endpoints

#### 1. Upload Image
```
POST /upload/image
Content-Type: multipart/form-data

Body:
- photo_id: string (example: "0007")
- file: binary (image/jpeg)
```

**Note**: `session_id` is automatically determined from the next session sequence.

Response:
```json
{
  "status": "success",
  "photo_id": "0007",
  "session_id": "session_003",
  "path": "session_003/images/0007.jpg"
}
```

#### 2. Upload Metadata
```
POST /upload/meta
Content-Type: application/json

Body:
{
  "photo_id": "001",
  "session_id": "session_001",
  "group_id": "2"
}
```

**Note**:
- `session_id` is provided by the STM and is used directly for storage pathing.
- `group_id` (string) groups images captured on the same wall before the robot turns; when the robot turns to the next wall, subsequent images use a new `group_id`.
- Only the specified fields are stored in the metadata JSON in Azure Blob Storage.

Response:
```json
{
  "status": "success",
  "photo_id": "0007",
  "session_id": "session_003",
  "path": "session_003/metadata/0007.json"
}
```

### Data Analysis Endpoints

#### 1. Session Status
```
GET /session/status/:session_id
```

**Purpose**: Check data consistency for a completed session.

Response:
```json
{
  "status": "success",
  "session_id": "session_003",
  "image_count": 120,
  "metadata_count": 118,
  "is_consistent": false,
  "missing_metadata": ["0034", "0087"],
  "missing_images": []
}
```

#### 2. Session Download
```
GET /session/download/:session_id
```

**Purpose**: Download all data from a completed session as ZIP file.

Response: ZIP file containing all images and metadata for the session.

## Workflow

### Daily Operation Workflow

**Day 1 (First Time):**
1. **Robot Startup**: STM robot is turned on
2. **Check Status**: Robot calls `GET /session/current` → Server responds: "No previous sessions, next is session_001"
3. **Photo Capture**: Robot begins photo capture process for session_001
4. **Upload Process**: 
   - STM32F407 (camera) takes photo and uploads via `POST /upload/image`
   - STM32F407 broadcasts photo_id to STM32F401 via I²C
   - STM32F401 (motion) uploads metadata via `POST /upload/meta`
   - All uploads automatically use session_001
5. **End Session**: Robot calls `POST /session/end` → Server creates session_001 completion record in MongoDB
6. **Result**: Photos stored in Azure under `session_001/`, MongoDB has session_001 completion record

**Day 2 and Beyond:**
1. **Robot Startup**: STM robot is turned on
2. **Check Status**: Robot calls `GET /session/current` → Server responds: "Last completed: session_001, next is session_002"
3. **Confirmation**: Robot knows session_001 was safely completed and photos are in Azure
4. **Photo Capture**: Robot begins new photo capture process for session_002
5. **Upload Process**: All uploads automatically use session_002
6. **End Session**: Robot calls `POST /session/end` → Server creates session_002 completion record in MongoDB
7. **Result**: Photos stored in Azure under `session_002/`, MongoDB has session_002 completion record

**Key Points:**
- MongoDB only contains COMPLETED session records
- Each day's photos are automatically stored in the correct Azure folder
- Robot always knows the status of the previous session before starting new work

## Data Structure

### MongoDB Collection (Session Management)
```javascript
// Collection: sessions (only completed sessions are stored)
{
  "_id": ObjectId("..."),
  "sessionId": "session_003",
  "completedAt": ISODate("2025-10-02T16:45:00.000Z"),
  "status": "completed",
  "createdAt": ISODate("2025-10-02T16:45:00.000Z"),
  "updatedAt": ISODate("2025-10-02T16:45:00.000Z")
}
```

### Azure Blob Storage (Photo Data)
```
borobudur-capture/
│
├── session_001/
│   ├── images/
│   │   ├── 0001.jpg
│   │   ├── 0002.jpg
│   │   └── ...
│   └── metadata/
│       ├── 0001.json
│       ├── 0002.json
│       └── ...
│
├── session_002/
│   ├── images/
│   └── metadata/
│
└── session_003/
    ├── images/
    └── metadata/
```

### Key Design Principles
- **MongoDB**: Only stores COMPLETED sessions, no active session tracking
- **Azure Blob Storage**: Separate folders per session, permanent photo storage  
- **Separation**: Session completion tracking (MongoDB) and photo storage (Azure) are independent
- **Automation**: Session IDs determined automatically based on completion history

## STM32 Integration

### Updated Integration Flow
1. **Robot Startup**: STM32 calls `GET /session/current` → receives last completed session info and next session ID
2. **Status Display**: STM32 shows user the last completed session (or "first time" message)
3. **Photo Capture**: 
   - STM32F407 (camera) → takes photo → uploads via `POST /upload/image` (session_id automatic)
   - STM32F407 → broadcasts photo_id to STM32F401 via I²C
   - STM32F401 (motion) → receives photo_id → uploads metadata via `POST /upload/meta` (session_id automatic)
4. **Session End**: STM32 calls `POST /session/end` → creates completed session record in MongoDB
5. **Display**: STM32 shows completion message with the completed session ID

### Error Handling
- System automatically determines correct session ID for uploads
- No session activation required - uploads work immediately
- Completion tracking ensures data integrity between sessions
- Automatic session management eliminates manual configuration