# Layout Project

Layout is a comprehensive web application for managing architectural projects, files, and annotations. It allows users to upload architectural plans (PDFs, Images), annotate regions, draw land boundaries, place overlays, and export the results.

## Features
- **Project Management**: Create and manage multiple architectural projects.
- **File Handling**: Upload and process architectural files (PDFs, Images).
- **Interactive Canvas**: Annotate and place overlays on architectural plans using a rich interactive canvas.
- **Land Boundaries**: Draw and manage land boundaries on maps.
- **Version Control**: Take snapshots of project versions.
- **Exporting**: Export project designs and annotations.

## Tech Stack
### Frontend
- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Canvas/Graphics**: Konva (`react-konva`)
- **Maps**: Leaflet (`react-leaflet`)
- **PDF Rendering**: `react-pdf`, `pdfjs-dist`
- **Drag & Drop**: `@dnd-kit`

### Backend
- **Framework**: [NestJS](https://nestjs.com/)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT, Passport, Bcrypt
- **Image/PDF Processing**: Sharp, Canvas, `pdfjs-dist`, `html-to-image`
- **File Archiving**: Archiver, Unzipper

## Getting Started
### Prerequisites
- Node.js
- PostgreSQL

### Installation
1. Clone the repository.
2. Install dependencies for both backend and frontend:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

### Running the App
1. Setup the database and environment variables.
2. Start the backend:
   ```bash
   cd backend
   npm run start:dev
   ```
3. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## CAD Editor Keyboard Shortcuts

### Tools
- **V**: Pointer Tool
- **Z**: Zoom Window Tool
- **E**: Eraser Tool
- **T**: Add Text Tool
- **L**: Draw Line Tool
- **R**: Draw Arrow Tool
- **C**: Draw Circle Tool
- **U**: Draw Curve Tool
- **P**: Draw Polygon Tool

### Action Shortcuts
- **Delete / Backspace**: Delete selected object
- **Ctrl + Z**: Undo
- **Ctrl + Y** or **Ctrl + Shift + Z**: Redo
- **Ctrl + V**: Paste clipboard content
- **Escape**: Cancel drawing, exit text editing, or deselect object
- **Enter**: Finish drawing (Polygon, Curve, etc.) or finish text editing
- **Hold Spacebar**: Pan canvas (drag to move)


## ODA File Converter Setup

To automatically convert `.dwg` files in the CAD Conversion Studio, you must install the ODA File Converter. Without this, only `.dxf` uploads will be supported.

### 1. Required Software
- **ODA File Converter** (Provided by the Open Design Alliance)

### 2. Download Instructions
- Go to the [ODA File Converter Download Page](https://www.opendesign.com/guestfiles/oda_file_converter).
- Download the appropriate installer for your Operating System (e.g., Windows 64-bit).

### 3. Installation Instructions
- Run the downloaded installer.
- Follow the standard installation prompts.
- Make note of the installation directory (e.g., `C:\Program Files\ODA\ODAFileConverter.exe`).

### 4. Environment Variables
Add the path to the ODA executable to your backend environment variables (e.g., `.env` file in the `backend/` directory):
```env
ODA_CONVERTER_PATH="C:\Program Files\ODA\ODAFileConverter.exe"
```

### 5. Folder Structure
When a DWG is uploaded, the backend temporarily creates input and output folders inside `uploads/cad/`:
- `temp_in_<id>/`: Holds the original `.dwg` file for the converter to read.
- `temp_out_<id>/`: Where the converter outputs the resulting `.dxf`.
These folders are automatically deleted after a successful or failed conversion.

### 6. How the conversion pipeline works
The automated pipeline executes the following workflow seamlessly:
```text
DWG
↓
ODA File Converter
↓
DXF
↓
DXF Parser
↓
SVG
↓
Frontend Viewer
```

### 7. Troubleshooting

- **ODA executable not found**: The backend throws an error if `ODA_CONVERTER_PATH` is not defined or the file does not exist at the specified path. Double-check your `.env` file.
- **Invalid environment variable**: Make sure there are no typos in `ODA_CONVERTER_PATH` and that the path points exactly to the executable (e.g., `ODAFileConverter.exe`).
- **Conversion failed**: Usually occurs if the DWG is corrupted or from a much newer unsupported AutoCAD version. 
- **Permission denied**: Ensure the backend process has read/write permissions to the `uploads/cad` directory.
- **Unsupported DWG version**: If you see empty outputs, check the ODA version compatibility.

### 8. Deployment Notes
Production servers **must** also have ODA File Converter installed and the `ODA_CONVERTER_PATH` environment variable configured. If deploying via Docker, you must include the installation of a compatible ODA File Converter Linux binary in your Dockerfile.