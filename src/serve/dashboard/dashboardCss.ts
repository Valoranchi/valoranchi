export function renderDashboardCss(): string {
  return `:root {
  --bg-main: #0f1923;
  --bg-panel: #171f28;
  --bg-card: #1f2732;
  --bg-card-hover: #26313e;
  --accent: #ff4655;
  --accent-light: #ff6875;
  --accent-glow: rgba(255, 70, 85, 0.25);
  --text-primary: #ece8e1;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --border: rgba(255, 255, 255, 0.08);
  --border-focus: rgba(255, 70, 85, 0.5);
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --vp-gold: #f59e0b;
  --radianite-cyan: #06b6d4;
  --kc-purple: #a855f7;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: var(--bg-main);
  color: var(--text-primary);
  line-height: 1.5;
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 2rem;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(8px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-title {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--text-primary);
}

.nav-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 2px 8px var(--accent-glow);
}

.banner-offline {
  background: linear-gradient(90deg, #371b1e, #291a24);
  border-bottom: 1px solid rgba(255, 70, 85, 0.4);
  padding: 1rem 2rem;
  transition: all 0.3s ease;
}

.banner-offline.hidden {
  display: none;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.banner-icon {
  font-size: 1.75rem;
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.banner-retry {
  font-size: 0.85rem;
  color: var(--accent-light);
  font-style: italic;
}

.main-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.tab-pane {
  display: none;
}

.tab-pane.active {
  display: block;
}

.loading-placeholder {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 1.1rem;
}

.inline-error {
  padding: 1rem 1.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: #fca5a5;
  margin-bottom: 1.5rem;
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.home-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.profile-card-art {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-md);
  object-fit: cover;
  border: 2px solid var(--accent);
}

.profile-info h2 {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
}

.level-badge {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  margin-top: 0.35rem;
  color: var(--text-secondary);
}

.rank-display {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-top: 1rem;
}

.rank-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.rank-details h3 {
  font-size: 1.2rem;
  font-weight: 700;
}

.rr-text {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.fit-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.05);
  margin-top: 0.25rem;
}

.wallet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
}

.wallet-chip {
  flex: 1;
  min-width: 90px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wallet-val {
  font-size: 1.2rem;
  font-weight: 700;
}

.wallet-chip.vp .wallet-val { color: var(--vp-gold); }
.wallet-chip.rad .wallet-val { color: var(--radianite-cyan); }
.wallet-chip.kc .wallet-val { color: var(--kc-purple); }

.wallet-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-top: 0.2rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.countdown-timer {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--accent-light);
}

.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.skin-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.skin-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.2);
}

.skin-card.in-store {
  border-color: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}

.hit-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: var(--accent);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  letter-spacing: 0.05em;
}

.skin-img-wrap {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.skin-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.skin-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.skin-weapon {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.skin-meta {
  margin-top: auto;
  padding-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border);
}

.skin-price {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--vp-gold);
}

.skin-tier-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.bundle-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 2rem;
}

.bundle-banner {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  display: block;
}

.bundle-info {
  padding: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wishlist-toolbar {
  margin-bottom: 1.5rem;
}

.wishlist-input-group {
  display: flex;
  gap: 0.75rem;
  max-width: 600px;
}

.wishlist-input-group input {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 0.65rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
}

.wishlist-input-group input:focus {
  outline: none;
  border-color: var(--border-focus);
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.65rem 1.25rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-primary:hover {
  background: var(--accent-light);
}

.btn-remove {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-remove:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.inline-status {
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.matches-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.match-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left: 4px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 1rem 1.25rem;
  display: grid;
  grid-template-columns: 140px 180px 100px 140px 100px auto;
  align-items: center;
  gap: 1rem;
}

.match-item.win { border-left-color: var(--success); }
.match-item.loss { border-left-color: var(--danger); }
.match-item.draw { border-left-color: var(--text-muted); }

.match-badge {
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.6rem;
  border-radius: var(--radius-sm);
  display: inline-block;
}

.match-badge.win { background: rgba(16, 185, 129, 0.2); color: var(--success); }
.match-badge.loss { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
.match-badge.draw { background: rgba(156, 163, 175, 0.2); color: var(--text-secondary); }

.match-agent {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.agent-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--bg-panel);
}

.match-score {
  font-size: 1.15rem;
  font-weight: 700;
}

.match-kda {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.rr-change {
  font-weight: 700;
  font-size: 0.95rem;
}

.rr-change.plus { color: var(--success); }
.rr-change.minus { color: var(--danger); }

.friends-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.friend-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.85rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.presence-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.presence-dot.in-game { background: var(--success); }
.presence-dot.online { background: #38bdf8; }
.presence-dot.away { background: var(--warning); }

.friend-info {
  display: flex;
  flex-direction: column;
}

.friend-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.friend-activity {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.app-footer {
  border-top: 1px solid var(--border);
  padding: 2rem;
  background: var(--bg-panel);
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: auto;
}

.disclaimer {
  max-width: 800px;
  margin: 0 auto 1rem;
  line-height: 1.4;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.15s ease;
}

.footer-links a:hover {
  color: var(--accent);
}

@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }
  .nav-tabs {
    flex-wrap: wrap;
    justify-content: center;
  }
  .match-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}
`;
}
