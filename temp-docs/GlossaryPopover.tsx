import React, { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { GlossaryEntry } from '../types';

interface GlossaryPopoverProps {
  entry: GlossaryEntry;
}

export function GlossaryPopover({ entry }: GlossaryPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const hasContent = entry.definition ||
    entry.expected_output ||
    entry.example_output ||
    (entry.allowed_values && entry.allowed_values.length > 0) ||
    entry.input_type ||
    (entry.synonyms && entry.synonyms.length > 0) ||
    (entry.label && entry.label !== entry.field_key);

  if (!hasContent) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded transition-colors ${
          isOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
        }`}
        aria-label="Field information"
      >
        <Info className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-2 z-50 w-72 bg-white border border-slate-200 rounded-lg shadow-lg"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Field Info</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          <div className="p-3 space-y-3 max-h-80 overflow-auto">
            {entry.definition && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Definition</p>
                <p className="text-sm text-slate-700 leading-relaxed">{entry.definition}</p>
              </div>
            )}

            {entry.expected_output && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Expected Output</p>
                <p className="text-sm text-slate-700 leading-relaxed">{entry.expected_output}</p>
              </div>
            )}

            {entry.example_output && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Example</p>
                <code className="block text-sm text-slate-800 bg-slate-100 px-2 py-1.5 rounded font-mono">
                  {entry.example_output}
                </code>
              </div>
            )}

            {entry.allowed_values && entry.allowed_values.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Allowed Values</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.allowed_values.map((value, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-200"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {entry.input_type && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Input Type</p>
                <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-medium capitalize">
                  {entry.input_type}
                </span>
              </div>
            )}

            {entry.synonyms && entry.synonyms.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Also Known As</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.synonyms.map((synonym, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-200"
                    >
                      {synonym}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
