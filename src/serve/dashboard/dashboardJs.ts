export function renderDashboardJs(): string {
  return `(function () {
  const DICT = {
    en: {
      home: "Home",
      store: "Store",
      wishlist: "Wishlist",
      matches: "Matches",
      friends: "Friends",
      offlineTitle: "VALORANT is not running",
      offlineMsg: "Open VALORANT and this page will update by itself",
      retryingIn: "Retrying in {s}s...",
      level: "Level",
      rank: "Rank",
      unranked: "Unranked",
      rr: "RR",
      wallet: "Wallet",
      vp: "VP",
      rad: "Radianite",
      kc: "Kingdom Credits",
      fit: "Rank Fit",
      dailyOffers: "Daily Offers",
      featuredBundles: "Featured Bundles",
      nightMarket: "Night Market",
      resetsIn: "Resets in",
      addToWishlist: "Add to Wishlist",
      searchPlaceholder: "Search skin to add...",
      inStoreToday: "IN STORE TODAY!",
      remove: "Remove",
      victory: "VICTORY",
      defeat: "DEFEAT",
      draw: "DRAW",
      kda: "K/D/A",
      score: "Score",
      noMatches: "No recent matches found",
      noFriends: "No friends currently online",
      onlineFriends: "Online Friends",
      addedToWishlist: "Added to wishlist",
      removedFromWishlist: "Removed from wishlist",
      emptyWishlist: "Your wishlist is empty. Add weapon skins to track store availability.",
      errorLoading: "Failed to load {section}",
    },
    es: {
      home: "Inicio",
      store: "Tienda",
      wishlist: "Lista de deseos",
      matches: "Partidas",
      friends: "Amigos",
      offlineTitle: "VALORANT no se está ejecutando",
      offlineMsg: "Abrí VALORANT y esta página se actualizará sola",
      retryingIn: "Reintentando en {s}s...",
      level: "Nivel",
      rank: "Rango",
      unranked: "Sin rango",
      rr: "RR",
      wallet: "Billetera",
      vp: "VP",
      rad: "Radianita",
      kc: "Créditos Kingdom",
      fit: "Ajuste de rango",
      dailyOffers: "Ofertas del día",
      featuredBundles: "Colecciones destacadas",
      nightMarket: "Mercado Nocturno",
      resetsIn: "Se reinicia en",
      addToWishlist: "Agregar a lista de deseos",
      searchPlaceholder: "Buscar skin para agregar...",
      inStoreToday: "¡EN LA TIENDA HOY!",
      remove: "Eliminar",
      victory: "VICTORIA",
      defeat: "DERROTA",
      draw: "EMPATE",
      kda: "A/M/A",
      score: "Resultado",
      noMatches: "No se encontraron partidas recientes",
      noFriends: "No hay amigos conectados en este momento",
      onlineFriends: "Amigos conectados",
      addedToWishlist: "Agregado a la lista de deseos",
      removedFromWishlist: "Eliminado de la lista de deseos",
      emptyWishlist: "Tu lista de deseos está vacía. Agregá skins de armas para recibir alertas en la tienda.",
      errorLoading: "Error al cargar {section}",
    },
  };

  const isSpanish = Boolean(navigator.language && navigator.language.toLowerCase().startsWith("es"));
  const currentLang = isSpanish ? "es" : "en";

  function t(key, params) {
    let str = DICT[currentLang][key] || DICT.en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace("{" + k + "}", v);
      }
    }
    return str;
  }

  let isRiotOffline = false;
  let offlineRetryTimer = null;
  let retrySecondsLeft = 10;
  let currentActiveTab = "home";
  let storeCountdownTimer = null;
  let cachedSkins = [];

  function updateStaticTexts() {
    const tabHome = document.getElementById("tab-btn-home");
    const tabStore = document.getElementById("tab-btn-store");
    const tabWishlist = document.getElementById("tab-btn-wishlist");
    const tabMatches = document.getElementById("tab-btn-matches");
    const tabFriends = document.getElementById("tab-btn-friends");
    if (tabHome) tabHome.textContent = t("home");
    if (tabStore) tabStore.textContent = t("store");
    if (tabWishlist) tabWishlist.textContent = t("wishlist");
    if (tabMatches) tabMatches.textContent = t("matches");
    if (tabFriends) tabFriends.textContent = t("friends");

    const bannerTitle = document.getElementById("banner-title");
    const bannerMsg = document.getElementById("banner-msg");
    const wishlistInput = document.getElementById("wishlist-input");
    const wishlistBtn = document.getElementById("wishlist-add-btn");
    if (bannerTitle) bannerTitle.textContent = t("offlineTitle");
    if (bannerMsg) bannerMsg.textContent = t("offlineMsg");
    if (wishlistInput) wishlistInput.placeholder = t("searchPlaceholder");
    if (wishlistBtn) wishlistBtn.textContent = t("addToWishlist");
  }

  function handleRiotOffline() {
    if (isRiotOffline) return;
    isRiotOffline = true;
    const banner = document.getElementById("riot-offline-banner");
    if (banner) banner.classList.remove("hidden");

    retrySecondsLeft = 10;
    const retryEl = document.getElementById("banner-retry");
    if (retryEl) retryEl.textContent = t("retryingIn", { s: retrySecondsLeft });

    if (offlineRetryTimer) clearInterval(offlineRetryTimer);
    offlineRetryTimer = setInterval(async () => {
      retrySecondsLeft -= 1;
      if (retryEl) retryEl.textContent = t("retryingIn", { s: Math.max(0, retrySecondsLeft) });
      if (retrySecondsLeft <= 0) {
        clearInterval(offlineRetryTimer);
        offlineRetryTimer = null;
        try {
          await apiGet("/api/account/whoami");
          handleRiotOnline();
        } catch {
          isRiotOffline = false;
          handleRiotOffline();
        }
      }
    }, 1000);
  }

  function handleRiotOnline() {
    if (!isRiotOffline) return;
    isRiotOffline = false;
    if (offlineRetryTimer) {
      clearInterval(offlineRetryTimer);
      offlineRetryTimer = null;
    }
    const banner = document.getElementById("riot-offline-banner");
    if (banner) banner.classList.add("hidden");
    loadTab(currentActiveTab);
  }

  async function apiGet(endpoint) {
    const res = await fetch(endpoint);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error?.code;
      if (res.status === 503 && (code === "RIOT_CLIENT_NOT_RUNNING" || code === "RIOT_CLIENT_NOT_READY")) {
        handleRiotOffline();
      }
      throw new Error(data?.error?.message || ("HTTP " + res.status));
    }
    if (isRiotOffline) handleRiotOnline();
    return data;
  }

  async function apiPost(endpoint, body) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error?.code;
      if (res.status === 503 && (code === "RIOT_CLIENT_NOT_RUNNING" || code === "RIOT_CLIENT_NOT_READY")) {
        handleRiotOffline();
      }
      throw new Error(data?.error?.message || ("HTTP " + res.status));
    }
    if (isRiotOffline) handleRiotOnline();
    return data;
  }

  function formatTimeRemaining(endsAt) {
    if (!endsAt) return "";
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return "00:00:00";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return [
      String(hours).padStart(2, "0"),
      String(mins).padStart(2, "0"),
      String(secs).padStart(2, "0"),
    ].join(":");
  }

  async function loadHome() {
    const container = document.getElementById("home-content");
    if (!container) return;
    try {
      const [player, loadout, mmr, wallet] = await Promise.all([
        apiGet("/api/account/whoami"),
        apiGet("/api/account/loadout").catch(() => null),
        apiGet("/api/matches/mmr").catch(() => null),
        apiGet("/api/account/wallet").catch(() => null),
      ]);

      const cardArt = loadout?.card?.large || loadout?.card?.wide || loadout?.card?.small || "";
      const rank = mmr?.current;
      const rankName = rank?.name || t("unranked");
      const rankIcon = rank?.icon ? '<img src="' + rank.icon + '" class="rank-icon" alt="' + rankName + '">' : "";
      const rr = rank?.rating !== null && rank?.rating !== undefined ? rank.rating : 0;
      const fit = mmr?.fit;
      const fitText = fit?.verdict ? (t("fit") + ": " + fit.verdict + (fit.expected?.name ? " (" + fit.expected.name + ")" : "")) : "";

      const vp = wallet?.valorantPoints ?? 0;
      const rad = wallet?.radianite ?? 0;
      const kc = wallet?.kingdomCredits ?? 0;

      container.innerHTML = [
        '<div class="home-grid">',
        '  <div class="home-card profile-card">',
        '    <div class="profile-header">',
        cardArt ? '      <img src="' + cardArt + '" class="profile-card-art" alt="Card">' : '',
        '      <div class="profile-info">',
        '        <h2>' + player.gameName + '<span style="color:var(--text-muted)">#' + player.tagLine + '</span></h2>',
        '        <span class="level-badge">' + t("level") + ' ' + player.accountLevel + '</span>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="home-card rank-card">',
        '    <div class="section-title">' + t("rank") + '</div>',
        '    <div class="rank-display">',
        rankIcon,
        '      <div class="rank-details">',
        '        <h3>' + rankName + '</h3>',
        '        <div class="rr-text">' + rr + ' ' + t("rr") + '</div>',
        fitText ? '        <span class="fit-badge">' + fitText + '</span>' : '',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="home-card wallet-card">',
        '    <div class="section-title">' + t("wallet") + '</div>',
        '    <div class="wallet-chips">',
        '      <div class="wallet-chip vp"><span class="wallet-val">' + vp.toLocaleString() + '</span><span class="wallet-label">' + t("vp") + '</span></div>',
        '      <div class="wallet-chip rad"><span class="wallet-val">' + rad.toLocaleString() + '</span><span class="wallet-label">' + t("rad") + '</span></div>',
        '      <div class="wallet-chip kc"><span class="wallet-val">' + kc.toLocaleString() + '</span><span class="wallet-label">' + t("kc") + '</span></div>',
        '    </div>',
        '  </div>',
        '</div>',
      ].join("\\n");
    } catch (err) {
      if (!isRiotOffline) {
        container.innerHTML = '<div class="inline-error">' + t("errorLoading", { section: t("home") }) + ': ' + err.message + '</div>';
      }
    }
  }

  async function loadStore() {
    const container = document.getElementById("store-content");
    if (!container) return;
    try {
      const store = await apiGet("/api/store/current");
      if (storeCountdownTimer) clearInterval(storeCountdownTimer);

      const daily = store?.daily;
      const offers = daily?.offers || [];
      const bundles = store?.bundles?.items || [];
      const nightMarket = store?.nightMarket?.offers || [];

      let html = '';

      if (daily) {
        const remaining = formatTimeRemaining(daily.endsAt);
        html += '<div class="section-title"><span>' + t("dailyOffers") + '</span><span class="countdown-timer" id="store-daily-timer">' + t("resetsIn") + ' ' + remaining + '</span></div>';
        html += '<div class="store-grid">';
        for (const offer of offers) {
          const item = offer.item;
          const icon = item.icon ? '<img src="' + item.icon + '" class="skin-img" alt="' + item.name + '">' : '';
          const tierIcon = item.tier?.icon ? '<img src="' + item.tier.icon + '" class="skin-tier-icon" alt="' + (item.tier.name || '') + '">' : '';
          html += [
            '<div class="skin-card">',
            '  <div class="skin-img-wrap">' + icon + '</div>',
            '  <div class="skin-title">' + item.name + '</div>',
            '  <div class="skin-weapon">' + (item.weapon || '') + '</div>',
            '  <div class="skin-meta">',
            '    <span class="skin-price">' + offer.cost.amount.toLocaleString() + ' VP</span>',
            tierIcon,
            '  </div>',
            '</div>',
          ].join("");
        }
        html += '</div>';

        storeCountdownTimer = setInterval(() => {
          const timerEl = document.getElementById("store-daily-timer");
          if (timerEl) {
            timerEl.textContent = t("resetsIn") + ' ' + formatTimeRemaining(daily.endsAt);
          }
        }, 1000);
      }

      if (bundles.length > 0) {
        html += '<div class="section-title">' + t("featuredBundles") + '</div>';
        for (const b of bundles) {
          const img = b.promoImage || b.icon;
          const banner = img ? '<img src="' + img + '" class="bundle-banner" alt="' + b.name + '">' : '';
          const price = b.totalDiscounted || b.totalBase || 0;
          html += [
            '<div class="bundle-card">',
            banner,
            '  <div class="bundle-info">',
            '    <div><h3>' + b.name + '</h3>' + (b.description ? '<p style="color:var(--text-secondary);font-size:0.85rem">' + b.description + '</p>' : '') + '</div>',
            '    <div class="skin-price">' + price.toLocaleString() + ' VP</div>',
            '  </div>',
            '</div>',
          ].join("");
        }
      }

      if (nightMarket.length > 0) {
        html += '<div class="section-title">' + t("nightMarket") + '</div>';
        html += '<div class="store-grid">';
        for (const nm of nightMarket) {
          const item = nm.item;
          const icon = item.icon ? '<img src="' + item.icon + '" class="skin-img" alt="' + item.name + '">' : '';
          html += [
            '<div class="skin-card">',
            '  <div class="skin-img-wrap">' + icon + '</div>',
            '  <div class="skin-title">' + item.name + '</div>',
            '  <div class="skin-weapon">' + (item.weapon || '') + '</div>',
            '  <div class="skin-meta">',
            '    <div><span style="text-decoration:line-through;color:var(--text-muted);margin-right:0.5rem">' + nm.cost.amount + '</span><span class="skin-price">' + nm.discountedCost.amount.toLocaleString() + ' VP</span></div>',
            '    <span class="hit-badge" style="position:static">-' + nm.discountPercent + '%</span>',
            '  </div>',
            '</div>',
          ].join("");
        }
        html += '</div>';
      }

      container.innerHTML = html;
    } catch (err) {
      if (!isRiotOffline) {
        container.innerHTML = '<div class="inline-error">' + t("errorLoading", { section: t("store") }) + ': ' + err.message + '</div>';
      }
    }
  }

  async function loadWishlist() {
    const container = document.getElementById("wishlist-content");
    if (!container) return;
    try {
      const [wishlist, check] = await Promise.all([
        apiGet("/api/store/wishlist"),
        apiGet("/api/store/wishlistCheck").catch(() => ({ hits: [] })),
      ]);

      const hitUuids = new Set((check?.hits || []).map((h) => (h.item?.uuid || "").toLowerCase()));
      const skins = wishlist?.skins || [];

      if (skins.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">' + t("emptyWishlist") + '</div>';
        return;
      }

      let html = '<div class="store-grid">';
      for (const s of skins) {
        const isHit = hitUuids.has((s.uuid || "").toLowerCase());
        const hitBadge = isHit ? '<span class="hit-badge">' + t("inStoreToday") + '</span>' : '';
        const catSkin = cachedSkins.find((cs) => cs.uuid.toLowerCase() === (s.uuid || "").toLowerCase());
        const icon = catSkin?.icon ? '<img src="' + catSkin.icon + '" class="skin-img" alt="' + s.name + '">' : '';
        const weapon = catSkin?.weapon || "";
        const tierIcon = catSkin?.tier?.icon ? '<img src="' + catSkin.tier.icon + '" class="skin-tier-icon" alt="">' : '';

        html += [
          '<div class="skin-card' + (isHit ? ' in-store' : '') + '">',
          hitBadge,
          '  <div class="skin-img-wrap">' + icon + '</div>',
          '  <div class="skin-title">' + s.name + '</div>',
          '  <div class="skin-weapon">' + weapon + '</div>',
          '  <div class="skin-meta">',
          tierIcon,
          '    <button class="btn-remove" data-remove-skin="' + s.uuid + '">' + t("remove") + '</button>',
          '  </div>',
          '</div>',
        ].join("");
      }
      html += '</div>';

      container.innerHTML = html;

      const removeBtns = container.querySelectorAll("[data-remove-skin]");
      removeBtns.forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const skinUuid = e.currentTarget.getAttribute("data-remove-skin");
          try {
            await apiPost("/api/store/wishlistRemove", { skin: skinUuid });
            loadWishlist();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      if (!isRiotOffline) {
        container.innerHTML = '<div class="inline-error">' + t("errorLoading", { section: t("wishlist") }) + ': ' + err.message + '</div>';
      }
    }
  }

  async function loadMatches() {
    const container = document.getElementById("matches-content");
    if (!container) return;
    try {
      const [summaries, history, player] = await Promise.all([
        apiGet("/api/matches/list?count=10"),
        apiGet("/api/matches/rankHistory?count=10").catch(() => []),
        apiGet("/api/account/whoami").catch(() => null),
      ]);

      const myPuuid = player?.puuid;
      const rankUpdates = Array.isArray(history) ? history : [];
      const matchSummaries = Array.isArray(summaries) ? summaries.slice(0, 10) : [];

      if (matchSummaries.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">' + t("noMatches") + '</div>';
        return;
      }

      const matchDetails = await Promise.all(
        matchSummaries.map((m) => apiGet("/api/matches/get?id=" + m.id).catch(() => null))
      );

      let html = '<div class="matches-list">';
      for (let i = 0; i < matchSummaries.length; i++) {
        const summary = matchSummaries[i];
        const match = matchDetails[i];
        const matchId = summary.id;
        const rrUpdate = rankUpdates.find((u) => u.matchId === matchId);

        let resultClass = "draw";
        let resultText = t("draw");
        let scoreText = "-";
        let agentName = "";
        let agentIcon = "";
        let kdaText = "-";

        if (match) {
          const me = match.players?.find((p) => p.puuid === myPuuid) || match.players?.[0];
          if (me) {
            agentName = me.agent?.name || "";
            agentIcon = me.agent?.icon ? '<img src="' + me.agent.icon + '" class="agent-icon" alt="' + agentName + '">' : '';
            if (me.stats) {
              kdaText = me.stats.kills + ' / ' + me.stats.deaths + ' / ' + me.stats.assists;
            }
            if (match.self) {
              if (match.self.won === true) {
                resultClass = "win";
                resultText = t("victory");
              } else if (match.self.won === false) {
                resultClass = "loss";
                resultText = t("defeat");
              }
            }
          }
          if (match.teams && match.teams.length >= 2) {
            const blue = match.teams.find((tm) => tm.id === "Blue")?.roundsWon ?? 0;
            const red = match.teams.find((tm) => tm.id === "Red")?.roundsWon ?? 0;
            scoreText = blue + ' - ' + red;
          }
        }

        let rrHtml = '';
        if (rrUpdate && rrUpdate.earned !== undefined && rrUpdate.earned !== null) {
          const earned = rrUpdate.earned;
          const isPlus = earned > 0;
          rrHtml = '<span class="rr-change ' + (isPlus ? 'plus' : 'minus') + '">' + (isPlus ? '+' : '') + earned + ' ' + t("rr") + '</span>';
        }

        const mapName = summary.map?.name || "Valorant";

        html += [
          '<div class="match-item ' + resultClass + '">',
          '  <div><span class="match-badge ' + resultClass + '">' + resultText + '</span></div>',
          '  <div class="match-agent">' + agentIcon + '<div><strong>' + agentName + '</strong><div style="font-size:0.8rem;color:var(--text-muted)">' + mapName + '</div></div></div>',
          '  <div class="match-score">' + scoreText + '</div>',
          '  <div class="match-kda"><div style="font-size:0.75rem;color:var(--text-muted)">' + t("kda") + '</div>' + kdaText + '</div>',
          '  <div>' + rrHtml + '</div>',
          '</div>',
        ].join("");
      }
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      if (!isRiotOffline) {
        container.innerHTML = '<div class="inline-error">' + t("errorLoading", { section: t("matches") }) + ': ' + err.message + '</div>';
      }
    }
  }

  async function loadFriends() {
    const container = document.getElementById("friends-content");
    if (!container) return;
    try {
      const friends = await apiGet("/api/social/friends");
      const list = Array.isArray(friends) ? friends : [];

      const onlineFriends = list.filter((f) => {
        const st = f.presence?.state;
        return st && st !== "offline";
      });

      if (onlineFriends.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">' + t("noFriends") + '</div>';
        return;
      }

      let html = '<div class="section-title">' + t("onlineFriends") + ' (' + onlineFriends.length + ')</div>';
      html += '<div class="friends-list">';
      for (const f of onlineFriends) {
        const presence = f.presence || {};
        const state = presence.state || "online";
        let stateClass = "online";
        if (state === "ingame") stateClass = "in-game";
        if (state === "away" || state === "mobile") stateClass = "away";

        let activity = state;
        if (state === "ingame") {
          const map = presence.map?.name || "";
          const score = presence.score ? ' (' + presence.score.ally + '-' + presence.score.enemy + ')' : '';
          activity = "In Match" + (map ? ' - ' + map : '') + score;
        } else if (state === "menus") {
          activity = "In Menus";
        } else if (state === "pregame") {
          activity = "In Agent Select";
        }

        html += [
          '<div class="friend-card">',
          '  <span class="presence-dot ' + stateClass + '"></span>',
          '  <div class="friend-info">',
          '    <span class="friend-name">' + f.gameName + '<span style="color:var(--text-muted)">#' + f.tagLine + '</span></span>',
          '    <span class="friend-activity">' + activity + '</span>',
          '  </div>',
          '</div>',
        ].join("");
      }
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      if (!isRiotOffline) {
        container.innerHTML = '<div class="inline-error">' + t("errorLoading", { section: t("friends") }) + ': ' + err.message + '</div>';
      }
    }
  }

  function loadTab(tabName) {
    currentActiveTab = tabName;
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
    });
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === "tab-" + tabName);
    });

    if (tabName === "home") loadHome();
    if (tabName === "store") loadStore();
    if (tabName === "wishlist") loadWishlist();
    if (tabName === "matches") loadMatches();
    if (tabName === "friends") loadFriends();
  }

  async function initCatalogueAutocomplete() {
    try {
      const skins = await apiGet("/api/store/skins");
      if (Array.isArray(skins)) {
        cachedSkins = skins;
        const datalist = document.getElementById("skins-datalist");
        if (datalist) {
          datalist.innerHTML = skins
            .map((s) => '<option value="' + s.name + '">' + s.weapon + ' - ' + s.name + '</option>')
            .join("");
        }
      }
    } catch {
      // Non-fatal if catalogue cannot be preloaded
    }
  }

  function initWishlistAdd() {
    const btn = document.getElementById("wishlist-add-btn");
    const input = document.getElementById("wishlist-input");
    const status = document.getElementById("wishlist-status");
    if (!btn || !input) return;

    btn.addEventListener("click", async () => {
      const val = input.value.trim();
      if (!val) return;
      btn.disabled = true;
      if (status) status.textContent = "";

      try {
        await apiPost("/api/store/wishlistAdd", { skin: val });
        input.value = "";
        if (status) {
          status.style.color = "var(--success)";
          status.textContent = t("addedToWishlist");
        }
        loadWishlist();
      } catch (err) {
        if (status) {
          status.style.color = "var(--danger)";
          status.textContent = err.message;
        }
      } finally {
        btn.disabled = false;
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        btn.click();
      }
    });
  }

  function initTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (tab) loadTab(tab);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateStaticTexts();
    initTabs();
    initWishlistAdd();
    initCatalogueAutocomplete();
    loadTab("home");
  });
})();
`;
}
