# Runbook (Local / Replit)

## Quick Start

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Production build
npm run build

# Start production server (uses $PORT or 5173)
npm run start
```

## Port Behavior

- Dev server runs on port `5173` by default
- Production server uses `$PORT` env var (Replit sets this automatically) or falls back to `5173`
- Server binds to `0.0.0.0` for external access

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth client ID (for Drive integration) |

## Setting Environment Variables

**Local Development:**
1. Copy `.env.example` to `.env`
2. Fill in your values

**Replit:**
1. Open the Secrets tab (lock icon in sidebar)
2. Add each variable as a secret

## Troubleshooting

- **App crashes on load**: Check browser console for missing env var errors
- **Missing env vars**: The app will fail-fast with a clear error listing missing variables
- **Port already in use**: Kill existing process or change PORT

---

See Field Intelligence Guide for questions, references, up-to-date glossary, + more
https://docs.google.com/document/d/1msjfVRSlFFnsTI-hinwGYBVpOLatmFqvsJecLcXG2sE/edit?usp=sharing


<img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/7363e8ed-c886-4d30-8c3c-21dd68ccc12e" />

## Demo

Data Dash V1 Demo: https://contract-extraction-nfh3.bolt.host

See demo on Youtube below

 <p align="center">
  <a href="https://youtu.be/K9dDxGmoWVI">
    <img src="https://img.youtube.com/vi/K9dDxGmoWVI/0.jpg" alt="DataDash Demo" width="600" />
  </a>
</p>

A walkthrough of DataDash's contract data review workflow and Field Intelligence Guides.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/smartrickpicks/data-dash-v1/blob/main/LICENSE)
![Version](https://img.shields.io/badge/version-0.0.0-blue)

data-dash-v1 is a modern, TypeScript-based React dashboard application built with Vite. It provides powerful data processing and visualization capabilities, integrating Excel, PDF, and CSV parsing tools to streamline data analysis workflows.

## Features
- Interactive data dashboards using React and TypeScript
- Import and parse Excel (.xlsx) and CSV files with `exceljs` and `papaparse`
- **Advanced PDF rendering with S3 bucket support and intelligent text highlighting** - [Read the technical docs](docs/PDF_RENDERING_FEATURE.md)
  - Automatic CORS bypass via secure HTTP proxy
  - Real-time field value highlighting in PDF documents
  - Smart caching with IndexedDB for instant repeat loads
  - Interactive legend and filtering for highlighted fields
- Clean and responsive UI enhanced with Tailwind CSS and Lucide icons
- Fast development experience powered by Vite
- Built-in linting and type-checking for code quality assurance

## Installation

1. Clone the repository
   ```bash
   git clone https://github.com/smartrickpicks/data-dash-v1.git
   cd data-dash-v1
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Start the development server
   ```bash
   npm run dev
   ```
4. Open your browser at `http://localhost:5173` to access the dashboard

## Usage

- Use the dashboard UI to upload Excel or CSV files for instant parsing and data visualization.
- View PDF documents directly within the app with support for navigation and zoom.
- Customize and build reports based on your data using the integrated tools.
- To build the production version, run:
  ```bash
  npm run build
  ```
- To preview the production build locally:
  ```bash
  npm run preview
  ```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a pull request detailing your changes

Ensure code quality with linting and type checking before submitting:

```bash
npm run lint
npm run typecheck
```

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/smartrickpicks/data-dash-v1/blob/main/LICENSE) file for details.
