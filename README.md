# CAD Conversion & Layout Project

## Overview

Layout is a comprehensive web application for managing architectural projects, files, and annotations. It allows users to upload architectural plans (PDFs, Images, CAD DWG/DXF), automatically convert them into interactive SVG formats, detect individual plots, and provide a rich web-based editor to modify, annotate, and manage these layouts. Finally, the converted and edited layouts can be overlaid on a real-world map using Leaflet, allowing for accurate geographical positioning and visualization of real estate or construction projects.

The complete workflow seamlessly integrates backend CAD parsing and plot detection with a highly interactive frontend canvas editor and map viewer.

---

## Features

- **Project Management**: Create and manage multiple architectural and CAD projects.
- **File Handling**: Upload and process architectural files (PDFs, Images, DWG, DXF).
- **Interactive Canvas**: Annotate and place overlays on architectural plans using a rich interactive canvas.
- **Land Boundaries**: Draw and manage land boundaries on maps.
- **Version Control**: Take snapshots of project versions.
- **CAD Conversion**: DWG to SVG automated pipeline.
- **SVG Generation**: Render complex vector layouts for the web.
- **Plot Detection (via OpenCV)**: Automatically find enclosed plots in CAD files.
- **Interactive SVG Editor**: Edit, manage, and colorize vectors directly in the browser.
- **Tools**: Pointer Tool, Selection Tool, Paint Bucket (Plot Status coloring).
- **Layer Management & Properties Panel**.
- **SVG Save & Normalization**.
- **Leaflet Map Viewer**: Overlay Rendering, Zoom & Pan, Transform Controls.
- **Amenities Placement**.
- **Legacy SVG Migration**.
- **Exporting**: Export project designs and annotations.

---

## Tech Stack

**Frontend**
- **Framework**: Next.js (16.x) / React (19.x)
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Canvas/Graphics**: Konva (`react-konva`), HTML/SVG
- **Maps**: Leaflet (`react-leaflet`)
- **PDF Rendering**: `react-pdf`, `pdfjs-dist`
- **Drag & Drop**: `@dnd-kit`
- **Build Tools**: Webpack / Next Build
- **Icons**: Lucide-React

**Backend**
- **Framework**: NestJS (11.x)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT, Passport, Bcrypt
- **Image/PDF Processing**: Sharp, Canvas, `pdfjs-dist`, `html-to-image`
- **CAD/Vision**: OpenCV.js, dxf-parser
- **File Archiving**: Archiver, Unzipper

---

## Project Structure

```text
.
├── backend                 # NestJS Backend API
│   ├── prisma              # Database schema and migrations
│   ├── src                 # Backend source code (Controllers, Services)
│   │   ├── cad-conversion  # CAD parsing and conversion logic
│   │   ├── cad-projects    # Project management
│   │   ├── plot-status     # Plot configuration
│   │   └── ...
│   └── uploads             # Temporary storage for uploaded CAD files
├── frontend                # Next.js Frontend Application
│   ├── public              # Static assets
│   └── src
│       ├── app             # Next.js App Router pages
│       ├── components      # Reusable React components
│       │   ├── cad-conversion  # Editor workspaces, dashboards, canvas
│       │   └── map         # Map viewer and transform nodes
│       └── lib             # Utility functions and API clients
└── README.md
```

### Folder Responsibilities

- `backend/`: Contains the complete NestJS application handling API requests, file uploads, CAD processing, and database interactions.
- `backend/prisma/`: Holds the `schema.prisma` file defining the PostgreSQL database models and relationships.
- `backend/src/cad-conversion/`: Core backend domain for handling DWG/DXF parsing, SVG rendering, and plot detection.
- `frontend/src/app/`: Next.js App Router defining the application's page structure and routing.
- `frontend/src/components/`: Modular React components. The `cad-conversion` subfolder houses the editor canvas and toolbars, while the `map` subfolder contains Leaflet integration.
- `frontend/src/lib/`: Reusable utilities and shared configuration.

---

## Application Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page / Application root. |
| `/cad-conversion` | Main dashboard listing all CAD projects. |
| `/cad-conversion/[projectId]` | Dashboard for a specific project, showing details and available conversions. |
| `/cad-conversion/[projectId]/editor/[drawingId]` | The highly interactive SVG Canvas Editor for a specific drawing. |
| `/cad-conversion/[projectId]/map` | Map Workspace to overlay the converted SVG onto a real-world map. |
| `/cad-conversion/[projectId]/plot-statuses` | Configuration page to manage status labels and colors for plots. |
| `/cad-conversion/[projectId]/plots` | List and details of all detected plots in a project. |
| `/masters/amenities` | Management interface for reusable amenities (icons, dimensions). |

---

## Backend API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cad-projects` | GET, POST, PATCH, DELETE | Manage projects. |
| `/api/cad-conversion/upload` | POST | Upload a new DWG/DXF file and initiate conversion. |
| `/api/cad-conversion/:id` | GET, PATCH, DELETE | Manage individual CAD conversion records. |
| `/api/cad-conversion/:id/svg` | GET, PUT | Retrieve or save the edited SVG document. |
| `/api/cad-conversion/:id/composite-svg` | GET | Retrieve the final composite SVG with amenities. |
| `/api/plot-status/project/:projectId` | GET, POST, PATCH, DELETE | Manage plot statuses and their colors for a project. |
| `/api/project-plot` | GET, POST, PATCH, DELETE | Manage detected or manually created plots. |
| `/api/projects/:id/boundaries` | GET, POST | Manage project map boundaries (GeoJSON). |
| `/api/amenity` | GET, POST, PATCH, DELETE | Manage global amenities library. |
| `/api/amenity-placement` | GET, POST, PATCH, DELETE | Manage amenities placed within a specific CAD conversion. |

---

## Overall Workflow

**Project** 
↓ 
**Upload DWG** 
↓ 
**Conversion Pipeline** 
↓ 
**SVG Generation** 
↓ 
**Plot Detection** 
↓ 
**Normalized SVG** 
↓ 
**Editor** 
↓ 
**Save** 
↓ 
**Map Viewer**

---

## CAD Conversion Workflow

**DWG** 
↓ 
**DXF Parsing** (Extracting vectors) 
↓ 
**Entity Extraction** (Lines, Polylines, Text) 
↓ 
**SVG Renderer** (Initial SVG construction) 
↓ 
**Plot Detection** (Using OpenCV to find closed polygons) 
↓ 
**Normalization** (Standardizing coordinate spaces) 
↓ 
**Store SVG** 
↓ 
**Editor**

---

## Frontend Workflow

**User** 
↓ 
**Route** (Selects project/drawing) 
↓ 
**Workspace** (Initializes environment) 
↓ 
**Canvas** (Renders SVG/Konva) 
↓ 
**Selection / Tool Usage** (Modify, bucket fill, place amenities) 
↓ 
**Save** (Syncs state to Backend)

---

## Database

The database uses PostgreSQL managed by Prisma. 

**Models:**
- **CadProject**: Core model representing a real estate or layout project. Links to boundaries, conversions, and plots.
- **CadConversion**: Represents a single uploaded CAD file and its processing status, file paths, and map transform data (scale, rotation).
- **ProjectBoundary**: GeoJSON data representing the project's physical boundary on a map.
- **PlotStatus**: Defines customizable statuses (e.g., "Sold", "Available") and their associated colors.
- **ProjectPlot**: Represents an individual plot/polygon detected in the CAD, linking its area, dimensions, and current `PlotStatus`.
- **Amenity**: Global dictionary of placeable amenities (e.g., Parks, Trees, Gates).
- **AmenityPlacement**: An instance of an Amenity placed on a specific `CadConversion`.

---

## State Management

The application utilizes **Zustand** for state management to handle complex editor states without prop-drilling, efficiently managing:
- Selected tools (Pointer, Paint Bucket)
- Current selection (active plot or amenity)
- Canvas transform properties (Zoom/Pan state)
- Editor layer visibility
- Map overlay positioning

---

## Important Components

- **CadEditorWorkspace**: The main container component for the editor route, assembling the sidebar, toolbar, and canvas.
- **CadEditorCanvas**: The core interactive rendering surface utilizing React-Konva to render SVG shapes, handle zoom/pan, and manage user interactions.
- **CadEditorSidebar**: Left/Right panel displaying properties, layers, and available amenities.
- **CadEditorToolbar / TopBar**: Contains tool buttons (Pointer, Paint Bucket, Save).
- **TransformControls**: Interactive gizmos to scale, rotate, and position overlay amenities.
- **ProjectMapWorkspace**: The container for the Leaflet map view.
- **LeafletMap**: Renders the geographical map.
- **LayoutTransformNode**: Handles the interactive overlay and manipulation of the SVG on top of the Leaflet map.

---

## Services

- **cad-conversion.service.ts**: Manages the lifecycle of a conversion record and interfaces with the database.
- **conversion-pipeline.service.ts**: Orchestrates the multi-step process of turning a raw CAD file into an SVG, including unzip, parse, and render steps.
- **plot-detection.service.ts**: Utilizes OpenCV.js to process the geometry, identifying closed loops and distinct plots within the complex CAD vector data.

---

## Getting Started

### Prerequisites
- Node.js
- PostgreSQL

### Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd layout
   ```
2. Install dependencies for both backend and frontend:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Set up Database:
   - Create `.env` files in both directories based on provided templates.
   - Example Backend (`backend/.env`):
     ```env
     DATABASE_URL="postgresql://user:password@localhost:5432/layout_db"
     ```
   - Generate Prisma models:
     ```bash
     cd backend
     npx prisma generate
     npx prisma db push
     ```

### Running the App
1. Start the backend:
   ```bash
   cd backend
   npm run start:dev
   ```
2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

---

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

---

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

---

## Development Workflow

1. Ensure the PostgreSQL database is running and `DATABASE_URL` is correct.
2. Start the NestJS backend on its default port.
3. Start the Next.js frontend, which will proxy or connect directly to the backend API.
4. Any changes to Prisma models require `npx prisma db push` and restarting the backend.
5. Use `npm run lint` in both directories to maintain code quality.

---

## Build

To build the project for production:

**Backend:**
```bash
cd backend
npm run build
npm run start:prod
```

**Frontend:**
```bash
cd frontend
npm run build
npm run start
```

---

## Future Improvements

- Implementation of WebSockets for real-time collaborative editing.
- Advanced CAD entity support (Splines, Hatches).
- Export edited layouts back to DXF/PDF formats.
- Role-Based Access Control (RBAC) for project permissions.
- Automated tests (E2E and unit testing for the conversion pipeline).

---

## License

MIT License