# Architecture Document

## High-Level Overview
The Layout project follows a standard client-server architecture with a Next.js frontend and a NestJS backend. The application relies on PostgreSQL as its primary data store, using Prisma as the ORM.

## System Components

### 1. Frontend (Next.js)
The frontend is responsible for providing a rich, interactive user interface for architectural planning and layout.
- **Interactive Canvas**: Uses `react-konva` for rendering complex architectural layouts, overlays, and annotations. It handles operations like drag-and-drop, scaling, rotating, and opacity adjustments.
- **Map Integration**: Uses `react-leaflet` to display maps and draw land boundaries (polygons, rectangles).
- **PDF Viewer**: Uses `react-pdf` to display uploaded architectural PDFs.
- **State Management**: Zustand handles the complex local state required for managing selected areas, layers, and project metadata without excessive re-renders.

### 2. Backend (NestJS)
The backend provides a RESTful API to serve the frontend, process complex files, and manage the database.
- **Controllers & Services**: Handle business logic such as project management, file uploads, and layer grouping.
- **Database Integration**: Prisma ORM is used for type-safe database queries.
- **File Processing**: Utilities like Sharp and Canvas are used for generating thumbnails and processing uploaded images/PDFs. Archiver is used for bundling exports.
- **Authentication**: Secured via JWT tokens and Passport.

### 3. Database Schema (PostgreSQL)
Key entities include:
- **Project**: The core entity that aggregates all related data.
- **ArchitectureFile**: Represents uploaded plans or diagrams.
- **SelectedArea & ArchitectureRegion**: Defines specific regions or pages within an `ArchitectureFile`.
- **Overlay**: Annotations or additional graphics placed on top of architectural files, linked to layers and layer groups.
- **LandBoundary**: Geographic coordinates outlining specific land areas.
- **ProjectVersion & ProjectExport**: Snapshots and exported artifacts of the project.

## Data Flow
1. **File Upload**: User uploads a PDF/Image on the frontend. The backend receives it, extracts metadata (pages, dimensions), generates thumbnails, and stores references in the database.
2. **Annotation/Overlay**: User interacts with the Konva canvas on the frontend to place overlays. Changes are synced to the backend via API calls and stored in the `Overlay` and `LayerGroup` tables.
3. **Exporting**: User requests an export. The backend gathers the project state, renders or packages the files, and returns a downloadable archive or document.

## Deployment Strategy
*(Add specific deployment instructions or environments here depending on your infrastructure setup, e.g., Docker, AWS, Vercel for frontend, etc.)*
