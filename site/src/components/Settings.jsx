import { useState } from 'react';
import { getApiKey, setApiKey } from '../utils/data';

export default function Settings({ open, onClose }) {
  const [key, setKey] = useState(getApiKey());
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: 'var(--white)', borderRadius: '12px', padding: '2rem',
        maxWidth: '500px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Settings</h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            Anthropic API Key
          </label>
          <input
            type="password"
            className="input"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="sk-ant-..."
          />
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Stored locally in your browser. Never transmitted except directly to the Anthropic API.
            Required for AI-generated content (key arguments, glossary, synthesis).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
