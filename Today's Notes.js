// ==Plugin==
// name: Today's Notes
// description: Footer on journal entries showing records whose date field matches
// icon: ti-calendar-stats
// ==/Plugin==



// @generated BEGIN thymer-ext-path-b (source: plugins/plugin-settings/ThymerExtPathBRuntime.js — edit that file, then npm run embed-path-b)
/**
 * ThymerExtPathB — shared path-B storage (Plugin Settings collection + localStorage mirror).
 * Edit this file in the repo, then run `npm run embed-path-b` to refresh embedded copies inside each Path B plugin.
 *
 * API: ThymerExtPathB.init({ plugin, pluginId, modeKey, mirrorKeys, label, data, ui })
 *      ThymerExtPathB.scheduleFlush(plugin, mirrorKeys)
 *      ThymerExtPathB.openStorageDialog(plugin, { pluginId, modeKey, mirrorKeys, label, data, ui })
 */
(function pathBRuntime(g) {
  if (g.ThymerExtPathB) return;

  const COL_NAME = 'Plugin Settings';
  const q = [];
  let busy = false;

  function drain() {
    if (busy || !q.length) return;
    busy = true;
    const job = q.shift();
    Promise.resolve(typeof job === 'function' ? job() : job)
      .catch((e) => console.error('[ThymerExtPathB]', e))
      .finally(() => {
        busy = false;
        if (q.length) setTimeout(drain, 450);
      });
  }

  function enqueue(job) {
    q.push(job);
    drain();
  }

  async function findColl(data) {
    try {
      const all = await data.getAllCollections();
      return all.find((c) => (c.getName?.() || '') === COL_NAME) || null;
    } catch (_) {
      return null;
    }
  }

  async function readDoc(data, pluginId) {
    const coll = await findColl(data);
    if (!coll) return null;
    let records;
    try {
      records = await coll.getAllRecords();
    } catch (_) {
      return null;
    }
    const r = records.find((x) => (x.text?.('plugin_id') || '').trim() === pluginId);
    if (!r) return null;
    let raw = '';
    try {
      raw = r.text?.('settings_json') || '';
    } catch (_) {}
    if (!raw || !String(raw).trim()) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  async function writeDoc(data, pluginId, doc) {
    const coll = await findColl(data);
    if (!coll) return;
    const json = JSON.stringify(doc);
    let records;
    try {
      records = await coll.getAllRecords();
    } catch (_) {
      return;
    }
    let r = records.find((x) => (x.text?.('plugin_id') || '').trim() === pluginId);
    if (!r) {
      let guid = null;
      try {
        guid = coll.createRecord?.(pluginId);
      } catch (_) {}
      if (guid) {
        for (let i = 0; i < 30; i++) {
          await new Promise((res) => setTimeout(res, i < 8 ? 100 : 200));
          try {
            const again = await coll.getAllRecords();
            r = again.find((x) => x.guid === guid) || again.find((x) => (x.text?.('plugin_id') || '').trim() === pluginId);
            if (r) break;
          } catch (_) {}
        }
      }
    }
    if (!r) return;
    try {
      const pId = r.prop?.('plugin_id');
      if (pId && typeof pId.set === 'function') pId.set(pluginId);
    } catch (_) {}
    try {
      const pj = r.prop?.('settings_json');
      if (pj && typeof pj.set === 'function') pj.set(json);
    } catch (_) {}
  }

  function showFirstRunDialog(ui, label, preferred, onPick) {
    const id = 'thymerext-pathb-first-' + Math.random().toString(36).slice(2);
    const box = document.createElement('div');
    box.id = id;
    box.style.cssText =
      'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    const card = document.createElement('div');
    card.style.cssText =
      'max-width:420px;width:100%;background:var(--panel-bg-color,#1d1915);border:1px solid var(--border-default,#3f3f46);border-radius:12px;padding:20px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    const title = document.createElement('div');
    title.textContent = label + ' — where to store settings?';
    title.style.cssText = 'font-weight:700;font-size:15px;margin-bottom:10px;';
    const hint = document.createElement('div');
    hint.textContent = 'Change later via Command Palette → “Storage location…”';
    hint.style.cssText = 'font-size:12px;color:var(--text-muted,#888);margin-bottom:16px;line-height:1.45;';
    const mk = (t, sub, prim) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.cssText =
        'display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:10px;border-radius:8px;cursor:pointer;font-size:14px;border:1px solid var(--border-default,#3f3f46);background:' +
        (prim ? 'rgba(167,139,250,0.25)' : 'transparent') +
        ';color:inherit;';
      const x = document.createElement('div');
      x.textContent = t;
      x.style.fontWeight = '600';
      b.appendChild(x);
      if (sub) {
        const s = document.createElement('div');
        s.textContent = sub;
        s.style.cssText = 'font-size:11px;opacity:0.75;margin-top:4px;line-height:1.35;';
        b.appendChild(s);
      }
      return b;
    };
    const bLoc = mk('This device only', 'Browser localStorage only.', preferred === 'local');
    const bSyn = mk('Sync via Plugin Settings', 'Workspace collection “' + COL_NAME + '”.', preferred === 'synced');
    const fin = (m) => {
      try {
        box.remove();
      } catch (_) {}
      onPick(m);
    };
    bLoc.addEventListener('click', () => fin('local'));
    bSyn.addEventListener('click', () => fin('synced'));
    card.appendChild(title);
    card.appendChild(hint);
    card.appendChild(bLoc);
    card.appendChild(bSyn);
    box.appendChild(card);
    document.body.appendChild(box);
  }

  g.ThymerExtPathB = {
    COL_NAME,
    enqueue,
    async init(opts) {
      const { plugin, pluginId, modeKey, mirrorKeys, label, data, ui } = opts;
      let mode = null;
      try {
        mode = localStorage.getItem(modeKey);
      } catch (_) {}

      const remote = await readDoc(data, pluginId);
      if (!mode && remote && (remote.storageMode === 'synced' || remote.storageMode === 'local')) {
        mode = remote.storageMode;
        try {
          localStorage.setItem(modeKey, mode);
        } catch (_) {}
      }

      if (!mode) {
        const coll = await findColl(data);
        const preferred = coll ? 'synced' : 'local';
        await new Promise((outerResolve) => {
          enqueue(async () => {
            const picked = await new Promise((r) => {
              showFirstRunDialog(ui, label, preferred, r);
            });
            try {
              localStorage.setItem(modeKey, picked);
            } catch (_) {}
            outerResolve(picked);
          });
        });
        try {
          mode = localStorage.getItem(modeKey);
        } catch (_) {}
      }

      plugin._pathBMode = mode === 'synced' ? 'synced' : 'local';
      plugin._pathBPluginId = pluginId;
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;

      if (plugin._pathBMode === 'synced' && remote && remote.payload && typeof remote.payload === 'object') {
        for (const k of keys) {
          const v = remote.payload[k];
          if (typeof v === 'string') {
            try {
              localStorage.setItem(k, v);
            } catch (_) {}
          }
        }
      }

      if (plugin._pathBMode === 'synced') {
        try {
          await g.ThymerExtPathB.flushNow(data, pluginId, keys);
        } catch (_) {}
      }
    },

    scheduleFlush(plugin, mirrorKeys) {
      if (plugin._pathBMode !== 'synced') return;
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;
      if (plugin._pathBFlushTimer) clearTimeout(plugin._pathBFlushTimer);
      plugin._pathBFlushTimer = setTimeout(() => {
        plugin._pathBFlushTimer = null;
        const data = plugin.data;
        const pid = plugin._pathBPluginId;
        if (!pid || !data) return;
        g.ThymerExtPathB.flushNow(data, pid, keys).catch((e) => console.error('[ThymerExtPathB] flush', e));
      }, 500);
    },

    async flushNow(data, pluginId, mirrorKeys) {
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;
      const payload = {};
      for (const k of keys) {
        try {
          const v = localStorage.getItem(k);
          if (v !== null) payload[k] = v;
        } catch (_) {}
      }
      const doc = {
        v: 1,
        storageMode: 'synced',
        updatedAt: new Date().toISOString(),
        payload,
      };
      await writeDoc(data, pluginId, doc);
    },

    async openStorageDialog(opts) {
      const { plugin, pluginId, modeKey, mirrorKeys, label, data, ui } = opts;
      const cur = plugin._pathBMode === 'synced' ? 'synced' : 'local';
      const pick = await new Promise((resolve) => {
        const close = (v) => {
          try {
            box.remove();
          } catch (_) {}
          resolve(v);
        };
        const box = document.createElement('div');
        box.style.cssText =
          'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
        box.addEventListener('click', (e) => {
          if (e.target === box) close(null);
        });
        const card = document.createElement('div');
        card.style.cssText =
          'max-width:400px;width:100%;background:var(--panel-bg-color,#1d1915);border:1px solid var(--border-default,#3f3f46);border-radius:12px;padding:18px;';
        card.addEventListener('click', (e) => e.stopPropagation());
        const t = document.createElement('div');
        t.textContent = label + ' — storage';
        t.style.cssText = 'font-weight:700;margin-bottom:12px;';
        const b1 = document.createElement('button');
        b1.type = 'button';
        b1.textContent = 'This device only';
        const b2 = document.createElement('button');
        b2.type = 'button';
        b2.textContent = 'Sync via Plugin Settings';
        [b1, b2].forEach((b) => {
          b.style.cssText =
            'display:block;width:100%;padding:10px 12px;margin-bottom:8px;border-radius:8px;cursor:pointer;border:1px solid var(--border-default,#3f3f46);background:transparent;color:inherit;text-align:left;';
        });
        b1.addEventListener('click', () => close('local'));
        b2.addEventListener('click', () => close('synced'));
        const bx = document.createElement('button');
        bx.type = 'button';
        bx.textContent = 'Cancel';
        bx.style.cssText =
          'margin-top:8px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid var(--border-default,#3f3f46);background:transparent;color:inherit;';
        bx.addEventListener('click', () => close(null));
        card.appendChild(t);
        card.appendChild(b1);
        card.appendChild(b2);
        card.appendChild(bx);
        box.appendChild(card);
        document.body.appendChild(box);
      });
      if (!pick || pick === cur) return;
      try {
        localStorage.setItem(modeKey, pick);
      } catch (_) {}
      plugin._pathBMode = pick === 'synced' ? 'synced' : 'local';
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;
      if (pick === 'synced') await g.ThymerExtPathB.flushNow(data, pluginId, keys);
      ui.addToaster?.({
        title: label,
        message: 'Storage: ' + (pick === 'synced' ? 'synced' : 'local only'),
        dismissible: true,
        autoDestroyTime: 3500,
      });
    },
  };

})(typeof globalThis !== 'undefined' ? globalThis : window);
// @generated END thymer-ext-path-b

/*
  FEATURES
  - Shows records from configured collections whose date field matches the journal date
  - Expandable inline preview with collapsible nested nodes
  - Click any preview line to navigate to that record
  - Settings panel: configure date field name(s) and included/excluded collections
  - Survives DOM rebuilds (recordExpandedState pattern from EXPANDABLE_PREVIEW_PATTERN.md)
  - Re-populates automatically when navigating between journal dates

  SETTINGS: localStorage "tn_settings_v1" (+ tn_footer_collapsed), or synced via Plugin Settings (path B — see PLUGIN_SETTINGS_PERSISTENCE.md)
  {
    dateFields: ["When", "when"],      // property names to check for date matching
    excludedCollections: ["Archives"]  // collection names to hide
  }
*/

const TN_SETTINGS_KEY = 'tn_settings_v1';
const TN_PATHB_PLUGIN_ID = 'todays-notes';
const TN_QUERY_CACHE_TTL_MS = 45000;

/** Staggered queue so multiple path-B plugins do not open first-run dialogs at once. */
(function pathBFirstRunQueue(g) {
  if (g.__thymerExtPathBApi) return;
  const q = [];
  let busy = false;
  const runNext = () => {
    if (busy || !q.length) return;
    busy = true;
    const job = q.shift();
    Promise.resolve(typeof job === 'function' ? job() : job)
      .catch((e) => console.error('[ThymerExt PathB]', e))
      .finally(() => {
        busy = false;
        if (q.length) setTimeout(runNext, 450);
      });
  };
  g.__thymerExtPathBApi = { enqueue(job) { q.push(job); runNext(); } };
})(typeof globalThis !== 'undefined' ? globalThis : window);

class Plugin extends AppPlugin {

  onLoad() {
    (async () => {
      await (globalThis.ThymerExtPathB?.init?.({
        plugin: this,
        pluginId: TN_PATHB_PLUGIN_ID,
        modeKey: 'thymerext_ps_mode_todays-notes',
        mirrorKeys: () => [TN_SETTINGS_KEY, 'tn_footer_collapsed'],
        label: "Today's Notes",
        data: this.data,
        ui: this.ui,
      }) ?? (console.warn("[Today's Notes] ThymerExtPathB runtime missing (redeploy full plugin .js from repo)."), Promise.resolve()));

      this._panelStates     = new Map();
      this._eventHandlerIds = [];
      this._recordsByDateCache = new Map();
      this._collapsed       = this._loadBool('tn_footer_collapsed', false);
      this._settings        = this._loadSettings();

      this._injectCSS();

      // Register settings panel
      this.ui.registerCustomPanelType('tn-settings', (panel) => this._mountSettingsPanel(panel));
      this.ui.addCommandPaletteCommand({
        label: "Today's Notes: Settings", icon: 'ti-settings',
        onSelected: () => this._openSettings(),
      });
      this.ui.addCommandPaletteCommand({
        label: "Today's Notes: Storage location…", icon: 'ti-database',
        onSelected: () => {
        globalThis.ThymerExtPathB?.openStorageDialog?.({
          plugin: this,
          pluginId: TN_PATHB_PLUGIN_ID,
          modeKey: 'thymerext_ps_mode_todays-notes',
          mirrorKeys: () => [TN_SETTINGS_KEY, 'tn_footer_collapsed'],
          label: "Today's Notes",
          data: this.data,
          ui: this.ui,
        });
      },
      });

      this._eventHandlerIds.push(this.events.on('panel.navigated', ev => setTimeout(() => this._handlePanel(ev.panel), 400)));
      this._eventHandlerIds.push(this.events.on('panel.focused',   ev => this._handlePanel(ev.panel)));
      this._eventHandlerIds.push(this.events.on('panel.closed',    ev => this._disposePanel(ev.panel?.getId?.())));
      this._eventHandlerIds.push(this.events.on('record.created', () => this._onWorkspaceDataChanged()));
      this._eventHandlerIds.push(this.events.on('record.updated', (ev) => this._onRecordUpdatedForNotes(ev)));
      this._eventHandlerIds.push(this.events.on('record.moved',   () => this._onWorkspaceDataChanged()));
      // Thymer EventsAPI has no record.deleted; rely on record.updated / record.moved / panel events for refresh.

      setTimeout(() => {
        const p = this.ui.getActivePanel();
        if (p) this._handlePanel(p);
      }, 300);
    })().catch((e) => console.error("[Today's Notes] onLoad", e));
  }

  onUnload() {
    if (this._workspaceDataDebounceTimer) {
      try { clearTimeout(this._workspaceDataDebounceTimer); } catch (_) {}
      this._workspaceDataDebounceTimer = null;
    }
    for (const id of (this._eventHandlerIds || [])) {
      try { this.events.off(id); } catch (_) {}
    }
    this._eventHandlerIds = [];
    this._recordsByDateCache?.clear?.();
    for (const id of Array.from((this._panelStates || new Map()).keys())) this._disposePanel(id);
    this._panelStates?.clear();
  }

  // =========================================================================
  // Settings
  // =========================================================================

  _loadSettings() {
    try {
      const raw = localStorage.getItem(TN_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          dateFields:          Array.isArray(parsed.dateFields)          ? parsed.dateFields          : ['When', 'when'],
          excludedCollections: Array.isArray(parsed.excludedCollections) ? parsed.excludedCollections : [],
        };
      }
    } catch (_) {}
    return { dateFields: ['When', 'when'], excludedCollections: [] };
  }

  _saveSettings() {
    try { localStorage.setItem(TN_SETTINGS_KEY, JSON.stringify(this._settings)); } catch (_) {}
    this._invalidateRecordsCache();
    globalThis.ThymerExtPathB?.scheduleFlush?.(this, () => [TN_SETTINGS_KEY, 'tn_footer_collapsed']);
  }

  _settingsCacheSignature() {
    const fields = Array.isArray(this._settings?.dateFields) ? this._settings.dateFields : [];
    const excluded = Array.isArray(this._settings?.excludedCollections) ? this._settings.excludedCollections : [];
    const f = fields.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean).sort();
    const e = excluded.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean).sort();
    return JSON.stringify({ f, e });
  }

  _invalidateRecordsCache() {
    try { this._recordsByDateCache?.clear?.(); } catch (_) {}
  }

  /**
   * Path B plugins sync via a row in "Plugin Settings" (plugin_id + settings_json).
   * Those updates must not rebuild Today's Notes — e.g. Journal Image Gallery collapse
   * flushes twice (separate prop writes) and can fall outside our debounce window.
   */
  _onRecordUpdatedForNotes(ev) {
    if (this._isOtherPluginPathBSettingsRow(ev)) return;
    this._onWorkspaceDataChanged();
  }

  _isOtherPluginPathBSettingsRow(ev) {
    const guid = ev?.recordGuid;
    if (!guid) return false;
    let r;
    try { r = this.data.getRecord?.(guid); } catch (_) { r = null; }
    if (!r) return false;
    let pluginId = '';
    try {
      pluginId = String(r.text?.('plugin_id') ?? '').trim();
      if (!pluginId) {
        const p = r.prop?.('plugin_id');
        pluginId = String(p?.get?.() ?? p?.text?.() ?? '').trim();
      }
    } catch (_) {}
    if (!pluginId || pluginId === TN_PATHB_PLUGIN_ID) return false;
    let payload = '';
    try {
      payload = String(r.text?.('settings_json') ?? '').trim();
      if (!payload) {
        const p = r.prop?.('settings_json');
        payload = String(p?.text?.() ?? p?.get?.() ?? '').trim();
      }
    } catch (_) {}
    return !!payload;
  }

  _onWorkspaceDataChanged() {
    // Coalesce bursts of record.* events (startup sync, Path B, other plugins) so we
    // do not clear/repaint the footer on every event — that caused visible flashing
    // and starved other footers mounting into the same container.
    if (this._workspaceDataDebounceTimer) {
      try { clearTimeout(this._workspaceDataDebounceTimer); } catch (_) {}
    }
    this._workspaceDataDebounceTimer = setTimeout(() => {
      this._workspaceDataDebounceTimer = null;
      this._invalidateRecordsCache();
      this._refreshAll();
    }, 320);
  }

  async _openSettings() {
    const panel = await this.ui.createPanel();
    if (panel) panel.navigateToCustomType('tn-settings');
  }

  async _mountSettingsPanel(panel) {
    const el = panel.getElement();
    if (!el) return;
    panel.setTitle("Today's Notes — Settings");

    const allCollections = await this.data.getAllCollections();
    const journalNames   = new Set(['journal', 'journals']);
    const collections    = allCollections
      .map(c => c.getName() || '')
      .filter(n => n && !journalNames.has(n.toLowerCase()))
      .sort();

    // Working copy of settings
    const s = {
      dateFields:          [...this._settings.dateFields],
      excludedCollections: new Set(this._settings.excludedCollections),
    };

    const render = () => {
      el.innerHTML = '';
      el.style.cssText = 'padding:0;overflow:auto;height:100%;box-sizing:border-box;';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:24px;max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:20px;';

      // ── Date fields ────────────────────────────────────────────────────
      const dfSec = document.createElement('div');
      dfSec.appendChild(this._cfgLabel('Date Field Names',
        'Property names to check for the date. Add all variants used across your collections.'));

      s.dateFields.forEach((field, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
        const inp = document.createElement('input');
        inp.type  = 'text'; inp.value = field;
        inp.style.cssText = 'flex:1;padding:7px 10px;border-radius:6px;font-size:13px;background:var(--bg-default,#18181b);color:inherit;border:1px solid var(--border-default,#3f3f46);outline:none;';
        inp.addEventListener('input', () => { s.dateFields[i] = inp.value.trim(); });
        const rm = document.createElement('button');
        rm.textContent = '✕';
        rm.style.cssText = 'background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:13px;padding:4px 6px;flex-shrink:0;';
        rm.addEventListener('click', () => { s.dateFields.splice(i, 1); render(); });
        row.appendChild(inp); row.appendChild(rm);
        dfSec.appendChild(row);
      });

      const addFieldBtn = document.createElement('button');
      addFieldBtn.textContent = '+ Add field name';
      addFieldBtn.style.cssText = 'padding:6px 12px;background:transparent;border:1px dashed var(--border-default,#3f3f46);border-radius:6px;font-size:12px;color:var(--text-muted,#888);cursor:pointer;margin-top:4px;';
      addFieldBtn.addEventListener('click', () => { s.dateFields.push(''); render(); });
      dfSec.appendChild(addFieldBtn);
      wrap.appendChild(dfSec);

      // ── Collections ────────────────────────────────────────────────────
      const collSec = document.createElement('div');
      collSec.appendChild(this._cfgLabel('Collections',
        'Uncheck any collections you don\'t want to appear in Today\'s Notes.'));

      collections.forEach(name => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);';
        const cb = document.createElement('input');
        cb.type    = 'checkbox';
        cb.checked = !s.excludedCollections.has(name);
        cb.style.cssText = 'width:15px;height:15px;cursor:pointer;accent-color:var(--color-primary-500,#a78bfa);flex-shrink:0;';
        cb.addEventListener('change', () => {
          if (cb.checked) s.excludedCollections.delete(name);
          else s.excludedCollections.add(name);
        });
        const lbl = document.createElement('span');
        lbl.textContent = name;
        lbl.style.cssText = 'font-size:13px;';
        row.appendChild(cb); row.appendChild(lbl);
        collSec.appendChild(row);
      });
      wrap.appendChild(collSec);

      // ── Save ──────────────────────────────────────────────────────────
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save Settings';
      saveBtn.style.cssText = 'padding:10px 0;background:var(--color-primary-500,#a78bfa);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;width:100%;';
      saveBtn.addEventListener('click', () => {
        this._settings = {
          dateFields:          s.dateFields.filter(f => f.trim()),
          excludedCollections: Array.from(s.excludedCollections),
        };
        this._saveSettings();
        this._refreshAll();
        this.ui.addToaster({ title: 'Saved', message: "Today's Notes settings saved.", dismissible: true, autoDestroyTime: 3000 });
      });
      wrap.appendChild(saveBtn);
      el.appendChild(wrap);
    };

    render();
  }

  // =========================================================================
  // Panel lifecycle
  // =========================================================================

  _handlePanel(panel) {
    const panelId = panel?.getId?.();
    if (!panelId) return;

    const navType = panel?.getNavigation?.()?.type || '';
    if (navType === 'custom' || navType === 'custom_panel') { this._disposePanel(panelId); return; }

    const panelEl   = panel?.getElement?.();
    const container = this._findContainer(panelEl);

    // If container not found, set up a watcher to retry once it appears
    if (!container) {
      if (!this._isMutationObserveTarget(panelEl)) return;
      let state = this._panelStates.get(panelId);
      if (!state) {
        state = {
          panelId, panel, journalDate: 'unknown',
          rootEl: null, observer: null,
          loading: false, loaded: false,
          recordExpandedState: new Map(),
          _containerWatcher: null,
        };
        this._panelStates.set(panelId, state);

        // Watch panelEl for container to appear
        state._containerWatcher = new MutationObserver(() => {
          const newContainer = this._findContainer(panelEl);
          if (newContainer) {
            try { state._containerWatcher?.disconnect(); } catch (_) {}
            state._containerWatcher = null;
            this._handlePanel(panel); // Retry now that container exists
          }
        });
        try {
          state._containerWatcher.observe(panelEl, { childList: true, subtree: true });
        } catch (_) {
          try { state._containerWatcher.disconnect(); } catch (_) {}
          state._containerWatcher = null;
        }
      }
      return;
    }

    const record = panel?.getActiveRecord?.();
    if (!record)  { this._disposePanel(panelId); return; }

    const journalDate = this._journalDayKeyFromRecord(record);
    if (!journalDate) { this._disposePanel(panelId); return; }

    let state = this._panelStates.get(panelId);
    const dateChanged = state?.journalDate !== journalDate;

    if (!state) {
      state = {
        panelId, panel, journalDate,
        rootEl: null, observer: null,
        loading: false, loaded: false,
        recordExpandedState: new Map(),
      };
      this._panelStates.set(panelId, state);
    } else {
      // Disconnect container watcher if it exists (we found the container now)
      try { state._containerWatcher?.disconnect(); } catch (_) {}
      state._containerWatcher = null;

      state.journalDate = journalDate;
      state.panel       = panel;
      // Reset state when date changes
      if (dateChanged) {
        state.loaded = false;
        state.recordExpandedState = new Map();
      }
    }

    const rebuilt = this._mountFooter(state, container, panelEl);
    if (rebuilt) state.loading = false; // Cancel any in-progress populate targeting the old rootEl
    if (dateChanged || !state.loaded || rebuilt) {
      if (state.loading) {
        state._pendingPopulate = true; // In-progress fetch is stale; retry after it finishes
      } else {
        this._populate(state);
      }
    }
  }

  _disposePanel(panelId) {
    if (!panelId) return;
    const s = this._panelStates.get(panelId);
    if (!s) return;
    try { s.observer?.disconnect(); } catch (_) {}
    try { s._containerWatcher?.disconnect(); } catch (_) {}
    try { s.rootEl?.remove(); }       catch (_) {}
    this._panelStates.delete(panelId);
  }

  _refreshAll() {
    for (const [, s] of (this._panelStates || new Map())) {
      s.loaded = false;
      this._populate(s);
    }
  }

  // =========================================================================
  // DOM mounting
  // =========================================================================

  // Returns true if the footer was (re)built, false if it was already in place
  _mountFooter(state, container, panelEl) {
    // If footer exists, is connected, and is in the right container — no rebuild needed
    if (state.rootEl && state.rootEl.isConnected && state.rootEl.parentElement === container) {
      // Ensure observer is live (re-create if it was somehow lost)
      if (!state.observer) {
        state.observer = this._createFooterObserver(state, panelEl);
      }
      return false; // Already mounted — no rebuild
    }

    // Footer needs to be (re)built
    if (state.observer) {
      try { state.observer.disconnect(); } catch (_) {}
      state.observer = null;
    }
    clearTimeout(state._navTimer);

    // Remove any stale orphan footers for this panel
    const stale = container.querySelectorAll(`:scope > .tn-footer[data-panel-id="${state.panelId}"]`);
    for (const el of stale) { try { el.remove(); } catch (_) {} }

    state.rootEl = this._buildRoot(state);
    container.appendChild(state.rootEl);

    state.observer = this._createFooterObserver(state, panelEl);
    return true; // Footer was rebuilt — caller should re-populate
  }

  _createFooterObserver(state, panelEl) {
    if (!this._isMutationObserveTarget(panelEl)) return null;
    const obs = new MutationObserver(() => {
      if (state.rootEl && !state.rootEl.isConnected) {
        clearTimeout(state._navTimer);
        state._navTimer = setTimeout(() => {
          if (state.panel && state.rootEl && !state.rootEl.isConnected) {
            this._handlePanel(state.panel);
          }
        }, 300);
      }
    });
    try {
      obs.observe(panelEl, { childList: true, subtree: true });
    } catch (_) {
      try { obs.disconnect(); } catch (_) {}
      return null;
    }
    return obs;
  }

  _isMutationObserveTarget(el) {
    return !!(el && typeof el === 'object' && typeof Node !== 'undefined' && el instanceof Node);
  }

  _findContainer(panelEl) {
    if (!panelEl) return null;
    for (const sel of ['.page-content', '.editor-wrapper', '.editor-panel', '#editor']) {
      if (panelEl.matches?.(sel)) return panelEl;
      const all = panelEl.querySelectorAll?.(sel);
      if (all && all.length) return all[all.length - 1];
    }
    return null;
  }

  _buildRoot(state) {
    const root = document.createElement('div');
    root.className       = 'tn-footer';
    root.dataset.panelId = state.panelId;

    const header = document.createElement('div');
    header.className = 'tn-header';

    const toggle = document.createElement('button');
    toggle.className   = 'tn-toggle button-none button-small button-minimal-hover';
    toggle.type        = 'button';
    toggle.title       = 'Collapse / expand';
    toggle.textContent = this._collapsed ? '+' : '−';

    const titleIcon = document.createElement('span');
    titleIcon.className = 'tn-title-icon';
    try { titleIcon.appendChild(this.ui.createIcon('ti-notes')); }
    catch (_) { titleIcon.textContent = '📝'; }

    const titleEl = document.createElement('div');
    titleEl.className   = 'tn-title';
    titleEl.textContent = "Today's Notes";

    const countEl = document.createElement('div');
    countEl.className    = 'tn-count';
    countEl.dataset.role = 'count';

    const settingsBtn = document.createElement('button');
    settingsBtn.type      = 'button';
    settingsBtn.className = 'tn-settings-btn button-none button-small button-minimal-hover';
    settingsBtn.title     = 'Settings';
    settingsBtn.textContent = '⚙';
    settingsBtn.addEventListener('click', () => this._openSettings());

    header.appendChild(toggle);
    header.appendChild(titleIcon);
    header.appendChild(titleEl);
    header.appendChild(countEl);
    header.appendChild(settingsBtn);

    const body = document.createElement('div');
    body.dataset.role  = 'body';
    body.className     = 'tn-body';
    body.style.display = this._collapsed ? 'none' : 'block';

    toggle.addEventListener('click', () => {
      this._collapsed    = !this._collapsed;
      this._saveBool('tn_footer_collapsed', this._collapsed);
      toggle.textContent = this._collapsed ? '+' : '−';
      body.style.display = this._collapsed ? 'none' : 'block';
    });

    root.addEventListener('click', (e) => this._handleClick(e, state));

    root.appendChild(header);
    root.appendChild(body);
    return root;
  }

  // =========================================================================
  // Click delegation
  // =========================================================================

  _handleClick(e, state) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'expand-record') {
      e.stopPropagation();
      const recordGuid = actionEl.dataset.recordGuid || '';
      const groupEl    = actionEl.closest('.tn-record-group');
      if (groupEl) this._toggleRecordExpansion(state, recordGuid, groupEl).catch(() => {});
    }

    if (action === 'toggle-preview-node') {
      e.stopPropagation();
      const nodeGuid   = actionEl.dataset.nodeGuid   || '';
      const recordGuid = actionEl.dataset.recordGuid || '';
      const cached     = state?.recordExpandedState?.get?.(recordGuid);
      if (cached?.collapsedNodes) {
        const previewEl = actionEl.closest('.tlr-record-preview');
        if (cached.collapsedNodes.has(nodeGuid)) cached.collapsedNodes.delete(nodeGuid);
        else cached.collapsedNodes.add(nodeGuid);
        if (previewEl && cached.allItems) {
          this._renderRecordPreview(previewEl, cached.allItems, recordGuid, cached.collapsedNodes, state);
        }
      }
    }

    if (action === 'open-line') {
      e.stopPropagation();
      const recordGuid = actionEl.dataset.recordGuid || '';
      if (recordGuid) {
        state.panel?.navigateTo({
          workspaceGuid: this.getWorkspaceGuid(),
          type: 'edit_panel', rootId: recordGuid, subId: recordGuid,
        });
      }
    }
  }

  // =========================================================================
  // Data & rendering
  // =========================================================================

  async _populate(state) {
    if (state.loading) { return; }
    state.loading = true;

    // Capture current rootEl and date — used after the async call to detect if we've been superseded
    const targetRootEl = state.rootEl;
    const targetDate   = state.journalDate;

    const bodyEl = targetRootEl?.querySelector('[data-role="body"]');
    if (!bodyEl) { state.loading = false; return; }

    bodyEl.innerHTML = '<div class="tn-loading">Loading…</div>';

    try {
      const results = await this._getRecordsForDate(targetDate);

      // If rootEl was rebuilt or date changed while we awaited, our results are stale — abort
      if (state.rootEl !== targetRootEl || state.journalDate !== targetDate) {
        state.loading = false;
        if (state._pendingPopulate) { state._pendingPopulate = false; this._populate(state); }
        return;
      }
      if (!state.rootEl.isConnected) { state.loading = false; return; }

      const countEl = state.rootEl.querySelector('[data-role="count"]');
      bodyEl.innerHTML = '';

      if (results.length === 0) {
        bodyEl.innerHTML = '<div class="tn-empty">No notes found for this day.</div>';
        if (countEl) countEl.textContent = '';
      } else {
        if (countEl) countEl.textContent = String(results.length);

        const byCollection = new Map();
        for (const item of results) {
          if (!byCollection.has(item.collectionName)) byCollection.set(item.collectionName, []);
          byCollection.get(item.collectionName).push(item);
        }

        for (const [collName, items] of byCollection) {
          const label = document.createElement('div');
          label.className   = 'tn-coll-label';
          label.textContent = collName;
          bodyEl.appendChild(label);
          for (const item of items) bodyEl.appendChild(this._buildRow(item, state));
        }
      }

      state.loaded = true;
    } catch (e) {
      console.error('[TodaysNotes]', e);
      if (state.rootEl === targetRootEl && targetRootEl.isConnected) {
        bodyEl.innerHTML = '<div class="tn-empty">Error loading records.</div>';
      }
    }

    state.loading = false;
    if (state._pendingPopulate) { state._pendingPopulate = false; this._populate(state); }
  }

  _buildRow(item, state) {
    const guid = item.record.guid;

    const groupEl = document.createElement('div');
    groupEl.className          = 'tn-record-group';
    groupEl.dataset.recordGuid = guid;

    // Restore expanded class after DOM rebuild (EXPANDABLE_PREVIEW_PATTERN.md §3)
    if (state?.recordExpandedState?.get?.(guid)?.expanded === true) {
      groupEl.classList.add('tlr-record-expanded');
    }

    const row = document.createElement('div');
    row.className = 'tn-row';

    const nameBtn = document.createElement('button');
    nameBtn.type        = 'button';
    nameBtn.className   = 'tn-record-name button-none';
    nameBtn.textContent = item.record.getName() || 'Untitled';
    nameBtn.addEventListener('click', () => {
      state.panel?.navigateTo({
        workspaceGuid: this.getWorkspaceGuid(),
        type: 'edit_panel', rootId: guid, subId: guid,
      });
    });

    const arrow = document.createElement('button');
    arrow.type      = 'button';
    arrow.className = 'tn-arrow button-none';
    arrow.title     = 'Open';
    try { arrow.appendChild(this.ui.createIcon('ti-arrow-right')); }
    catch (_) { arrow.textContent = '→'; }
    arrow.addEventListener('click', () => {
      state.panel?.navigateTo({
        workspaceGuid: this.getWorkspaceGuid(),
        type: 'edit_panel', rootId: guid, subId: guid,
      });
    });

    row.appendChild(this._buildExpandRecordBtn(guid, state));
    row.appendChild(nameBtn);
    row.appendChild(arrow);
    groupEl.appendChild(row);
    groupEl.appendChild(this._buildRecordPreviewEl(guid, state));

    return groupEl;
  }

  // =========================================================================
  // Expandable preview (EXPANDABLE_PREVIEW_PATTERN.md)
  // =========================================================================

  _buildExpandRecordBtn(recordGuid, state) {
    const isExpanded  = state?.recordExpandedState?.get?.(recordGuid)?.expanded === true;
    const btn         = document.createElement('button');
    btn.type          = 'button';
    btn.className     = 'tlr-expand-record-btn button-none' + (isExpanded ? ' is-expanded' : '');
    btn.dataset.action     = 'expand-record';
    btn.dataset.recordGuid = recordGuid;
    btn.title       = isExpanded ? 'Hide record preview' : 'Preview record content inline';
    btn.textContent = isExpanded ? '▼' : '▶';
    return btn;
  }

  _buildRecordPreviewEl(recordGuid, state) {
    const previewEl           = document.createElement('div');
    previewEl.className       = 'tlr-record-preview';
    previewEl.dataset.previewGuid = recordGuid;
    const cached = state?.recordExpandedState?.get?.(recordGuid);
    if (cached?.expanded && cached?.allItems) {
      this._renderRecordPreview(previewEl, cached.allItems, recordGuid, cached.collapsedNodes || new Set(), state);
    }
    return previewEl;
  }

  async _toggleRecordExpansion(state, recordGuid, groupEl) {
    if (!state || !recordGuid || !groupEl) return;

    const expandBtn = groupEl.querySelector(`.tlr-expand-record-btn[data-record-guid="${recordGuid}"]`);
    const previewEl = groupEl.querySelector('.tlr-record-preview');
    const cached    = state.recordExpandedState.get(recordGuid);

    if (cached?.expanded) {
      state.recordExpandedState.set(recordGuid, { expanded: false, allItems: null, collapsedNodes: new Set() });
      groupEl.classList.remove('tlr-record-expanded');
      if (expandBtn) { expandBtn.classList.remove('is-expanded'); expandBtn.title = 'Preview record content inline'; expandBtn.textContent = '▶'; }
      if (previewEl) previewEl.innerHTML = '';
      return;
    }

    groupEl.classList.add('tlr-record-expanded');
    if (previewEl) { previewEl.innerHTML = ''; const l = document.createElement('div'); l.className = 'tlr-expand-loading'; l.textContent = 'Loading…'; previewEl.appendChild(l); }

    try {
      const record       = this.data.getRecord?.(recordGuid) || null;
      if (!record) throw new Error('Record not found');
      const rawItems     = await record.getLineItems();

      // Log transclusion items for debugging
      const transclusionItems = rawItems.filter(item => item?.type === 'ref' || item?.type === 'transclusion');
      if (transclusionItems.length > 0) {
        console.log('[TN-TRANSCLUSION-DEBUG]', { recordGuid, count: transclusionItems.length, items: transclusionItems });
      }

      const allItems     = await this._resolveTransclusions(rawItems, recordGuid);
      const collapsedNodes = new Set();
      state.recordExpandedState.set(recordGuid, { expanded: true, allItems, collapsedNodes });
      if (previewEl) this._renderRecordPreview(previewEl, allItems, recordGuid, collapsedNodes, state);
    } catch (_) {
      if (previewEl) { previewEl.innerHTML = ''; const e = document.createElement('div'); e.className = 'tlr-expand-empty'; e.textContent = 'Could not load record content.'; previewEl.appendChild(e); }
      state.recordExpandedState.set(recordGuid, { expanded: true, allItems: [], collapsedNodes: new Set() });
    }

    if (expandBtn) { expandBtn.classList.add('is-expanded'); expandBtn.title = 'Hide record preview'; expandBtn.textContent = '▼'; }
  }

  async _resolveTransclusions(items, recordGuid) {
    const visited = new Set([recordGuid]);
    const result  = [];

    for (const item of items) {
      const isTransclusion = item?.type === 'ref' || item?.type === 'transclusion';
      if (!isTransclusion) { result.push(item); continue; }

      // Extract GUID using the same sources as _appendLineText
      // Try segments first (most reliable), then fallbacks
      const refGuid = item?.segments?.[0]?.text?.guid ||
                      item?.segments?.[0]?.guid ||
                      item?.ref_guid ||
                      item?.guid_ref ||
                      item?.props?.guid ||
                      item?.props?.record_guid ||
                      null;

      if (!refGuid || visited.has(refGuid)) {
        result.push(item);
        continue;
      }
      visited.add(refGuid);

      try {
        const refRecord = this.data.getRecord?.(refGuid);
        const refItems  = refRecord ? await refRecord.getLineItems() : null;
        if (refItems && refItems.length > 0) {
          const transParent = item.parent_guid || recordGuid;
          const mapped = refItems.map(ri => {
            const isRoot = !ri.parent_guid || ri.parent_guid === refGuid;
            return isRoot ? Object.assign({}, ri, { parent_guid: transParent }) : ri;
          });
          result.push(...mapped);
          continue;
        }
      } catch (_) {}

      result.push(item); // fallback
    }
    return result;
  }

  _renderRecordPreview(previewEl, allItems, recordGuid, collapsedNodes, state) {
    if (!previewEl) return;
    previewEl.innerHTML = '';

    if (!allItems || allItems.length === 0) {
      const e = document.createElement('div'); e.className = 'tlr-expand-empty'; e.textContent = '(empty)'; previewEl.appendChild(e); return;
    }

    const childrenOf = new Map();
    for (const item of allItems) {
      const p = item.parent_guid || recordGuid;
      if (!childrenOf.has(p)) childrenOf.set(p, []);
      childrenOf.get(p).push(item);
    }

    const renderNode = (item, depth) => {
      const guid        = item.guid || '';
      const children    = childrenOf.get(guid) || [];
      const hasChildren = children.length > 0;
      const isCollapsed = collapsedNodes.has(guid);

      const nodeEl = document.createElement('div');
      nodeEl.className = 'tlr-preview-node';
      nodeEl.style.setProperty('--tlr-depth', depth);

      const rowEl = document.createElement('div');
      rowEl.className = 'tlr-preview-row';

      if (hasChildren) {
        const toggleEl = document.createElement('button');
        toggleEl.type      = 'button';
        toggleEl.className = 'tlr-preview-toggle button-none';
        toggleEl.dataset.action     = 'toggle-preview-node';
        toggleEl.dataset.nodeGuid   = guid;
        toggleEl.dataset.recordGuid = recordGuid;
        toggleEl.setAttribute('aria-label', isCollapsed ? 'Expand' : 'Collapse');
        toggleEl.textContent = isCollapsed ? '▶' : '▼';
        rowEl.appendChild(toggleEl);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'tlr-preview-spacer';
        rowEl.appendChild(spacer);
      }

      // Line content — clickable to navigate to record
      const lineBtn = document.createElement('button');
      lineBtn.type      = 'button';
      lineBtn.className = 'tlr-expand-line button-none';
      lineBtn.dataset.action     = 'open-line';
      lineBtn.dataset.recordGuid = recordGuid;
      lineBtn.dataset.lineGuid   = guid;
      this._appendLineText(lineBtn, item);
      rowEl.appendChild(lineBtn);

      nodeEl.appendChild(rowEl);

      if (hasChildren) {
        const childrenEl = document.createElement('div');
        childrenEl.className = 'tlr-preview-children' + (isCollapsed ? ' is-hidden' : '');
        for (const child of children) childrenEl.appendChild(renderNode(child, depth + 1));
        nodeEl.appendChild(childrenEl);
      }

      return nodeEl;
    };

    for (const root of (childrenOf.get(recordGuid) || [])) previewEl.appendChild(renderNode(root, 0));
  }

  _appendLineText(container, line) {
    // Handle transcluded lines — type 'ref' with no segments
    if (line?.type === 'ref' || line?.type === 'transclusion') {
      const refGuid = line?.ref_guid || line?.guid_ref || (line?.segments?.[0]?.text?.guid);
      const name    = refGuid ? (this._resolveRecordName(refGuid) || '[transcluded block]') : '[transcluded block]';
      const el      = document.createElement('span');
      el.className  = 'tn-seg-ref';
      el.textContent = '↪ ' + name;
      container.appendChild(el);
      return;
    }

    const prefix = this._linePrefix(line);
    if (prefix) {
      const p = document.createElement('span'); p.className = 'tn-prefix'; p.textContent = prefix; container.appendChild(p);
    }

    // If segments are empty but it's a ref-type block, show placeholder
    const segs = line?.segments || [];
    if (segs.length === 0) {
      // Could be an empty line or unsupported type — render nothing visible
      return;
    }

    const content = document.createElement('span');
    content.className = 'tn-line-content';
    this._appendSegments(content, segs);
    container.appendChild(content);
  }

  _linePrefix(line) {
    const t = line?.type || '';
    if (t === 'task')    return line.isTaskCompleted?.() ? '[x] ' : '[ ] ';
    if (t === 'ulist')   return '• ';
    if (t === 'olist')   return '1. ';
    if (t === 'heading') return '# ';
    if (t === 'quote')   return '> ';
    return '';
  }

  _appendSegments(container, segments) {
    for (const seg of segments || []) {
      if (!seg) continue;
      if (seg.type === 'text') {
        container.appendChild(document.createTextNode(typeof seg.text === 'string' ? seg.text : ''));
      } else if (seg.type === 'bold') {
        const el = document.createElement('strong'); el.textContent = typeof seg.text === 'string' ? seg.text : ''; container.appendChild(el);
      } else if (seg.type === 'italic') {
        const el = document.createElement('em'); el.textContent = typeof seg.text === 'string' ? seg.text : ''; container.appendChild(el);
      } else if (seg.type === 'code') {
        const el = document.createElement('code'); el.textContent = typeof seg.text === 'string' ? seg.text : ''; container.appendChild(el);
      } else if (seg.type === 'ref') {
        const el = document.createElement('span'); el.className = 'tn-seg-ref';
        el.textContent = seg.text?.title || this._resolveRecordName(seg.text?.guid) || '[link]'; container.appendChild(el);
      } else if (seg.type === 'link' || seg.type === 'linkobj') {
        const url = typeof seg.text === 'string' ? seg.text : (seg.text?.link || '');
        const a   = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.className = 'tn-seg-link'; a.textContent = seg.text?.title || url; container.appendChild(a);
      } else if (typeof seg.text === 'string' && seg.text) {
        container.appendChild(document.createTextNode(seg.text));
      }
    }
  }

  _resolveRecordName(guid) {
    try { return this.data.getRecord?.(guid)?.getName?.() || null; } catch (_) { return null; }
  }

  // =========================================================================
  // Data fetching
  // =========================================================================

  async _getRecordsForDate(yyyymmdd) {
    const sig = this._settingsCacheSignature();
    const cacheKey = `${yyyymmdd}::${sig}`;
    const now = Date.now();
    const hit = this._recordsByDateCache?.get?.(cacheKey);
    if (hit && (now - hit.ts) < TN_QUERY_CACHE_TTL_MS && Array.isArray(hit.results)) {
      return hit.results;
    }

    const y = parseInt(yyyymmdd.slice(0,4), 10);
    const m = parseInt(yyyymmdd.slice(4,6), 10) - 1;
    const d = parseInt(yyyymmdd.slice(6,8), 10);
    const dayStart = new Date(y, m, d,  0,  0,  0,   0);
    const dayEnd   = new Date(y, m, d, 23, 59, 59, 999);

    const excludedSet  = new Set(this._settings.excludedCollections.map(n => n.toLowerCase()));
    const journalNames = new Set(['journal', 'journals']);
    const collections  = await this.data.getAllCollections();

    // Fetch all collections in parallel instead of sequentially
    const perColl = await Promise.all(
      collections.map(async (coll) => {
        const name = coll.getName() || '';
        if (!name) return [];
        if (journalNames.has(name.toLowerCase())) return [];
        if (excludedSet.has(name.toLowerCase())) return [];

        let records;
        try { records = await coll.getAllRecords(); } catch (_) { return []; }

        const matches = [];
        for (const record of records) {
          const dateVal = this._getDateFieldValue(record);
          if (!dateVal) continue;
          if (dateVal >= dayStart && dateVal <= dayEnd) {
            matches.push({ record, collectionName: name, dateVal });
          }
        }
        return matches;
      })
    );

    const results = perColl.flat();
    results.sort((a, b) => {
      const c = a.collectionName.localeCompare(b.collectionName);
      return c !== 0 ? c : a.dateVal - b.dateVal;
    });

    try { this._recordsByDateCache.set(cacheKey, { ts: now, results }); } catch (_) {}
    return results;
  }

  _getDateFieldValue(record) {
    const fields = this._settings.dateFields.length > 0 ? this._settings.dateFields : ['When', 'when'];
    for (const propName of fields) {
      try {
        const prop = record.prop(propName);
        if (!prop) continue;
        if (typeof prop.date === 'function') { const d = prop.date(); if (d instanceof Date && !isNaN(d)) return d; }
        const raw = prop.get();
        if (!raw) continue;
        if (raw instanceof Date && !isNaN(raw)) return raw;
        if (typeof raw.toDate === 'function') { const d = raw.toDate(); if (d instanceof Date && !isNaN(d)) return d; }
        if (typeof raw.value === 'function')  { const d = new Date(raw.value()); if (!isNaN(d)) return d; }
        if (typeof raw === 'number')          { const d = new Date(raw); if (!isNaN(d)) return d; }
        if (typeof raw === 'string' && raw.length >= 8) { const d = new Date(raw); if (!isNaN(d)) return d; }
      } catch (_) {}
    }
    return null;
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  /** YYYYMMDD for real journal pages only — do not infer from record GUID (false positives on normal notes). */
  _journalDayKeyFromRecord(record) {
    if (!record) return null;
    try {
      const date = record.getJournalDetails?.()?.date;
      if (date instanceof Date && !isNaN(date.getTime())) {
        const y = String(date.getFullYear());
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
      }
    } catch (_) {}
    return null;
  }

  _loadBool(key, def) {
    try { const v = localStorage.getItem(key); return v === null ? def : v === 'true'; } catch (_) { return def; }
  }
  _saveBool(key, val) {
    try { localStorage.setItem(key, val ? 'true' : 'false'); } catch (_) {}
    globalThis.ThymerExtPathB?.scheduleFlush?.(this, () => [TN_SETTINGS_KEY, 'tn_footer_collapsed']);
  }


  _cfgLabel(title, subtitle) {
    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom:10px;';
    const t = document.createElement('div'); t.textContent = title;
    t.style.cssText = 'font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted,#8a7e6a);margin-bottom:4px;';
    wrap.appendChild(t);
    if (subtitle) {
      const s = document.createElement('div'); s.textContent = subtitle;
      s.style.cssText = 'font-size:12px;color:var(--text-muted,#8a7e6a);';
      wrap.appendChild(s);
    }
    return wrap;
  }

  _injectCSS() {
    /* Scope every rule under .tn-footer. Shared tlr-* class names match Thymer's journal
       line UI; global rules were leaking into the editor (wrong bullets / layout). */
    this.ui.injectCSS(`
      .tn-footer {
        margin-top: 16px;
        font-size: 13px;
        color: #e8e0d0;
        background-color: rgba(30, 30, 36, 0.60);
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 10px;
        padding: 12px 16px 10px;
      }
      .tn-footer .tn-header {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 30px;
        margin-bottom: 8px;
      }
      .tn-footer .tn-toggle {
        font-size: 13px;
        line-height: 1;
        color: #8a7e6a;
        cursor: pointer;
        padding: 0 4px;
        min-width: 18px;
        flex-shrink: 0;
      }
      .tn-footer .tn-title-icon {
        color: #8a7e6a;
        font-size: 14px;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
      }
      .tn-footer .tn-title {
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        flex: 1;
      }
      .tn-footer .tn-count {
        color: #8a7e6a;
        font-size: 12px;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .tn-footer .tn-settings-btn {
        font-size: 13px;
        color: #8a7e6a;
        cursor: pointer;
        padding: 0 2px;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .tn-footer:hover .tn-settings-btn { opacity: 1; }
      .tn-footer .tn-settings-btn:hover { color: #e8e0d0; }
      .tn-footer .tn-body { padding-bottom: 4px; }
      .tn-footer .tn-loading, .tn-footer .tn-empty {
        font-size: 12px;
        color: #8a7e6a;
        padding: 4px 0 6px;
        font-style: italic;
      }
      .tn-footer .tn-coll-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: #8a7e6a;
        padding: 8px 0 3px;
      }
      .tn-footer .tn-record-group {
        margin: 0 -6px;
        border-radius: 6px;
        margin-bottom: 2px;
      }
      .tn-footer .tn-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 5px 6px;
        border-radius: 6px;
        transition: background 0.1s;
      }
      .tn-footer .tn-record-group:not(.tlr-record-expanded) .tn-row:hover { background: rgba(255,255,255,0.05); }
      .tn-footer .tn-record-group.tlr-record-expanded .tn-row { background: rgba(255,255,255,0.04); border-radius: 6px 6px 0 0; }
      .tn-footer .tn-record-name {
        flex: 1;
        min-width: 0;
        text-align: left;
        font-size: 13px;
        color: #e8e0d0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
        padding: 0;
      }
      .tn-footer .tn-record-name:hover { color: #fff; }
      .tn-footer .tn-arrow {
        opacity: 0;
        color: #8a7e6a;
        flex-shrink: 0;
        font-size: 12px;
        cursor: pointer;
        padding: 0;
        transition: opacity 0.1s;
      }
      .tn-footer .tn-row:hover .tn-arrow { opacity: 1; }
      .tn-footer .tn-arrow:hover { color: #e8e0d0; }

      .tn-footer .tlr-expand-record-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        min-width: 14px;
        height: 16px;
        padding: 0;
        font-size: 12px;
        color: #8a7e6a;
        cursor: pointer;
        border-radius: 0;
        margin: 0;
        background: none;
        border: none;
        font-weight: 600;
        line-height: 1;
        vertical-align: middle;
        flex-shrink: 0;
      }
      .tn-footer .tlr-expand-record-btn:hover { color: #e8e0d0; }
      .tn-footer .tlr-expand-record-btn.is-expanded { color: var(--color-primary-400,#c4b5fd); }

      .tn-footer .tlr-record-preview {
        display: none;
        flex-direction: column;
        margin: 0 0 6px 10px;
        border-left: 2px solid rgba(255,255,255,0.08);
        padding: 6px 8px 8px 12px;
        border-radius: 0 8px 8px 0;
        background: rgba(0,0,0,0.12);
        font-family: var(--font-text, var(--font-family, inherit));
        font-size: var(--font-size-body, 13px);
        line-height: 1.45;
        color: var(--color-text-100, #e8e0d0);
      }
      .tn-footer .tlr-record-expanded .tlr-record-preview { display: flex; }
      .tn-footer .tlr-expand-loading, .tn-footer .tlr-expand-empty {
        font-style: italic;
        color: #8a7e6a;
        font-size: 12px;
        padding: 4px 0;
      }

      .tn-footer .tlr-preview-node {
        display: flex;
        flex-direction: column;
      }
      .tn-footer .tlr-preview-row {
        display: flex;
        align-items: center;
        gap: 2px;
        padding-left: calc(var(--tlr-depth, 0) * 16px);
      }
      .tn-footer .tlr-preview-toggle {
        width: 14px;
        min-width: 14px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        line-height: 1;
        color: #8a7e6a;
        padding: 0;
        cursor: pointer;
        font-size: 8px;
        transition: color 0.1s;
      }
      .tn-footer .tlr-preview-toggle:hover { color: #e8e0d0; }
      .tn-footer .tlr-preview-spacer { width: 14px; min-width: 14px; flex-shrink: 0; display: inline-block; }
      .tn-footer .tlr-preview-children { display: flex; flex-direction: column; }
      .tn-footer .tlr-preview-children.is-hidden { display: none; }
      .tn-footer .tlr-expand-line {
        flex: 1;
        min-width: 0;
        text-align: left;
        padding: 4px 6px;
        font-size: var(--font-size-body, 13px);
        color: var(--color-text-100, #e8e0d0);
        line-height: 1.45;
        border-radius: 4px;
        word-break: break-word;
        cursor: pointer;
      }
      .tn-footer .tlr-expand-line:hover { background: rgba(255,255,255,0.05); color: #e8e0d0; }

      .tn-footer .tn-prefix { color: #8a7e6a; font-size: 11px; flex-shrink: 0; margin-right: 2px; }
      .tn-footer .tn-line-content strong { color: #e8e0d0; }
      .tn-footer .tn-line-content em { opacity: 0.8; }
      .tn-footer .tn-line-content code { font-family: monospace; font-size: 11px; background: rgba(255,255,255,0.06); padding: 0 3px; border-radius: 3px; }
      .tn-footer .tn-seg-ref  { color: var(--color-primary-400,#c4b5fd); }
      .tn-footer .tn-seg-link { color: var(--color-primary-400,#c4b5fd); text-decoration: none; }
      .tn-footer .tn-seg-link:hover { text-decoration: underline; }
    `);
  }
}
