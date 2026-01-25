import React, { useRef } from 'react';
import { Upload, FileSpreadsheet, Shield, Cpu, Zap } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
}

export function FileUpload({ onFileSelect, loading }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-purple-100/40 via-purple-50/30 to-transparent rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-purple-50/30 via-purple-50/20 to-transparent rounded-full blur-3xl transform -translate-x-1/4 translate-y-1/4" />

      <header className="relative z-10 w-full px-8 py-5">
        <div className="flex items-center gap-3">
          <img
            src="/ambs_2022_icon(color) copy.png"
            alt="Ambassador Logo"
            className="w-10 h-10 object-contain"
          />
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-slate-800 leading-tight">Data Dash</span>
            <span className="text-xs text-slate-500 tracking-wide">Contract Reviewer Module</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-8 pb-24">
        <div className="text-center mb-12 max-w-2xl">
          <h1 className="text-5xl font-bold text-slate-900 mb-3 leading-tight">
            Data Dash
          </h1>
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mb-4 leading-tight">
            Verify Data at Lightning Speed
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed max-w-xl mx-auto">
            Transform hours of manual data validation into minutes. Import, review, verify against contracts, and export—all in one seamless workflow.
          </p>
        </div>

        <div className="w-full max-w-xl mb-8">
          <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-200 p-10 text-center hover:border-purple-300 transition-colors">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-50 to-purple-100 rounded-full mb-5">
              <FileSpreadsheet className="w-8 h-8 text-purple-600" />
            </div>

            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Drop your spreadsheet here
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Support for .xlsx, .xls, and .csv files. Drag & drop or click to browse.
            </p>

            <button
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </>
              ) : (
                'Browse Files'
              )}
            </button>

            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} hidden />
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 text-xs text-slate-400 uppercase tracking-widest font-medium mb-12">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Secure</span>
          </div>
          <span className="text-slate-300">-</span>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            <span>Local Processing</span>
          </div>
          <span className="text-slate-300">-</span>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Fast</span>
          </div>
        </div>

        <div className="w-full max-w-xl">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/80 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wide">How It Works</h3>
            <ol className="text-sm text-slate-600 space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                <span>Upload your data file in seconds</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                <span>Navigate records with intuitive row-by-row view</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                <span>Cross-reference against source contracts instantly</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-semibold">4</span>
                <span>Track validation progress in real-time</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-semibold">5</span>
                <span>Export clean, verified data ready for action</span>
              </li>
            </ol>
          </div>
        </div>

        <div className="mt-8 text-xs text-slate-400">
          <p>Column A: File Name (display only) | Column B: Contract Source (URL or text) | Columns C+: Data fields to verify</p>
        </div>
      </main>
    </div>
  );
}
