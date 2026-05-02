import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import Loader from "../components/Loader";
import { useTheme } from "../context/ThemeContext";
import "./Pad.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Stable singleton socket — created once when module loads, reused on navigation
const socket = io(API, { transports: ["websocket", "polling"] });

export default function Pad() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const [content, setContent] = useState("");
  const [status, setStatus] = useState("saved");
  const [loading, setLoading] = useState(true);
  const [myEmail, setMyEmail] = useState(() => localStorage.getItem(`textpad-email:${id}`) || "");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [expiresAt, setExpiresAt] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(1);

  const textareaRef = useRef(null);
  const isTypingRef = useRef(false);
  const saveTimerRef = useRef(null);

  const updateCounts = useCallback((text) => {
    setCharCount(text.length);
    setWordCount(text.trim() === "" ? 0 : text.trim().split(/\s+/).length);
  }, []);

  useEffect(() => {
    setLoading(true);
    setContent("");
    setMyEmail(localStorage.getItem(`textpad-email:${id}`) || "");
    setExpiresAt(null);
    setStatus("saved");
    updateCounts("");

    axios.get(`${API}/api/pad/${id}`)
      .then(res => {
        setContent(res.data.content || "");
        setExpiresAt(res.data.expiresAt);
        updateCounts(res.data.content || "");
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setStatus("error");
      });
  }, [id, updateCounts]);

  // Save to Recently Used
  useEffect(() => {
    if (!id) return;
    let recent = JSON.parse(localStorage.getItem("recentPads")) || [];
    recent = recent.filter(p => p !== id);
    recent.unshift(id);
    if (recent.length > 5) recent = recent.slice(0, 5);
    localStorage.setItem("recentPads", JSON.stringify(recent));
  }, [id]);

  useEffect(() => {
    socket.emit("joinPad", id);

    const handleUpdate = (newContent) => {
      if (!isTypingRef.current) {
        setContent(newContent);
        updateCounts(newContent);
      }
    };
    const handleUserCount = (count) => setConnectedUsers(count);

    socket.on("update", handleUpdate);
    socket.on("userCount", handleUserCount);

    return () => {
      socket.off("update", handleUpdate);
      socket.off("userCount", handleUserCount);
    };
  }, [id, updateCounts]);

  useEffect(() => {
    if (loading) return;
    clearTimeout(saveTimerRef.current);
    setStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      axios.post(`${API}/api/pad/${id}`, { content })
        .then(() => setStatus("saved"))
        .catch(() => setStatus("error"));
    }, 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [content, id, loading]);

  const handleChange = (e) => {
    const val = e.target.value;
    isTypingRef.current = true;
    setContent(val);
    updateCounts(val);
    socket.emit("typing", { padId: id, content: val });
    clearTimeout(isTypingRef._timer);
    isTypingRef._timer = setTimeout(() => { isTypingRef.current = false; }, 600);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEmailModal = () => {
    setEmailInput(myEmail);
    setEmailError("");
    setShowEmailModal(true);
  };

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const saveEmail = async () => {
    const trimmed = emailInput.trim().toLowerCase();

    if (!trimmed) {
      if (myEmail) {
        setEmailSaving(true);
        try {
          await axios.delete(`${API}/api/pad/${id}/email`, { data: { email: myEmail } });
        } catch { /* best effort */ }
        localStorage.removeItem(`textpad-email:${id}`);
        setMyEmail("");
        setEmailSaving(false);
      }
      setShowEmailModal(false);
      return;
    }

    if (!validateEmail(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setEmailSaving(true);
    setEmailError("");
    try {
      if (myEmail && myEmail !== trimmed) {
        await axios.delete(`${API}/api/pad/${id}/email`, { data: { email: myEmail } });
      }
      await axios.post(`${API}/api/pad/${id}/email`, { email: trimmed });
      localStorage.setItem(`textpad-email:${id}`, trimmed);
      setMyEmail(trimmed);
      setShowEmailModal(false);
    } catch {
      setEmailError("Failed to save email. Try again.");
    }
    setEmailSaving(false);
  };

  const removeEmail = async () => {
    setEmailSaving(true);
    try {
      await axios.delete(`${API}/api/pad/${id}/email`, { data: { email: myEmail } });
    } catch { /* best effort */ }
    localStorage.removeItem(`textpad-email:${id}`);
    setMyEmail("");
    setEmailSaving(false);
    setShowEmailModal(false);
  };

  const getTimeLeft = () => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return "Expiring now";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  if (loading) return <Loader />;

  return (
    <div className="pad-page">
      <header className="pad-header">
        <div className="header-left">
          <button className="icon-btn" onClick={() => navigate("/")} title="Home">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
          <div className="pad-id-chip">
            <span className="pad-id-dot"></span>
            <span className="pad-id-text">{id}</span>
          </div>
        </div>

        <div className="header-right">
          <span className={`status-badge ${status}`}>
            {status === "saving" && <span className="saving-spinner"></span>}
            {status === "saved" && "✓ Saved"}
            {status === "saving" && "Saving..."}
            {status === "error" && "⚠ Error"}
          </span>

          <button
            className={`header-btn ${myEmail ? "active" : ""}`}
            onClick={openEmailModal}
            title={myEmail ? `Your backup: ${myEmail}` : "Get email backup"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={myEmail ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span>Notify</span>
            {myEmail && <span className="active-dot"></span>}
          </button>

          <button className="header-btn" onClick={copyLink} title="Copy link">
            {copied ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span>Share</span>
              </>
            )}
          </button>

          <button className="icon-btn" onClick={() => setShowInfo(v => !v)} title="Info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>

          <button className="icon-btn" onClick={toggle} title="Toggle theme">
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {showInfo && (
        <div className="info-panel" onClick={() => setShowInfo(false)}>
          <div className="info-card" onClick={e => e.stopPropagation()}>
            <div className="info-row">
              <span className="info-label">Pad</span>
              <span className="info-value">{id}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Expires</span>
              <span className="info-value">{expiresAt ? new Date(expiresAt).toLocaleString() : "—"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Time left</span>
              <span className="info-value expire-warn">{getTimeLeft() || "—"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Your notify</span>
              <span className="info-value">{myEmail || "Not set"}</span>
            </div>
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        placeholder={`Start writing in "${id}"...\n\nThis pad will be auto-deleted after 24 hours.\nClick Notify to get an email backup before it's gone.`}
        className="pad-textarea"
        spellCheck={true}
      />

      <footer className="pad-footer">
        <span className="footer-stat">{wordCount} words</span>
        <span className="footer-dot">·</span>
        <span className="footer-stat">{charCount} chars</span>
        <span className="footer-dot">·</span>
        <span className="footer-stat expire-text">{getTimeLeft() || "24h"}</span>
        {connectedUsers > 1 && (
          <>
            <span className="footer-dot">·</span>
            <span className="footer-stat collab">
              <span className="collab-dot"></span>
              {connectedUsers} online
            </span>
          </>
        )}
      </footer>

      {showEmailModal && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">📧</div>
              <div>
                <h2 className="modal-title">Email Backup</h2>
                <p className="modal-subtitle">Only you can see this — other users set their own</p>
              </div>
              <button className="modal-close" onClick={() => setShowEmailModal(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-info-box">
                <span>🗑️</span>
                <span>You'll get an email when this pad is <strong>deleted</strong>, with a full copy of its contents.</span>
              </div>

              <label className="modal-label">Your email address</label>
              <input
                type="email"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setEmailError(""); }}
                onKeyDown={e => e.key === "Enter" && saveEmail()}
                placeholder="you@example.com"
                className={`modal-input ${emailError ? "error" : ""}`}
                autoFocus
              />
              {emailError && <span className="modal-error">{emailError}</span>}

              <div className="modal-actions">
                {myEmail && (
                  <button className="btn-danger" onClick={removeEmail} disabled={emailSaving}>
                    Remove
                  </button>
                )}
                <button className="btn-cancel" onClick={() => setShowEmailModal(false)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={saveEmail} disabled={emailSaving}>
                  {emailSaving ? "Saving..." : myEmail ? "Update" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
