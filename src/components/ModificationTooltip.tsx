import { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { ModificationMetadata } from '../types';

interface ModificationTooltipProps {
  modification: ModificationMetadata;
}

export function ModificationTooltip({ modification }: ModificationTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isAddressStandardized = modification.modificationType === 'address_standardized';
  const isIncomplete = modification.modificationType === 'incomplete_address';

  let badgeColor = 'bg-blue-100 text-blue-700';
  let badgeText = 'Modified';

  if (isAddressStandardized) {
    badgeColor = 'bg-green-100 text-green-700';
    badgeText = 'Address Standardized';
  } else if (isIncomplete) {
    badgeColor = 'bg-yellow-100 text-yellow-700';
    badgeText = 'Incomplete Address';
  }

  return (
    <div className="relative inline-block">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full cursor-help ${badgeColor}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Edit3 className="w-3 h-3" />
        {badgeText}
      </span>

      {isHovered && (
        <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-slate-900 text-white text-xs rounded-lg shadow-xl p-3 space-y-2">
          <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 rotate-45"></div>

          <div>
            <div className="font-semibold text-slate-300 mb-1">Original Value:</div>
            <div className="bg-slate-800 rounded px-2 py-1.5 font-mono break-words">
              {modification.originalValue !== null && modification.originalValue !== undefined
                ? String(modification.originalValue)
                : '(empty)'}
            </div>
          </div>

          <div>
            <div className="font-semibold text-slate-300 mb-1">Current Value:</div>
            <div className="bg-slate-800 rounded px-2 py-1.5 font-mono break-words">
              {modification.newValue !== null && modification.newValue !== undefined
                ? String(modification.newValue)
                : '(empty)'}
            </div>
          </div>

          <div>
            <div className="font-semibold text-slate-300 mb-1">Reason:</div>
            <div className="text-slate-200">{modification.reason}</div>
          </div>
        </div>
      )}
    </div>
  );
}
