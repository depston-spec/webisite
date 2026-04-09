(function () {
  const SUPABASE_URL = "https://gjsqinbiruitzttavizy.supabase.c";
  const SUPABASE_ANON_KEY = "sb_publishable_uHDziTQnuJfE8QMjl-NTjA_q04R8cL5";
  const ALLOWED_EMAILS = ["warpaj10@gmail.com", "__EMAIL_TWO__"];
  const DEFAULT_RATE = 12.5;
  const WS = { A: "a", B: "b" };
  const THEME = { a: "theme-violet", b: "theme-aqua" };

  const rateInput = document.getElementById("rateRub");
  const addBtn = document.getElementById("addItem");
  const itemsList = document.getElementById("itemsList");
  const template = document.getElementById("itemTemplate");
  const totalCnyEl = document.getElementById("totalCny");
  const totalRubEl = document.getElementById("totalRub");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox.querySelector(".lightbox-img");
  const lightboxClose = lightbox.querySelector(".lightbox-close");
  const workspaceBtns = document.querySelectorAll(".workspace-btn");
  const authStatus = document.getElementById("authStatus");
  const emailInput = document.getElementById("emailInput");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  let lightboxPrevOverflow = "";
  let currentUser = null;
  let suppressSync = false;
  let saveTimer = null;
  let realtimeChannel = null;

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let appState = {
    active: WS.A,
    workspaces: {
      [WS.A]: { id: null, rate: DEFAULT_RATE, items: [] },
      [WS.B]: { id: null, rate: DEFAULT_RATE, items: [] },
    },
  };

  function setStatus(text) { authStatus.textContent = text; }
  function getRate() { const r = parseFloat(rateInput.value); return r > 0 && Number.isFinite(r) ? r : DEFAULT_RATE; }
  function formatMoney(n) { return (Number.isFinite(n) ? n : 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function formatDate(value) { try { return value ? new Date(value).toLocaleString("ru-RU") : "—"; } catch { return "—"; } }
  function isValidHttpUrl(s) { try { const u = new URL(String(s || "").trim()); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } }
  function openExternal(url) { const u = String(url || "").trim(); if (!isValidHttpUrl(u)) return; window.open(u, "_blank", "noopener,noreferrer"); }
  function updateLinkButtons(el) { const y = el.querySelector(".yupoo-input").value; const t = el.querySelector(".taobao-input").value; el.querySelector(".yupoo-go").disabled = !isValidHttpUrl(y); el.querySelector(".taobao-go").disabled = !isValidHttpUrl(t); }
  function updatePreviewZoomable(el) { const preview = el.querySelector(".preview"); const wrap = el.querySelector(".preview-wrap"); const has = !!(preview.getAttribute("src") && !preview.hasAttribute("hidden")); wrap.classList.toggle("preview-wrap--zoomable", has); wrap.tabIndex = has ? 0 : -1; }
  function openLightbox(src) { if (!src) return; lightboxImg.src = src; lightbox.hidden = false; lightboxPrevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; lightboxClose.focus(); }
  function closeLightbox() { lightbox.hidden = true; lightboxImg.removeAttribute("src"); document.body.style.overflow = lightboxPrevOverflow; }
  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  lightboxImg.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lightbox.hidden) { e.preventDefault(); closeLightbox(); } });

  function serializeItemsFromDom() {
    const items = [];
    itemsList.querySelectorAll(".item").forEach((el, index) => {
      const mode = el.querySelector(".tab--active")?.dataset.tab === "file" ? "file" : "url";
      items.push({
        position: index,
        image_mode: mode,
        image_url: el.querySelector(".image-url").value.trim(),
        image_data: el.dataset.imageData || "",
        title: el.querySelector(".title-input").value,
        yupoo_url: el.querySelector(".yupoo-input").value,
        taobao_url: el.querySelector(".taobao-input").value,
        size: el.querySelector(".size-input").value,
        price_cny: parseFloat(el.querySelector(".price-input").value) || 0,
        owner_email: currentUser?.email || null,
      });
    });
    return items;
  }

  function flushActiveWorkspace() { const w = appState.workspaces[appState.active]; w.rate = getRate(); w.items = serializeItemsFromDom().map((it) => ({ ...it })); }
  function clearItemsDom() { itemsList.innerHTML = ""; }
  function applyTheme(workspaceId) { document.body.classList.remove("theme-violet", "theme-aqua"); document.body.classList.add(THEME[workspaceId] || THEME[WS.A]); }
  function updateWorkspaceTabsUI() { workspaceBtns.forEach((btn) => { const id = btn.dataset.workspace; const active = id === appState.active; btn.classList.toggle("workspace-btn--active", active); btn.setAttribute("aria-selected", active ? "true" : "false"); }); }
  function updateItemRubLine(el) { const price = parseFloat(el.querySelector(".price-input").value); const rub = (Number.isFinite(price) && price >= 0 ? price : 0) * getRate(); el.querySelector(".item-rub-value").textContent = `${formatMoney(rub)} ₽`; }
  function updateTotals() { let sumCny = 0; itemsList.querySelectorAll(".item").forEach((el) => { const p = parseFloat(el.querySelector(".price-input").value); if (Number.isFinite(p) && p > 0) sumCny += p; }); totalCnyEl.textContent = formatMoney(sumCny); totalRubEl.textContent = formatMoney(sumCny * getRate()); }
  function scheduleSave() { if (suppressSync || !currentUser) return; clearTimeout(saveTimer); saveTimer = setTimeout(saveWorkspace, 450); }

  async function saveWorkspace() {
    if (suppressSync || !currentUser) return;
    flushActiveWorkspace();
    const ws = appState.workspaces[appState.active];
    if (!ws.id) return;
    const payload = { rate: ws.rate, updated_by: currentUser.email, updated_at: new Date().toISOString() };
    const itemsPayload = ws.items.map((item) => ({ workspace_id: ws.id, position: item.position, image_mode: item.image_mode, image_url: item.image_url, image_data: item.image_data, title: item.title, yupoo_url: item.yupoo_url, taobao_url: item.taobao_url, size: item.size, price_cny: item.price_cny, owner_email: item.owner_email || currentUser.email, updated_by: currentUser.email }));
    const { error: wError } = await supabase.from("workspaces").update(payload).eq("id", ws.id);
    if (wError) return void setStatus("Ошибка сохранения workspace");
    const { error: delError } = await supabase.from("cart_items").delete().eq("workspace_id", ws.id);
    if (delError) return void setStatus("Ошибка очистки товаров");
    if (itemsPayload.length) {
      const { error: insError } = await supabase.from("cart_items").insert(itemsPayload);
      if (insError) return void setStatus("Ошибка записи товаров");
    }
    setStatus(`Сохранено для ${currentUser.email}`);
  }

  function bindItem(el) {
    const preview = el.querySelector(".preview");
    const urlInput = el.querySelector(".image-url");
    const fileInput = el.querySelector(".image-file");
    const tabs = el.querySelectorAll(".tab");
    const panelUrl = el.querySelector(".tab-panel--url");
    const panelFile = el.querySelector(".tab-panel--file");
    const previewWrap = el.querySelector(".preview-wrap");
    function showPreview(src) { if (src) { preview.src = src; preview.removeAttribute("hidden"); } else { preview.removeAttribute("src"); preview.setAttribute("hidden", ""); } updatePreviewZoomable(el); }
    function tryOpenLightbox() { const src = preview.getAttribute("src"); if (src && !preview.hasAttribute("hidden")) openLightbox(src); }
    previewWrap.addEventListener("click", tryOpenLightbox);
    previewWrap.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tryOpenLightbox(); } });
    el.querySelector(".yupoo-go").addEventListener("click", () => openExternal(el.querySelector(".yupoo-input").value));
    el.querySelector(".taobao-go").addEventListener("click", () => openExternal(el.querySelector(".taobao-input").value));
    tabs.forEach((tab) => { tab.addEventListener("click", () => { tabs.forEach((t) => t.classList.remove("tab--active")); tab.classList.add("tab--active"); const mode = tab.dataset.tab; if (mode === "url") { panelUrl.classList.remove("hidden"); panelFile.classList.add("hidden"); showPreview(urlInput.value.trim()); } else { panelUrl.classList.add("hidden"); panelFile.classList.remove("hidden"); showPreview(el.dataset.imageData || ""); } scheduleSave(); }); });
    urlInput.addEventListener("input", () => { if (el.querySelector(".tab--active").dataset.tab === "url") { delete el.dataset.imageData; showPreview(urlInput.value.trim()); } scheduleSave(); });
    fileInput.addEventListener("change", () => { const file = fileInput.files?.[0]; if (!file || !file.type.startsWith("image/")) return; const reader = new FileReader(); reader.onload = () => { el.dataset.imageData = reader.result; if (el.querySelector(".tab--active").dataset.tab === "file") showPreview(reader.result); scheduleSave(); }; reader.readAsDataURL(file); });
    el.querySelector(".item-remove").addEventListener("click", () => { el.remove(); updateTotals(); scheduleSave(); });
    ["title-input", "size-input", "yupoo-input", "taobao-input", "price-input"].forEach((cls) => { el.querySelector("." + cls).addEventListener("input", () => { updateLinkButtons(el); if (cls === "price-input") updateItemRubLine(el); updateTotals(); scheduleSave(); }); });
    updateLinkButtons(el); updatePreviewZoomable(el);
  }

  function createItem(data) {
    const node = template.content.firstElementChild.cloneNode(true);
    if (data) {
      if (data.image_mode === "file") { node.querySelector('.tab[data-tab="url"]').classList.remove("tab--active"); node.querySelector('.tab[data-tab="file"]').classList.add("tab--active"); node.querySelector(".tab-panel--url").classList.add("hidden"); node.querySelector(".tab-panel--file").classList.remove("hidden"); }
      node.querySelector(".image-url").value = data.image_url || "";
      node.querySelector(".title-input").value = data.title || "";
      node.querySelector(".yupoo-input").value = data.yupoo_url || "";
      node.querySelector(".taobao-input").value = data.taobao_url || "";
      node.querySelector(".size-input").value = data.size || "";
      node.querySelector(".price-input").value = data.price_cny || "";
      if (data.image_data) node.dataset.imageData = data.image_data;
      node.querySelector('.item-owner').textContent = `Автор: ${data.owner_email || '—'}`;
      node.querySelector('.item-updated').textContent = `Изменено: ${formatDate(data.updated_at)}`;
    }
    bindItem(node); itemsList.appendChild(node);
    const preview = node.querySelector(".preview");
    const activeMode = node.querySelector(".tab--active").dataset.tab;
    if (activeMode === "url") { const u = node.querySelector(".image-url").value.trim(); if (u) { preview.src = u; preview.removeAttribute("hidden"); } } else if (node.dataset.imageData) { preview.src = node.dataset.imageData; preview.removeAttribute("hidden"); }
    updatePreviewZoomable(node); updateItemRubLine(node); return node;
  }

  function renderWorkspace(workspaceId) { const w = appState.workspaces[workspaceId]; rateInput.value = String(w.rate || DEFAULT_RATE); clearItemsDom(); if (w.items.length > 0) w.items.forEach((item) => createItem(item)); else createItem(null); updateTotals(); }
  function switchWorkspace(nextId) { if (nextId === appState.active) return; flushActiveWorkspace(); appState.active = nextId; applyTheme(nextId); updateWorkspaceTabsUI(); renderWorkspace(nextId); }
  rateInput.addEventListener("input", () => { itemsList.querySelectorAll(".item").forEach(updateItemRubLine); updateTotals(); scheduleSave(); });
  addBtn.addEventListener("click", () => { createItem(null); updateTotals(); scheduleSave(); });
  workspaceBtns.forEach((btn) => btn.addEventListener("click", () => { const id = btn.dataset.workspace; if (id === WS.A || id === WS.B) switchWorkspace(id); }));

  async function loadWorkspaceData() {
    const { data: workspaces, error: wsError } = await supabase.from("workspaces").select("id, slug, title, rate, updated_at").order("slug", { ascending: true });
    if (wsError) throw wsError;
    for (const ws of workspaces) {
      const key = ws.slug === "b" ? WS.B : WS.A;
      appState.workspaces[key].id = ws.id;
      appState.workspaces[key].rate = ws.rate || DEFAULT_RATE;
      const { data: items, error: itemsError } = await supabase.from("cart_items").select("*").eq("workspace_id", ws.id).order("position", { ascending: true });
      if (itemsError) throw itemsError;
      appState.workspaces[key].items = items || [];
    }
    applyTheme(appState.active); updateWorkspaceTabsUI(); renderWorkspace(appState.active);
  }

  async function ensureAllowedUser(session) {
    const email = (session?.user?.email || "").toLowerCase();
    if (!email) return false;
    if (!ALLOWED_EMAILS.includes(email)) { await supabase.auth.signOut(); setStatus("Этот email не разрешен"); alert("Этот email не добавлен в список разрешенных."); return false; }
    currentUser = session.user; setStatus(`Вошел: ${email}`); loginBtn.hidden = true; logoutBtn.hidden = false; addBtn.disabled = false; emailInput.value = email; return true;
  }

  async function initAuth() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) { const ok = await ensureAllowedUser(data.session); if (ok) await loadWorkspaceData(); } else { setStatus("Нужен вход по email"); addBtn.disabled = true; }
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) { const ok = await ensureAllowedUser(session); if (ok) { await loadWorkspaceData(); subscribeRealtime(); } }
      else { currentUser = null; loginBtn.hidden = false; logoutBtn.hidden = true; addBtn.disabled = true; setStatus("Вы не вошли"); }
    });
  }

  function subscribeRealtime() {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    realtimeChannel = supabase.channel("cart-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "workspaces" }, async () => { suppressSync = true; await loadWorkspaceData(); suppressSync = false; })
      .on("postgres_changes", { event: "*", schema: "public", table: "cart_items" }, async () => { suppressSync = true; await loadWorkspaceData(); suppressSync = false; })
      .subscribe();
  }

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return alert("Введи email");
    if (!ALLOWED_EMAILS.includes(email)) return alert("Этот email не разрешен. Добавь его в ALLOWED_EMAILS.");
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) return alert("Не удалось отправить magic link");
    setStatus(`Письмо отправлено на ${email}`);
  });

  logoutBtn.addEventListener("click", async () => { await supabase.auth.signOut(); });

  (async function start() {
    try { await initAuth(); subscribeRealtime(); } catch (e) { console.error(e); setStatus("Ошибка инициализации"); }
  })();
})();
