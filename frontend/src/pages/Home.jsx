import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import "./Home.css";

const Home = () => {
  const [padName, setPadName] = useState("");
  const [recentPads, setRecentPads] = useState([]);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  // Load recent pads — also refresh when window regains focus (e.g. after returning from a pad)
  useEffect(() => {
    const load = () => {
      const stored = JSON.parse(localStorage.getItem("recentPads")) || [];
      setRecentPads(stored);
    };
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  const handleGo = () => {
    const trimmed = padName.trim().replace(/\s+/g, "-");
    if (!trimmed) return;
    navigate(`/${trimmed}`);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleGo();
  };

  return (
    <div className="home">
      {/* Theme toggle */}
      <button className="theme-toggle-home" onClick={toggle} title="Toggle theme">
        {theme === "dark" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>

      <div className="home-content">
        <h1 className="home-title">
          <span className="title-text">TEXT</span>
          <span className="title-accent">PAD</span>
        </h1>

        <p className="home-subtitle">
          Instant shareable notepads. Pick a name, start writing.<br />
          Auto-deletes in 24 hours.
        </p>

        {/* Input */}
        <div className="input-wrapper">
          <div className="input-row">
            <span className="input-prefix">textpad/</span>
            <input
              value={padName}
              onChange={(e) => setPadName(e.target.value)}
              onKeyDown={handleKey}
              placeholder="your-pad-name"
              className="home-input"
              spellCheck={false}
              autoFocus
            />
            <button onClick={handleGo} className="go-btn">
              Go →
            </button>
          </div>
        </div>

        {/* Recently Used */}
        {recentPads.length > 0 && (
          <div className="examples-row">
            <span className="examples-label">Recently used:</span>

            {recentPads.map((pad) => (
              <button
                key={pad}
                className="example-chip"
                onClick={() => navigate(`/${pad}`)}
              >
                {pad}
              </button>
            ))}

            <button
              className="clear-btn"
              onClick={() => {
                localStorage.removeItem("recentPads");
                setRecentPads([]);
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Features */}
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">⚡</span>
            <span className="feature-title">Instant</span>
            <span className="feature-desc">No signup. Just go to any URL.</span>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🔄</span>
            <span className="feature-title">Real-time</span>
            <span className="feature-desc">Collaborate live with anyone.</span>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📧</span>
            <span className="feature-title">Email backup</span>
            <span className="feature-desc">Get your pad contents before deletion.</span>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🗑️</span>
            <span className="feature-title">Auto-delete</span>
            <span className="feature-desc">Everything clears after 24 hours.</span>
          </div>
        </div>
      </div>

      <footer className="home-footer">
        <span>TextPad — text lives here, briefly.</span>
      </footer>
    </div>
  );
};

export default Home;
