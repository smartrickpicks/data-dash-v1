# data-dash-v1 📊

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/smartrickpicks/data-dash-v1/blob/main/LICENSE)
![Version](https://img.shields.io/badge/version-0.0.0-blue)
  
data-dash-v1 is a modern, TypeScript-based React dashboard application built with Vite. It provides powerful data processing and visualization capabilities, integrating Excel, PDF, and CSV parsing tools to streamline data analysis workflows.

## ✨ Features
- Interactive data dashboards using React and TypeScript
- Import and parse Excel (.xlsx) and CSV files with `exceljs` and `papaparse`
- Render and manipulate PDF documents with `react-pdf` and `pdfjs-dist`
- Clean and responsive UI enhanced with Tailwind CSS and Lucide icons
- Fast development experience powered by Vite
- Built-in linting and type-checking for code quality assurance

## 🚀 Installation

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

## 💻 Usage

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

## 🤝 Contributing

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

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](https://github.com/smartrickpicks/data-dash-v1/blob/main/LICENSE) file for details.
```

---

**.env.example**

```env
# ====== API KEYS ======

# Example: API key for third-party data service
DATA_API_KEY=your_api_key_here
# Obtain your API key at https://example.com/api-keys

# ====== DATABASE CONNECTION ======

# Connection string for PostgreSQL database
# Format: postgres://user:password@host:port/database
DATABASE_URL=postgres://username:password@localhost:5432/datadash

# ====== SECURITY NOTES ======
# Keep your API keys and database credentials secret. 
# Do NOT commit real keys to source control.
# Use environment variables or secret managers in production.

# ====== OPTIONAL SETTINGS ======

# Server port (default is 3000)
PORT=3000
```