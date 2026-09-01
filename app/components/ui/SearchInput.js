import { Search } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mut" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-64 rounded-lg border border-line bg-card py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-mut focus:border-surf focus:outline-none"
      />
    </div>
  );
}
