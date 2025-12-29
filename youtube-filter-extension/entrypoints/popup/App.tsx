import { useEffect, useState } from 'react';
import {
  getSettings,
  saveApiKey,
  saveEnabled,
  saveProfile,
  saveCustomBlockedCategories,
} from '@/utils/storage';
import { getDebugLogs, clearDebugLogs, type DebugLog } from '@/utils/debug';
import {
  ALL_CATEGORIES,
  PROFILE_PRESETS,
  type ProfileName,
  type VideoCategory,
} from '@/utils/types';
import './App.css';

type Status = 'idle' | 'saving' | 'saved' | 'error';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [profile, setProfile] = useState<ProfileName>('productive');
  const [customBlocked, setCustomBlocked] = useState<VideoCategory[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [loaded, setLoaded] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getSettings().then((settings) => {
      setApiKey(settings.apiKey);
      setEnabled(settings.enabled);
      setProfile(settings.profile);
      setCustomBlocked(settings.customBlockedCategories);
      setLoaded(true);
    });
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const debugLogs = await getDebugLogs();
    setLogs(debugLogs);
  };

  const handleApiKeyChange = async (value: string) => {
    setApiKey(value);
    setStatus('saving');
    try {
      await saveApiKey(value);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch {
      setStatus('error');
    }
  };

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    await saveEnabled(newValue);
  };

  const handleProfileChange = async (newProfile: ProfileName) => {
    setProfile(newProfile);
    await saveProfile(newProfile);
  };

  const handleCategoryToggle = async (category: VideoCategory) => {
    const newBlocked = customBlocked.includes(category)
      ? customBlocked.filter((c) => c !== category)
      : [...customBlocked, category];
    setCustomBlocked(newBlocked);
    await saveCustomBlockedCategories(newBlocked);
  };

  const handleClearLogs = async () => {
    await clearDebugLogs();
    setLogs([]);
  };

  if (!loaded) {
    return <div className="container">Loading...</div>;
  }

  const hasApiKey = apiKey.length > 0;
  const currentBlockedCategories =
    profile === 'custom'
      ? customBlocked
      : PROFILE_PRESETS[profile].blockedCategories;

  return (
    <div className="container">
      <h1>YouTube Filter</h1>

      <div className="status-row">
        <div className="status-badge" data-status={getStatusType(enabled, hasApiKey)}>
          {getStatusText(enabled, hasApiKey)}
        </div>
        <button
          className={`toggle ${enabled ? 'on' : 'off'}`}
          onClick={handleToggle}
          aria-pressed={enabled}
        >
          <span className="toggle-thumb" />
        </button>
      </div>

      {/* Profile Selector */}
      <div className="field">
        <label>Filter Profile</label>
        <div className="profile-buttons">
          {Object.values(PROFILE_PRESETS).map((p) => (
            <button
              key={p.name}
              className={`profile-btn ${profile === p.name ? 'active' : ''}`}
              onClick={() => handleProfileChange(p.name)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="hint">{PROFILE_PRESETS[profile].description}</span>
      </div>

      {/* Custom Categories */}
      {profile === 'custom' && (
        <div className="field">
          <label>Block these categories:</label>
          <div className="category-grid">
            {ALL_CATEGORIES.map((cat) => (
              <label key={cat} className="category-checkbox">
                <input
                  type="checkbox"
                  checked={customBlocked.includes(cat)}
                  onChange={() => handleCategoryToggle(cat)}
                />
                <span>{formatCategory(cat)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Blocked Categories Summary */}
      {profile !== 'custom' && currentBlockedCategories.length > 0 && (
        <div className="blocked-summary">
          <span className="blocked-label">Blocking:</span>
          {currentBlockedCategories.map((cat) => (
            <span key={cat} className="blocked-tag">
              {formatCategory(cat)}
            </span>
          ))}
        </div>
      )}

      {/* Advanced Settings */}
      <button
        className="advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? '▼' : '▶'} Advanced Settings
      </button>

      {showAdvanced && (
        <div className="advanced-section">
          <div className="field">
            <label htmlFor="apiKey">Anthropic API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="sk-ant-..."
            />
            {status === 'saved' && <span className="hint success">Saved!</span>}
            {status === 'error' && <span className="hint error">Error saving</span>}
          </div>

          {!hasApiKey && (
            <p className="hint">
              Get your API key at{' '}
              <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>
            </p>
          )}
        </div>
      )}

      {/* Debug Logs */}
      <div className="debug-section">
        <button
          className="debug-toggle"
          onClick={() => {
            setShowLogs(!showLogs);
            loadLogs();
          }}
        >
          {showLogs ? 'Hide' : 'Show'} Debug Logs ({logs.length})
        </button>

        {showLogs && (
          <div className="debug-panel">
            <div className="debug-header">
              <span>Recent Activity</span>
              <button className="debug-clear" onClick={handleClearLogs}>
                Clear
              </button>
            </div>
            {logs.length === 0 ? (
              <div className="debug-empty">No logs yet. Visit YouTube to see activity.</div>
            ) : (
              <div className="debug-logs">
                {logs.map((log, i) => (
                  <div key={i} className="debug-log">
                    <span className="debug-source">[{log.source}]</span>
                    <span className="debug-message">{log.message}</span>
                    <span className="debug-time">{formatTime(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusType(enabled: boolean, hasApiKey: boolean): string {
  if (!hasApiKey) return 'warning';
  if (!enabled) return 'disabled';
  return 'active';
}

function getStatusText(enabled: boolean, hasApiKey: boolean): string {
  if (!hasApiKey) return 'API key required';
  if (!enabled) return 'Disabled';
  return 'Active';
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default App;
