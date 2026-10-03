import React, { useEffect, useMemo, useRef, useState } from 'react';

interface SearchableSelectProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search widget type...',
  id,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        type="text"
        value={open ? query : value}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid var(--owt-color-border)',
          borderRadius: '4px',
          fontSize: '12px',
          background: 'var(--owt-widget-input-bg)',
          color: 'var(--owt-color-text)',
          boxSizing: 'border-box',
        }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '220px',
            overflowY: 'auto',
            background: 'var(--owt-color-bg)',
            border: '1px solid var(--owt-color-border-light)',
            borderRadius: '6px',
            boxShadow: '0 8px 20px var(--owt-color-shadow)',
            zIndex: 20,
          }}
        >
          {filteredOptions.length === 0 ? (
            <div
              style={{
                padding: '10px 12px',
                fontSize: '12px',
                color: 'var(--owt-color-text-muted)',
              }}
            >
              No matches
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    borderBottom: '1px solid var(--owt-color-border-light)',
                    background: isSelected ? 'var(--owt-color-primary-light)' : 'var(--owt-color-bg)',
                    color: 'var(--owt-color-text)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {option}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
