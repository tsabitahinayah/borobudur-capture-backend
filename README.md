# Borobudur Capture Backend

Backend service for the Borobudur relief image acquisition project. This system handles image and metadata uploads from STM32 devices and provides endpoints for data validation and retrieval.

## System Architecture

The system consists of:
- **Express.js Backend**: Handles HTTP requests for image and metadata uploads
- **Azure Blob Storage**: Stores images and metadata in a structured format
- **Two STM32 Devices**:
  - STM32F407 (camera, master): Takes photos and uploads them
  - STM32F401 (motion, slave): Records position metadata and uploads it

## Setup Instructions

### Prerequisites
- Node.js (v14+)
- Azure Storage Account

### Installation

1. Clone the repository
2. Install dependencies:
```
npm install
```

3. Configure environment variables in `.env` file:
```
# Server Configuration
PORT=3000

# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=yourstorageaccount;AccountKey=yourstoragekey;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=borobudur-capture
```

4. Start the server:
```
npm start
```

For development with auto-reload:
```
npm run dev
```

## API Endpoints

### Upload Endpoints

#### 1. Upload Image
```
POST /upload/image
Content-Type: multipart/form-data

Body:
- photo_id: string (example: "0007")
- session_id: string (example: "session_001")
- file: binary (image/jpeg)
```

Response:
```json
{
  "status": "success",
  "photo_id": "0007",
  "path": "session_001/images/0007.jpg"
}
```

#### 2. Upload Metadata
```
POST /upload/meta
Content-Type: application/json

Body:
{
  "photo_id": "0007",
  "session_id": "session_001",
  "side_flag": "west",
  "bend": "inward",
  "timestamp": "2025-09-15T09:35:22Z"
}
```

Response:
```json
{
  "status": "success",
  "photo_id": "0007",
  "path": "session_001/metadata/0007.json"
}
```

### Session Endpoints

#### 1. Session Status
```
GET /session/status/:session_id
```

Response:
```json
{
  "status": "success",
  "session_id": "session_001",
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

Response: ZIP file containing all images and metadata for the session.

## Data Structure

The data is organized in Azure Blob Storage as follows:

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
└── session_002/
    ├── images/
    └── metadata/
```

## STM32 Integration

- STM32F407 (camera) → assign photo_id → upload photo to /upload/image → broadcast photo_id to STM32F401 via I²C
- STM32F401 (motion) → receive photo_id → generate JSON metadata → upload to /upload/meta