'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import Modal from '../ui/Modal';

const FIELD_OPTIONS = [
  { key: 'toolName', label: 'Tool name & type' },
  { key: 'domainTab', label: 'Domain / Tab' },
  { key: 'caller', label: 'Agent' },
  { key: 'decision', label: 'Decision & reason' },
  { key: 'risk', label: 'Risk level' },
  { key: 'detail', label: 'Output summary' },
  { key: 'masked', label: 'Masking details' },
];

function toCsv(rows, fields) {
  const header = fields.join(',');
  const body = rows
    .map((r) => fields.map((f) => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportAuditModal({ open, onClose, rows }) {
  const [format, setFormat] = useState('csv');
  const [fields, setFields] = useState(FIELD_OPTIONS.map((f) => f.key));

  const toggleField = (key) => {
    setFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleDownload = () => {
    const picked = fields.length ? fields : FIELD_OPTIONS.map((f) => f.key);
    if (format === 'json') {
      download('surf-audit-export.json', JSON.stringify(rows.map((r) => Object.fromEntries(picked.map((f) => [f, r[f]]))), null, 2), 'application/json');
    } else {
      download('surf-audit-export.csv', toCsv(rows, picked), 'text/csv');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export Audit Log"
      footer={
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg bg-surf px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Download size={14} /> Download export
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mut">Format</div>
          <div className="flex gap-4">
            {['csv', 'json'].map((f) => (
              <label key={f} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mut">Include fields</div>
          <div className="grid grid-cols-2 gap-1.5">
            {FIELD_OPTIONS.map((f) => (
              <label key={f.key} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" checked={fields.includes(f.key)} onChange={() => toggleField(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="text-xs text-mut">{rows.length} events will be exported.</div>
      </div>
    </Modal>
  );
}
