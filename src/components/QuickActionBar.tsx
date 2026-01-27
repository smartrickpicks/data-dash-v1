import { BookOpen, Shield, Flag, ClipboardCheck } from 'lucide-react';

interface QuickActionBarProps {
  onGlossaryUpload: (file: File) => void;
  onOpenBlacklistManager: () => void;
  onOpenReviewerDashboard: () => void;
  glossaryLoaded: boolean;
  canFlag?: boolean;
  onFlag?: () => void;
}

export function QuickActionBar({
  onGlossaryUpload,
  onOpenBlacklistManager,
  onOpenReviewerDashboard,
  glossaryLoaded,
  canFlag = false,
  onFlag,
}: QuickActionBarProps) {
  return (
    <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5">
      <div className="flex items-center gap-1">
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-sm cursor-pointer transition-colors">
          <BookOpen className="w-4 h-4" />
          <span>{glossaryLoaded ? 'Glossary' : 'Upload Glossary'}</span>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onGlossaryUpload(file);
              e.target.value = '';
            }}
            hidden
          />
        </label>

        <button
          onClick={onOpenBlacklistManager}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-sm transition-colors"
        >
          <Shield className="w-4 h-4" />
          <span>Blacklist</span>
        </button>

        <button
          onClick={onOpenReviewerDashboard}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-sm transition-colors"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Review Dashboard</span>
        </button>

        {canFlag && onFlag && (
          <button
            onClick={onFlag}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded text-sm transition-colors"
          >
            <Flag className="w-4 h-4" />
            <span>Flag</span>
          </button>
        )}
      </div>
    </div>
  );
}
