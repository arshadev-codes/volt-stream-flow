import { Minus, Square, X, FileText } from 'lucide-react';

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

export function CustomTitleBar({ onViewLicense }: { onViewLicense: () => void }) {
  // Agar Electron ke bahar (normal browser) khula hai, to ye bar dikhega hi nahi
  if (typeof window === 'undefined' || !window.electronAPI) return null;

  return (
    <div
      style={{
        height: 36,
        background: '#0f1015',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // @ts-ignore
        WebkitAppRegion: 'drag',
        borderBottom: '1px solid #1f2029',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
        <span style={{ color: '#f97316', fontSize: 12.5, fontWeight: 600 }}>
          Reactor Linearity Testing System
        </span>
      </div>

      <div style={{ display: 'flex', height: '100%' }}>
        <button
          onClick={onViewLicense}
          title="View License Agreement"
          style={{ ...btnStyle, color: '#a1a1aa' }}
        >
          <FileText size={14} />
        </button>
        <button
          onClick={() => window.electronAPI?.minimize()}
          style={{ ...btnStyle, color: '#d1d5db' }}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.electronAPI?.maximize()}
          style={{ ...btnStyle, color: '#d1d5db' }}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.electronAPI?.close()}
          style={{ ...btnStyle, color: '#d1d5db' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#dc2626')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 46,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  // @ts-ignore
  WebkitAppRegion: 'no-drag',
};