export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Valoranchi Dashboard</title>
  <link rel="stylesheet" href="/dashboard.css">
</head>
<body>
  <div id="app">
    <header class="app-header">
      <div class="brand">
        <svg class="brand-logo" viewBox="0 0 100 100" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 24 L50 88 L66 88 L88 40 L72 40 L50 72 L28 24 Z" fill="#ff4655" />
          <path d="M72 24 L88 24 L80 38 L64 38 Z" fill="#ece8e1" />
        </svg>
        <span class="brand-title">VALORANCHI</span>
      </div>
      <nav class="nav-tabs" role="tablist">
        <button class="tab-btn active" data-tab="home" role="tab" id="tab-btn-home">Home</button>
        <button class="tab-btn" data-tab="store" role="tab" id="tab-btn-store">Store</button>
        <button class="tab-btn" data-tab="wishlist" role="tab" id="tab-btn-wishlist">Wishlist</button>
        <button class="tab-btn" data-tab="matches" role="tab" id="tab-btn-matches">Matches</button>
        <button class="tab-btn" data-tab="friends" role="tab" id="tab-btn-friends">Friends</button>
      </nav>
    </header>

    <div id="riot-offline-banner" class="banner-offline hidden">
      <div class="banner-content">
        <div class="banner-icon">⚠️</div>
        <div class="banner-text">
          <strong id="banner-title">VALORANT is not running</strong>
          <span id="banner-msg">Open VALORANT and this page will update by itself</span>
          <span id="banner-retry" class="banner-retry">Retrying in 10s...</span>
        </div>
      </div>
    </div>

    <main class="main-content">
      <section id="tab-home" class="tab-pane active" role="tabpanel">
        <div id="home-content" class="home-container">
          <div class="loading-placeholder">Loading home...</div>
        </div>
      </section>

      <section id="tab-store" class="tab-pane" role="tabpanel">
        <div id="store-content" class="store-container">
          <div class="loading-placeholder">Loading store...</div>
        </div>
      </section>

      <section id="tab-wishlist" class="tab-pane" role="tabpanel">
        <div class="wishlist-toolbar">
          <div class="wishlist-input-group">
            <input type="text" id="wishlist-input" placeholder="Search skin to add..." list="skins-datalist" autocomplete="off" />
            <datalist id="skins-datalist"></datalist>
            <button id="wishlist-add-btn" class="btn-primary">Add to Wishlist</button>
          </div>
          <div id="wishlist-status" class="inline-status"></div>
        </div>
        <div id="wishlist-content" class="wishlist-container">
          <div class="loading-placeholder">Loading wishlist...</div>
        </div>
      </section>

      <section id="tab-matches" class="tab-pane" role="tabpanel">
        <div id="matches-content" class="matches-container">
          <div class="loading-placeholder">Loading matches...</div>
        </div>
      </section>

      <section id="tab-friends" class="tab-pane" role="tabpanel">
        <div id="friends-content" class="friends-container">
          <div class="loading-placeholder">Loading friends...</div>
        </div>
      </section>
    </main>

    <footer class="app-footer">
      <p class="disclaimer">Valoranchi isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      <div class="footer-links">
        <a href="/api">API Routes</a>
        <a href="/openapi.json">OpenAPI Spec</a>
        <a href="/events">SSE Events</a>
        <a href="https://github.com/Valoranchi/valoranchi#readme" target="_blank" rel="noopener">Documentation</a>
        <a href="https://github.com/Valoranchi/valoranchi" target="_blank" rel="noopener">GitHub</a>
      </div>
    </footer>
  </div>
  <script src="/dashboard.js"></script>
</body>
</html>`;
}
