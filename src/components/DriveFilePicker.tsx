import { useState, useEffect, useCallback } from 'react';
import { X, Search, FileSpreadsheet, RefreshCw, HardDrive, Clock, File } from 'lucide-react';
import { DriveFile } from '../types';
import { listSpreadsheetFiles, searchFiles } from '../services/googleDrive';

interface DriveFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (file: DriveFile) => void;
  accessToken: string;
}

function formatFileSize(bytes?: string): string {
  if (!bytes) return '';
  const size = parseInt(bytes, 10);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return date.toLocaleDateString();
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  }
  if (mimeType === 'text/csv') {
    return <File className="w-5 h-5 text-blue-600" />;
  }
  return <File className="w-5 h-5 text-slate-500" />;
}

export function DriveFilePicker({ isOpen, onClose, onSelect, accessToken }: DriveFilePickerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const loadFiles = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const fileList = await listSpreadsheetFiles(accessToken);
      setFiles(fileList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const performSearch = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      if (debouncedSearch.trim()) {
        const results = await searchFiles(accessToken, debouncedSearch);
        setFiles(results);
      } else {
        const fileList = await listSpreadsheetFiles(accessToken);
        setFiles(fileList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, debouncedSearch]);

  useEffect(() => {
    if (isOpen && accessToken) {
      loadFiles();
    }
  }, [isOpen, accessToken, loadFiles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (isOpen) {
      performSearch();
    }
  }, [debouncedSearch, isOpen, performSearch]);

  const handleSelect = (file: DriveFile) => {
    onSelect(file);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Import from Google Drive</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search spreadsheets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-sm text-slate-600">Loading files...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button
                onClick={loadFiles}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-600 mb-1">No spreadsheets found</p>
              <p className="text-xs text-slate-500">
                {searchTerm ? 'Try a different search term' : 'Upload spreadsheets to your Drive first'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleSelect(file)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  {getFileIcon(file.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(file.modifiedTime)}
                      </span>
                      {file.size && (
                        <span className="text-xs text-slate-400">
                          {formatFileSize(file.size)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Select an Excel (.xlsx), CSV, or Google Sheets file to import
          </p>
        </div>
      </div>
    </div>
  );
}
