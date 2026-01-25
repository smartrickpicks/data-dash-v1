import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-slate-300">{title}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  );
}
