import { useState, useMemo } from 'react';
import { X, Plus, Search, Trash2, Edit3, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { BlacklistEntry, BlacklistEntryType, BlacklistMatchMode, BlacklistScope } from '../types';

interface BlacklistManagerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: BlacklistEntry[];
  onAdd: (
    value: string,
    type: BlacklistEntryType,
    matchMode: BlacklistMatchMode,
    scope: BlacklistScope,
    fields: string[]
  ) => void;
  onUpdate: (id: string, updates: Partial<BlacklistEntry>) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  availableFields: string[];
  prefillValue?: string | null;
}

const TYPE_LABELS: Record<BlacklistEntryType, string> = {
  name: 'Name',
  address: 'Address',
  email: 'Email',
  domain: 'Domain',
  custom: 'Custom',
};

const TYPE_COLORS: Record<BlacklistEntryType, string> = {
  name: 'bg-blue-100 text-blue-700',
  address: 'bg-green-100 text-green-700',
  email: 'bg-amber-100 text-amber-700',
  domain: 'bg-rose-100 text-rose-700',
  custom: 'bg-slate-100 text-slate-700',
};

export function BlacklistManager({
  isOpen,
  onClose,
  entries,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
  availableFields,
  prefillValue,
}: BlacklistManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(!!prefillValue);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newValue, setNewValue] = useState(prefillValue || '');
  const [newType, setNewType] = useState<BlacklistEntryType>('custom');
  const [newMatchMode, setNewMatchMode] = useState<BlacklistMatchMode>('contains');
  const [newScope, setNewScope] = useState<BlacklistScope>('global');
  const [newFields, setNewFields] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return entries;
    const term = searchTerm.toLowerCase();
    return entries.filter(
      (e) =>
        e.value.toLowerCase().includes(term) ||
        e.type.toLowerCase().includes(term) ||
        e.fields.some((f) => f.toLowerCase().includes(term))
    );
  }, [entries, searchTerm]);

  const resetForm = () => {
    setNewValue('');
    setNewType('custom');
    setNewMatchMode('contains');
    setNewScope('global');
    setNewFields([]);
    setShowAdvanced(false);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    if (!newValue.trim()) return;
    onAdd(newValue.trim(), newType, newMatchMode, newScope, newScope === 'field_specific' ? newFields : []);
    resetForm();
  };

  const handleFieldToggle = (field: string) => {
    setNewFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this blacklist entry?')) {
      onDelete(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-slate-900">Global Blacklist</h2>
            <span className="text-sm text-slate-500">({entries.length} entries)</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Entry
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Value to flag
                </label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g., John Smith, test@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Match Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewMatchMode('contains')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        newMatchMode === 'contains'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Contains
                    </button>
                    <button
                      onClick={() => setNewMatchMode('exact')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        newMatchMode === 'exact'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Exact
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Type (optional)
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as BlacklistEntryType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="custom">Custom</option>
                    <option value="name">Name</option>
                    <option value="address">Address</option>
                    <option value="email">Email</option>
                    <option value="domain">Domain</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                >
                  {showAdvanced ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Field-specific (Advanced)
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-4 mb-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="scope"
                          checked={newScope === 'global'}
                          onChange={() => setNewScope('global')}
                          className="text-blue-600"
                        />
                        <span className="text-sm text-slate-700">Global (all fields)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="scope"
                          checked={newScope === 'field_specific'}
                          onChange={() => setNewScope('field_specific')}
                          className="text-blue-600"
                        />
                        <span className="text-sm text-slate-700">Specific fields only</span>
                      </label>
                    </div>

                    {newScope === 'field_specific' && (
                      <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                        {availableFields.length === 0 ? (
                          <p className="text-sm text-slate-500 italic">
                            No fields available. Upload a dataset first.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-1">
                            {availableFields.map((field) => (
                              <label
                                key={field}
                                className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={newFields.includes(field)}
                                  onChange={() => handleFieldToggle(field)}
                                  className="text-blue-600 rounded"
                                />
                                <span className="text-sm text-slate-700 truncate" title={field}>
                                  {field}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newValue.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to Blacklist
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">
                {searchTerm ? 'No entries match your search' : 'No blacklist entries yet'}
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Add values to flag during review
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                    entry.enabled
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-100 bg-slate-50 opacity-60'
                  }`}
                >
                  <button
                    onClick={() => onToggle(entry.id)}
                    className="flex-shrink-0"
                    title={entry.enabled ? 'Disable' : 'Enable'}
                  >
                    {entry.enabled ? (
                      <ToggleRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate" title={entry.value}>
                        {entry.value}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[entry.type]}`}>
                        {TYPE_LABELS[entry.type]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className={entry.matchMode === 'exact' ? 'text-amber-600' : ''}>
                        {entry.matchMode === 'exact' ? 'Exact match' : 'Contains'}
                      </span>
                      <span>-</span>
                      <span>
                        {entry.scope === 'global'
                          ? 'All fields'
                          : `Fields: ${entry.fields.join(', ')}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            Blacklist entries flag values during review. Hits appear as "Needs Attention" items and are included in the change log export.
          </p>
        </div>
      </div>
    </div>
  );
}
