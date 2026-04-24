// ==Plugin==
// name: Today's Notes
// description: Footer on journal entries showing records whose date field matches
// icon: ti-calendar-stats
// ==/Plugin==



// @generated BEGIN thymer-plugin-settings (source: plugins/plugin-settings/ThymerPluginSettingsRuntime.js — run: npm run embed-plugin-settings)
/**
 * ThymerPluginSettings — workspace “Plugin Settings” collection + optional localStorage mirror
 * for global plugins that do not own a collection.
 *
 * Edit this file, then from repo root: npm run embed-plugin-settings
 *
 * API: ThymerPluginSettings.init({ plugin, pluginId, modeKey, mirrorKeys, label, data, ui })
 *      ThymerPluginSettings.scheduleFlush(plugin, mirrorKeys)
 *      ThymerPluginSettings.openStorageDialog({ plugin, pluginId, modeKey, mirrorKeys, label, data, ui })
 */
(function pluginSettingsRuntime(g) {
  if (g.ThymerPluginSettings) return;

  const COL_NAME = 'Plugin Settings';
  const q = [];
  let busy = false;

  /** Serialized ensures so concurrent plugin loads do not double-create the collection. */
  let _ensureChain = Promise.resolve();

  const PLUGIN_SETTINGS_SHAPE = {
    ver: 1,
    name: COL_NAME,
    icon: 'ti-adjustments',
    item_name: 'Setting',
    description:
      'Workspace storage for plugin preferences (cross-device when you choose synced settings). One row per plugin.',
    show_sidebar_items: true,
    show_cmdpal_items: false,
    views: [],
    fields: [
      {
        icon: 'ti-id',
        id: 'plugin_id',
        label: 'Plugin ID',
        type: 'text',
        read_only: false,
        active: true,
        many: false,
      },
      {
        icon: 'ti-code',
        id: 'settings_json',
        label: 'Settings JSON',
        type: 'text',
        read_only: false,
        active: true,
        many: false,
      },
    ],
    page_field_ids: ['plugin_id', 'settings_json'],
    sidebar_record_sort_field_id: 'updated_at',
    sidebar_record_sort_dir: 'desc',
    managed: { fields: false, views: false, sidebar: false },
    custom: {},
    home: false,
    color: null,
  };

  function cloneShape() {
    try {
      return structuredClone(PLUGIN_SETTINGS_SHAPE);
    } catch (_) {
      return JSON.parse(JSON.stringify(PLUGIN_SETTINGS_SHAPE));
    }
  }

  function drain() {
    if (busy || !q.length) return;
    busy = true;
    const job = q.shift();
    Promise.resolve(typeof job === 'function' ? job() : job)
      .catch((e) => console.error('[ThymerPluginSettings]', e))
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

  function ensurePluginSettingsCollection(data) {
    if (!data || typeof data.getAllCollections !== 'function' || typeof data.createCollection !== 'function') {
      return Promise.resolve();
    }
    const work = async () => {
      try {
        const existing = await findColl(data);
        if (existing) return;
        const coll = await data.createCollection();
        if (!coll || typeof coll.getConfiguration !== 'function' || typeof coll.saveConfiguration !== 'function') {
          return;
        }
        const again = await findColl(data);
        if (again) return;
        const conf = cloneShape();
        const base = coll.getConfiguration();
        if (base && typeof base.ver === 'number') conf.ver = base.ver;
        const ok = await coll.saveConfiguration(conf);
        if (ok === false) return;
        await new Promise((r) => setTimeout(r, 350));
      } catch (e) {
        console.error('[ThymerPluginSettings] ensure collection', e);
      }
    };
    _ensureChain = _ensureChain.catch(() => {}).then(work);
    return _ensureChain;
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
    const id = 'thymerext-ps-first-' + Math.random().toString(36).slice(2);
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
    const bSyn = mk(
      'Sync across devices',
      'Store in the workspace “' + COL_NAME + '” collection (same account on any browser).',
      preferred === 'synced'
    );
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

  g.ThymerPluginSettings = {
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

      plugin._pluginSettingsSyncMode = mode === 'synced' ? 'synced' : 'local';
      plugin._pluginSettingsPluginId = pluginId;
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;

      if (plugin._pluginSettingsSyncMode === 'synced' && remote && remote.payload && typeof remote.payload === 'object') {
        for (const k of keys) {
          const v = remote.payload[k];
          if (typeof v === 'string') {
            try {
              localStorage.setItem(k, v);
            } catch (_) {}
          }
        }
      }

      if (plugin._pluginSettingsSyncMode === 'synced') {
        try {
          await g.ThymerPluginSettings.flushNow(data, pluginId, keys);
        } catch (_) {}
      }
    },

    scheduleFlush(plugin, mirrorKeys) {
      if (plugin._pluginSettingsSyncMode !== 'synced') return;
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;
      if (plugin._pluginSettingsFlushTimer) clearTimeout(plugin._pluginSettingsFlushTimer);
      plugin._pluginSettingsFlushTimer = setTimeout(() => {
        plugin._pluginSettingsFlushTimer = null;
        const pdata = plugin.data;
        const pid = plugin._pluginSettingsPluginId;
        if (!pid || !pdata) return;
        g.ThymerPluginSettings.flushNow(pdata, pid, keys).catch((e) => console.error('[ThymerPluginSettings] flush', e));
      }, 500);
    },

    async flushNow(data, pluginId, mirrorKeys) {
      await ensurePluginSettingsCollection(data);
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
      const cur = plugin._pluginSettingsSyncMode === 'synced' ? 'synced' : 'local';
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
        b2.textContent = 'Sync across devices';
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
      plugin._pluginSettingsSyncMode = pick === 'synced' ? 'synced' : 'local';
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;
      if (pick === 'synced') await g.ThymerPluginSettings.flushNow(data, pluginId, keys);
      ui.addToaster?.({
        title: label,
        message: pick === 'synced' ? 'Settings will sync across devices.' : 'Settings stay on this device only.',
        dismissible: true,
        autoDestroyTime: 3500,
      });
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
// @generated END thymer-plugin-settings

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
    excludedCollections: ["Archives"], // collection names to hide
    panelLabel: "", // empty = default "Today's Notes"
    timeMachine: { enabled: true, filters: [{ field: "When", op: "same_day_last_year", value: "" }] }
  }
*/

const TN_SETTINGS_KEY = 'tn_settings_v1';
const TN_TM_SECTION_KEY = '__timemachine__';
const TN_SETTINGS_PLUGIN_ID = 'todays-notes';
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
      await (globalThis.ThymerPluginSettings?.init?.({
        plugin: this,
        pluginId: TN_SETTINGS_PLUGIN_ID,
        modeKey: 'thymerext_ps_mode_todays-notes',
        mirrorKeys: () => [TN_SETTINGS_KEY, 'tn_footer_collapsed'],
        label: "Today's Notes",
        data: this.data,
        ui: this.ui,
      }) ?? (console.warn("[Today's Notes] ThymerPluginSettings runtime missing (redeploy full plugin .js from repo)."), Promise.resolve()));

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
        globalThis.ThymerPluginSettings?.openStorageDialog?.({
          plugin: this,
          pluginId: TN_SETTINGS_PLUGIN_ID,
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

  _defaultTimeMachine() {
    return {
      enabled: true,
      filters: [{ id: 'tm_default', field: 'When', op: 'same_day_last_year', value: '' }],
    };
  }

  _normalizeTimeMachine(tm) {
    const base = this._defaultTimeMachine();
    if (!tm || typeof tm !== 'object') return base;
    const enabled = tm.enabled !== false;
    const filters = Array.isArray(tm.filters) && tm.filters.length
      ? tm.filters.map((f, i) => ({
        id: String(f?.id || `tm_${i}`),
        field: String(f?.field || 'When').trim(),
        op: String(f?.op || 'same_day_last_year').trim(),
        value: f?.value != null ? String(f.value) : '',
      }))
      : base.filters;
    return { enabled, filters };
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(TN_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          panelLabel:          typeof parsed.panelLabel === 'string' ? parsed.panelLabel : '',
          dateFields:          Array.isArray(parsed.dateFields)          ? parsed.dateFields          : ['When', 'when'],
          excludedCollections: Array.isArray(parsed.excludedCollections) ? parsed.excludedCollections : [],
          timeMachine:         this._normalizeTimeMachine(parsed.timeMachine),
        };
      }
    } catch (_) {}
    return { panelLabel: '', dateFields: ['When', 'when'], excludedCollections: [], timeMachine: this._defaultTimeMachine() };
  }

  _saveSettings() {
    try { localStorage.setItem(TN_SETTINGS_KEY, JSON.stringify(this._settings)); } catch (_) {}
    this._invalidateRecordsCache();
    globalThis.ThymerPluginSettings?.scheduleFlush?.(this, () => [TN_SETTINGS_KEY, 'tn_footer_collapsed']);
  }

  _settingsCacheSignature() {
    const pl = String(this._settings?.panelLabel || '').trim().toLowerCase();
    const fields = Array.isArray(this._settings?.dateFields) ? this._settings.dateFields : [];
    const excluded = Array.isArray(this._settings?.excludedCollections) ? this._settings.excludedCollections : [];
    const f = fields.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean).sort();
    const e = excluded.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean).sort();
    const tm = this._normalizeTimeMachine(this._settings?.timeMachine);
    return JSON.stringify({ pl, f, e, tm });
  }

  _panelTitleText() {
    const p = String(this._settings?.panelLabel || '').trim();
    return p || "Today's Notes";
  }

  _syncFooterTitles() {
    const t = this._panelTitleText();
    for (const [, s] of this._panelStates || new Map()) {
      const el = s.rootEl?.querySelector?.('.tn-title');
      if (el) el.textContent = t;
    }
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
    if (this._isOtherPluginSettingsRow(ev)) return;
    this._onWorkspaceDataChanged();
  }

  _isOtherPluginSettingsRow(ev) {
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
    if (!pluginId || pluginId === TN_SETTINGS_PLUGIN_ID) return false;
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

    const s = {
      panelLabel:          this._settings.panelLabel != null ? String(this._settings.panelLabel) : '',
      dateFields:          [...this._settings.dateFields],
      excludedCollections: new Set(this._settings.excludedCollections),
      timeMachine:         JSON.parse(JSON.stringify(this._normalizeTimeMachine(this._settings.timeMachine))),
    };

    const render = () => {
      el.innerHTML = '';
      el.style.cssText = 'padding:0;overflow:auto;height:100%;box-sizing:border-box;';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:24px;max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:20px;';

      // ── Panel title ─────────────────────────────────────────────────────
      const titleSec = document.createElement('div');
      titleSec.appendChild(this._cfgLabel('Footer title',
        'Label shown in the journal footer (leave blank for the default).'));
      const plInp = document.createElement('input');
      plInp.type = 'text';
      plInp.placeholder = "Today's Notes";
      plInp.value = s.panelLabel;
      plInp.style.cssText = 'width:100%;padding:7px 10px;border-radius:6px;font-size:13px;background:var(--bg-default,#18181b);color:inherit;border:1px solid var(--border-default,#3f3f46);outline:none;box-sizing:border-box;';
      plInp.addEventListener('input', () => { s.panelLabel = plInp.value; });
      titleSec.appendChild(plInp);
      wrap.appendChild(titleSec);

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

      // ── Time Machine ───────────────────────────────────────────────────
      const tmSec = document.createElement('div');
      tmSec.appendChild(this._cfgLabel('Time Machine',
        'Optional section at the bottom of the footer. Filters use the journal page date as context.'));

      const tmEn = document.createElement('label');
      tmEn.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-bottom:10px;';
      const tmCb = document.createElement('input');
      tmCb.type = 'checkbox';
      tmCb.checked = s.timeMachine.enabled !== false;
      tmCb.addEventListener('change', () => { s.timeMachine.enabled = tmCb.checked; });
      const tmLb = document.createElement('span');
      tmLb.textContent = 'Show Time Machine section';
      tmEn.appendChild(tmCb);
      tmEn.appendChild(tmLb);
      tmSec.appendChild(tmEn);

      s.timeMachine.filters = Array.isArray(s.timeMachine.filters) ? s.timeMachine.filters : [];
      const tmFiltersWrap = document.createElement('div');
      tmFiltersWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;';

      const opChoices = [
        ['same_day_last_year', 'Same calendar day, last year'],
        ['on_journal_day', 'On journal day'],
        ['same_month_day_as_journal', 'Same month/day as journal (any year)'],
        ['not_on_journal_day', 'Not on journal day'],
        ['eq', 'Text equals'],
        ['neq', 'Text not equals'],
        ['contains', 'Text contains'],
        ['not_contains', 'Text does not contain'],
        ['starts_with', 'Text starts with'],
        ['ends_with', 'Text ends with'],
        ['is_empty', 'Field empty'],
        ['is_not_empty', 'Field not empty'],
      ];

      const renderTmFilters = () => {
        tmFiltersWrap.innerHTML = '';
        s.timeMachine.filters.forEach((rule, ridx) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';
          const fin = document.createElement('input');
          fin.type = 'text';
          fin.placeholder = 'Field name (e.g. When)';
          fin.value = rule.field || '';
          fin.style.cssText = 'flex:1;min-width:100px;padding:6px 8px;border-radius:6px;font-size:12px;background:var(--bg-default,#18181b);color:inherit;border:1px solid var(--border-default,#3f3f46);';
          fin.addEventListener('input', () => { s.timeMachine.filters[ridx].field = fin.value.trim(); });
          const opSel = document.createElement('select');
          opSel.style.cssText = 'padding:6px 8px;border-radius:6px;font-size:12px;background:var(--bg-default,#18181b);color:inherit;border:1px solid var(--border-default,#3f3f46);';
          for (const [val, lab] of opChoices) {
            const o = document.createElement('option');
            o.value = val;
            o.textContent = lab;
            opSel.appendChild(o);
          }
          opSel.value = opChoices.some(([v]) => v === rule.op) ? rule.op : 'same_day_last_year';
          opSel.addEventListener('change', () => { s.timeMachine.filters[ridx].op = opSel.value; });
          const vin = document.createElement('input');
          vin.type = 'text';
          vin.placeholder = 'Compare value (text ops)';
          vin.value = rule.value || '';
          vin.style.cssText = 'flex:1;min-width:80px;padding:6px 8px;border-radius:6px;font-size:12px;background:var(--bg-default,#18181b);color:inherit;border:1px solid var(--border-default,#3f3f46);';
          vin.addEventListener('input', () => { s.timeMachine.filters[ridx].value = vin.value; });
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.textContent = '✕';
          rm.style.cssText = 'background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:12px;padding:4px;';
          rm.addEventListener('click', () => { s.timeMachine.filters.splice(ridx, 1); renderTmFilters(); });
          row.appendChild(fin);
          row.appendChild(opSel);
          row.appendChild(vin);
          row.appendChild(rm);
          tmFiltersWrap.appendChild(row);
        });
      };
      renderTmFilters();
      const addTmFilter = document.createElement('button');
      addTmFilter.type = 'button';
      addTmFilter.textContent = '+ Add filter rule';
      addTmFilter.style.cssText = 'margin-top:6px;padding:6px 12px;background:transparent;border:1px dashed var(--border-default,#3f3f46);border-radius:6px;font-size:12px;color:var(--text-muted,#888);cursor:pointer;';
      addTmFilter.addEventListener('click', () => {
        s.timeMachine.filters.push({ id: `tm_${Date.now()}`, field: 'When', op: 'same_day_last_year', value: '' });
        renderTmFilters();
      });
      tmSec.appendChild(tmFiltersWrap);
      tmSec.appendChild(addTmFilter);
      wrap.appendChild(tmSec);

      // ── Save ──────────────────────────────────────────────────────────
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save Settings';
      saveBtn.style.cssText = 'padding:10px 0;background:var(--color-primary-500,#a78bfa);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;width:100%;';
      saveBtn.addEventListener('click', () => {
        this._settings = {
          panelLabel:          String(s.panelLabel || '').trim(),
          dateFields:          s.dateFields.filter(f => f.trim()),
          excludedCollections: Array.from(s.excludedCollections),
          timeMachine:         this._normalizeTimeMachine(s.timeMachine),
        };
        this._saveSettings();
        this._syncFooterTitles();
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
          _sectionCollapsed: {},
          _lastMainResults: [],
          _lastCollectionIcons: {},
          timeMachineResults: null,
          timeMachineLoading: false,
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
        _sectionCollapsed: state?._sectionCollapsed || {},
        _lastMainResults: [],
        _lastCollectionIcons: {},
        timeMachineResults: null,
        timeMachineLoading: false,
      };
      this._panelStates.set(panelId, state);
    } else {
      // Disconnect container watcher if it exists (we found the container now)
      try { state._containerWatcher?.disconnect(); } catch (_) {}
      state._containerWatcher = null;

      state.journalDate = journalDate;
      state.panel       = panel;
      state._sectionCollapsed = state._sectionCollapsed || {};
      if (state.timeMachineResults === undefined) state.timeMachineResults = null;
      if (state.timeMachineLoading === undefined) state.timeMachineLoading = false;
      // Reset state when date changes
      if (dateChanged) {
        state.loaded = false;
        state.recordExpandedState = new Map();
        state._sectionCollapsed = {};
        state.timeMachineResults = null;
        state.timeMachineLoading = false;
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

  _timeMachineEnabled() {
    const tm = this._normalizeTimeMachine(this._settings?.timeMachine);
    return !!tm.enabled && Array.isArray(tm.filters) && tm.filters.length > 0;
  }

  _collectionSectionKey(name) {
    return `coll:${String(name || '').trim().toLowerCase()}`;
  }

  _allInnerTnSectionsCollapsed(state) {
    if (!state) return false;
    const byColl = this._groupResultsByCollection(state._lastMainResults || []);
    for (const name of byColl.keys()) {
      const sk = this._collectionSectionKey(name);
      if (!(sk in state._sectionCollapsed)) state._sectionCollapsed[sk] = false;
      if (!state._sectionCollapsed[sk]) return false;
    }
    if (this._timeMachineEnabled()) {
      if (!(TN_TM_SECTION_KEY in state._sectionCollapsed)) state._sectionCollapsed[TN_TM_SECTION_KEY] = false;
      if (!state._sectionCollapsed[TN_TM_SECTION_KEY]) return false;
    }
    return byColl.size > 0 || this._timeMachineEnabled();
  }

  _expandAllTnSections(state) {
    if (!state) return;
    const byColl = this._groupResultsByCollection(state._lastMainResults || []);
    for (const name of byColl.keys()) {
      state._sectionCollapsed[this._collectionSectionKey(name)] = false;
    }
    if (this._timeMachineEnabled()) state._sectionCollapsed[TN_TM_SECTION_KEY] = false;
  }

  _syncTnHeaderExtras(state) {
    const root = state?.rootEl;
    if (!root) return;
    const tmBtn = root.querySelector('.tn-tm-header-btn');
    if (tmBtn) {
      if (!this._timeMachineEnabled()) {
        tmBtn.style.display = 'none';
      } else {
        const tmCollapsed = !!state._sectionCollapsed?.[TN_TM_SECTION_KEY];
        tmBtn.style.display = tmCollapsed && !this._collapsed ? '' : 'none';
        tmBtn.title = 'Expand Time Machine and run query';
      }
    }
    const wrap = root.querySelector('.tn-collapsed-sections-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (this._collapsed) return;
    const byColl = this._groupResultsByCollection(state._lastMainResults || []);
    for (const collName of byColl.keys()) {
      const sk = this._collectionSectionKey(collName);
      if (!state._sectionCollapsed?.[sk]) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tn-collapsed-chip button-none button-small button-minimal-hover';
      btn.title = `Expand ${collName}`;
      btn.dataset.tnExpandSection = sk;
      const iconWrap = document.createElement('span');
      iconWrap.className = 'tn-collapsed-chip-icon';
      const rawIcon = (state._lastCollectionIcons && state._lastCollectionIcons[collName]) || '';
      if (!this._appendCollectionIconVisual(iconWrap, rawIcon)) {
        try { iconWrap.appendChild(this.ui.createIcon('ti-folder')); } catch (_) { iconWrap.textContent = '📁'; }
      }
      btn.appendChild(iconWrap);
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        state._sectionCollapsed[sk] = false;
        if (this._collapsed) {
          this._collapsed = false;
          this._saveBool('tn_footer_collapsed', this._collapsed);
          const body = root.querySelector('[data-role="body"]');
          const tgl = root.querySelector('.tn-toggle');
          if (body) body.style.display = 'block';
          if (tgl) tgl.textContent = '−';
        }
        this._renderFooterBody(state);
        this._syncTnHeaderExtras(state);
      });
      wrap.appendChild(btn);
    }

    // Time Machine when collapsed uses `.tn-tm-header-btn` only (avoid duplicate header icons).
  }

  _groupResultsByCollection(results) {
    const m = new Map();
    for (const item of results || []) {
      const n = item.collectionName || '';
      if (!m.has(n)) m.set(n, []);
      m.get(n).push(item);
    }
    return m;
  }

  _createIconNode(iconNames) {
    const list = Array.isArray(iconNames) ? iconNames : [iconNames];
    for (const name of list) {
      const key = String(name || '').trim();
      if (!key) continue;
      try {
        const node = this.ui.createIcon?.(key);
        if (node) return node;
      } catch (_) {}
    }
    return null;
  }

  _appendCollectionIconVisual(parent, rawIcon) {
    if (!parent) return false;
    const s = String(rawIcon || '').trim();
    if (!s) return false;
    if (/[^\x00-\x7F]/.test(s) && !/^ti[-\s]/i.test(s)) {
      const span = document.createElement('span');
      span.className = 'tn-collection-icon-emoji';
      span.textContent = s;
      span.setAttribute('aria-hidden', 'true');
      parent.appendChild(span);
      return true;
    }
    const candidates = [];
    if (s.startsWith('ti-')) {
      candidates.push(s, s.slice(3));
    } else {
      candidates.push(`ti-${s.replace(/^ti-?/i, '')}`, s);
    }
    for (const c of candidates) {
      const node = this._createIconNode([c]);
      if (node) {
        parent.appendChild(node);
        return true;
      }
    }
    const slug = (s.startsWith('ti-') ? s.slice(3) : s.replace(/^ti-?/i, '')).replace(/_/g, '-').replace(/\s+/g, '-');
    if (/^[a-z0-9-]+$/i.test(slug)) {
      const i = document.createElement('i');
      i.className = `ti ti-${slug.toLowerCase()}`;
      i.setAttribute('aria-hidden', 'true');
      parent.appendChild(i);
      return true;
    }
    return false;
  }

  _collectionIconName(coll) {
    if (!coll) return '';
    const candidates = [];
    const push = (v) => {
      if (v == null || typeof v === 'object') return;
      const t = String(v).trim();
      if (t) candidates.push(t);
    };
    try {
      const cfg = coll.getConfiguration?.() || {};
      push(cfg.icon);
      push(cfg.collection_icon);
      push(cfg.iconName);
      push(cfg.emoji);
    } catch (_) {}
    try {
      const data = coll?.getData?.() || {};
      push(data.icon);
      push(data.emoji);
    } catch (_) {}
    push(coll?.icon);
    try { push(coll.getIcon?.()); } catch (_) {}
    for (const raw of candidates) {
      if (/^ti-photo$/i.test(raw)) continue;
      if (raw.startsWith('ti-')) return raw;
      if (/^[a-z0-9_-]+$/i.test(raw)) return `ti-${raw.replace(/^ti-?/, '').replace(/_/g, '-')}`;
      if (/[^\x00-\x7F]/.test(raw)) return raw;
    }
    return '';
  }

  _appendTmGenerateIcon(btn, size = 18) {
    if (!btn) return;
    btn.innerHTML = '';
    const n = Math.max(12, Math.min(32, Number(size) || 18));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(n));
    svg.setAttribute('height', String(n));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', n <= 18 ? '1.75' : '1.65');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('d', 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z');
    svg.appendChild(p);
    btn.appendChild(svg);
  }

  _journalDateParts(yyyymmdd) {
    const y = parseInt(String(yyyymmdd || '').slice(0, 4), 10);
    const m = parseInt(String(yyyymmdd || '').slice(4, 6), 10);
    const d = parseInt(String(yyyymmdd || '').slice(6, 8), 10);
    return { year: y, month: m, day: d, yyyymmdd: String(yyyymmdd || '') };
  }

  _dayRangeFromKey(yyyymmdd) {
    const p = this._journalDateParts(yyyymmdd);
    const start = new Date(p.year, p.month - 1, p.day, 0, 0, 0, 0);
    const end = new Date(p.year, p.month - 1, p.day, 23, 59, 59, 999);
    return { start, end };
  }

  _dayRangeSameDayLastYear(yyyymmdd) {
    const p = this._journalDateParts(yyyymmdd);
    const start = new Date(p.year, p.month - 1, p.day, 0, 0, 0, 0);
    start.setFullYear(start.getFullYear() - 1);
    const end = new Date(p.year, p.month - 1, p.day, 23, 59, 59, 999);
    end.setFullYear(end.getFullYear() - 1);
    return { start, end };
  }

  _coerceDateForTm(raw) {
    if (!raw) return null;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
    if (typeof raw?.toDate === 'function') {
      const d = raw.toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    }
    if (typeof raw?.value === 'function') {
      const d = new Date(raw.value());
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (typeof raw === 'number') {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (typeof raw === 'string' && raw.length >= 8) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  _readDateFieldNamed(record, fieldName) {
    const key = String(fieldName || '').trim();
    if (!key) return null;
    try {
      const prop = record.prop(key);
      if (!prop) return null;
      if (typeof prop.date === 'function') {
        const d = prop.date();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      }
      return this._coerceDateForTm(prop.get?.());
    } catch (_) {}
    return null;
  }

  _readFieldValueSimple(record, fieldName) {
    const key = String(fieldName || '').trim();
    if (!key) return '';
    try {
      const prop = record.prop(key);
      if (!prop) return '';
      const raw = prop.get?.();
      if (raw == null) return '';
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
      if (raw instanceof Date) return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
      if (typeof raw?.label === 'string') return raw.label;
      if (typeof raw?.name === 'string') return raw.name;
      return String(raw);
    } catch (_) {
      return '';
    }
  }

  _recordPassesTmFilters(record, journalYyyymmdd) {
    const tm = this._normalizeTimeMachine(this._settings?.timeMachine);
    const filters = tm.filters || [];
    const journalParts = this._journalDateParts(journalYyyymmdd);
    const dayRange = this._dayRangeFromKey(journalYyyymmdd);
    const lastYearRange = this._dayRangeSameDayLastYear(journalYyyymmdd);
    for (const rule of filters) {
      if (!this._evaluateTmFilterRule(record, rule, journalParts, dayRange, lastYearRange)) return false;
    }
    return true;
  }

  _evaluateTmFilterRule(record, rule, journalParts, dayRange, lastYearRange) {
    const field = String(rule?.field || '').trim();
    const op = String(rule?.op || '').trim();
    const cmpRaw = String(rule?.value || '');
    if (!field && op !== 'always') return true;

    const isDateOp = ['on_journal_day', 'not_on_journal_day', 'same_month_day_as_journal', 'same_day_last_year'].includes(op);
    const raw = isDateOp ? this._readDateFieldNamed(record, field) : this._readFieldValueSimple(record, field);
    const value = (v) => {
      if (v == null) return '';
      if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
      return String(v).toLowerCase();
    };
    const cmp = String(cmpRaw || '').toLowerCase();

    if (op === 'is_empty') {
      if (isDateOp) return !this._coerceDateForTm(raw);
      const vs = this._readFieldValueSimple(record, field);
      return !vs || !String(vs).trim();
    }
    if (op === 'is_not_empty') {
      if (isDateOp) return !!this._coerceDateForTm(raw);
      const vs = this._readFieldValueSimple(record, field);
      return !!vs && !!String(vs).trim();
    }

    if (op === 'same_month_day_as_journal') {
      const d = this._coerceDateForTm(raw);
      if (!d) return false;
      return d.getMonth() + 1 === journalParts.month && d.getDate() === journalParts.day;
    }
    if (op === 'on_journal_day') {
      const d = this._coerceDateForTm(raw);
      if (!d) return false;
      return d >= dayRange.start && d <= dayRange.end;
    }
    if (op === 'not_on_journal_day') {
      const d = this._coerceDateForTm(raw);
      if (!d) return true;
      return !(d >= dayRange.start && d <= dayRange.end);
    }
    if (op === 'same_day_last_year') {
      const d = this._coerceDateForTm(raw);
      if (!d) return false;
      return d >= lastYearRange.start && d <= lastYearRange.end;
    }

    const v = value(raw);
    if (op === 'eq') return v === cmp;
    if (op === 'neq') return v !== cmp;
    if (op === 'contains') return v.includes(cmp);
    if (op === 'not_contains') return !v.includes(cmp);
    if (op === 'starts_with') return v.startsWith(cmp);
    if (op === 'ends_with') return v.endsWith(cmp);
    return true;
  }

  async _queryTimeMachineRecords(journalYyyymmdd) {
    const excludedSet = new Set((this._settings.excludedCollections || []).map((n) => n.toLowerCase()));
    const journalNames = new Set(['journal', 'journals']);
    const collections = await this.data.getAllCollections();
    const out = [];
    for (const coll of collections) {
      const name = coll.getName() || '';
      if (!name || journalNames.has(name.toLowerCase())) continue;
      if (excludedSet.has(name.toLowerCase())) continue;
      let records;
      try { records = await coll.getAllRecords(); } catch (_) { continue; }
      const icon = this._collectionIconName(coll);
      const tm0 = this._normalizeTimeMachine(this._settings.timeMachine).filters[0];
      for (const record of records) {
        if (!this._recordPassesTmFilters(record, journalYyyymmdd)) continue;
        let dateVal = this._getDateFieldValue(record);
        if (tm0?.field) {
          const named = this._readDateFieldNamed(record, tm0.field);
          if (named) dateVal = named;
        }
        const d = this._coerceDateForTm(dateVal);
        out.push({ record, collectionName: name, dateVal: d || dateVal || null, collectionIcon: icon });
      }
    }
    out.sort((a, b) => {
      const c = a.collectionName.localeCompare(b.collectionName);
      if (c !== 0) return c;
      const ta = a.dateVal instanceof Date && !Number.isNaN(a.dateVal.getTime()) ? a.dateVal.getTime() : 0;
      const tb = b.dateVal instanceof Date && !Number.isNaN(b.dateVal.getTime()) ? b.dateVal.getTime() : 0;
      return ta - tb;
    });
    return out;
  }

  /** When Time Machine is expanded but has never been queried (null), kick off a load (e.g. main footer expand-all). */
  _maybeKickTimeMachineLoad(state) {
    if (!this._timeMachineEnabled() || !state?.journalDate) return;
    if (state._sectionCollapsed?.[TN_TM_SECTION_KEY]) return;
    if (state.timeMachineLoading) return;
    if (state.timeMachineResults != null) return;
    void this._runTimeMachineGenerate(state);
  }

  async _runTimeMachineGenerate(state) {
    if (!this._timeMachineEnabled() || !state?.journalDate) return;
    state.timeMachineLoading = true;
    this._renderFooterBody(state);
    this._syncTnHeaderExtras(state);
    try {
      state.timeMachineResults = await this._queryTimeMachineRecords(state.journalDate);
    } catch (e) {
      console.error('[TodaysNotes] Time Machine', e);
      state.timeMachineResults = [];
    }
    state.timeMachineLoading = false;
    this._renderFooterBody(state);
    this._syncTnHeaderExtras(state);
  }

  _renderFooterBody(state) {
    const targetRootEl = state?.rootEl;
    if (!targetRootEl?.isConnected) return;
    const bodyEl = targetRootEl.querySelector('[data-role="body"]');
    if (!bodyEl) return;
    const countEl = targetRootEl.querySelector('[data-role="count"]');
    const results = state._lastMainResults || [];
    bodyEl.innerHTML = '';

    if (this._collapsed) {
      this._syncTnHeaderExtras(state);
      return;
    }

    if (!results.length) {
      if (countEl) countEl.textContent = '';
      if (!this._timeMachineEnabled()) {
        bodyEl.innerHTML = '<div class="tn-empty">No notes found for this day.</div>';
      }
    } else {
      if (countEl) countEl.textContent = String(results.length);
      const byColl = this._groupResultsByCollection(results);
      for (const [collName, items] of byColl) {
        const sk = this._collectionSectionKey(collName);
        if (!(sk in state._sectionCollapsed)) state._sectionCollapsed[sk] = false;
        if (state._sectionCollapsed[sk]) continue;
        const icon = (state._lastCollectionIcons && state._lastCollectionIcons[collName]) || '';
        bodyEl.appendChild(this._buildCollectionSectionEl(collName, items, icon, sk, state));
      }
    }

    if (this._timeMachineEnabled()) {
      if (!(TN_TM_SECTION_KEY in state._sectionCollapsed)) state._sectionCollapsed[TN_TM_SECTION_KEY] = false;
      if (!state._sectionCollapsed[TN_TM_SECTION_KEY]) {
        bodyEl.appendChild(this._buildTimeMachineSectionEl(state));
      }
    }

    const hasCollapsed = Object.keys(state._sectionCollapsed || {}).some((k) => state._sectionCollapsed[k]);
    const hasMain = results.length > 0;
    if (!hasMain && bodyEl.children.length === 0 && !hasCollapsed && !this._timeMachineEnabled()) {
      bodyEl.innerHTML = '<div class="tn-empty">No notes found for this day.</div>';
    } else if (!hasMain && bodyEl.children.length === 0 && hasCollapsed && !this._timeMachineEnabled()) {
      bodyEl.innerHTML = '';
    }
    this._syncTnHeaderExtras(state);
  }

  _buildCollectionSectionEl(collName, items, rawIcon, sectionKey, state) {
    const wrap = document.createElement('div');
    wrap.className = 'tn-section';

    const head = document.createElement('div');
    head.className = 'tn-section-head';

    const hoverWrap = document.createElement('div');
    hoverWrap.className = 'tn-section-head-inner';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'tn-section-icon';
    if (!this._appendCollectionIconVisual(iconWrap, rawIcon)) {
      try { iconWrap.appendChild(this.ui.createIcon('ti-folder')); } catch (_) { iconWrap.textContent = '📁'; }
    }

    const title = document.createElement('div');
    title.className = 'tn-section-title';
    title.textContent = collName;

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'tn-section-collapse-btn button-none';
    collapseBtn.innerHTML = '<i class="ti ti-chevron-up" aria-hidden="true"></i>';
    collapseBtn.title = 'Collapse section';
    const collapse = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      state._sectionCollapsed[sectionKey] = true;
      this._renderFooterBody(state);
      this._syncTnHeaderExtras(state);
    };
    collapseBtn.addEventListener('click', collapse);
    hoverWrap.addEventListener('click', (ev) => {
      if (ev.target.closest?.('.tn-section-collapse-btn')) return;
      collapse(ev);
    });

    hoverWrap.append(iconWrap, title, collapseBtn);
    head.appendChild(hoverWrap);
    wrap.appendChild(head);

    const list = document.createElement('div');
    list.className = 'tn-section-body';
    for (const item of items) list.appendChild(this._buildRow(item, state));
    wrap.appendChild(list);
    return wrap;
  }

  _buildTimeMachineSectionEl(state) {
    const wrap = document.createElement('div');
    wrap.className = 'tn-section tn-tm-section';

    const head = document.createElement('div');
    head.className = 'tn-section-head tn-tm-head';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'tn-section-icon';
    try {
      iconWrap.appendChild(this.ui.createIcon('ti-hourglass'));
    } catch (_) {
      iconWrap.textContent = '⏳';
    }
    const title = document.createElement('div');
    title.className = 'tn-section-title';
    title.textContent = 'Time Machine';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'tn-section-collapse-btn button-none';
    collapseBtn.innerHTML = '<i class="ti ti-chevron-up" aria-hidden="true"></i>';
    collapseBtn.title = 'Collapse Time Machine';
    collapseBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state._sectionCollapsed[TN_TM_SECTION_KEY] = true;
      this._renderFooterBody(state);
      this._syncTnHeaderExtras(state);
    });
    const headInner = document.createElement('div');
    headInner.className = 'tn-section-head-inner';
    headInner.append(iconWrap, title, collapseBtn);
    head.appendChild(headInner);
    wrap.appendChild(head);

    const body = document.createElement('div');
    body.className = 'tn-section-body tn-tm-body';
    wrap.appendChild(body);

    if (state.timeMachineLoading) {
      const loading = document.createElement('div');
      loading.className = 'tn-loading';
      loading.textContent = 'Loading Time Machine…';
      body.appendChild(loading);
      return wrap;
    }

    if (state.timeMachineResults == null) {
      return wrap;
    }

    if (!state.timeMachineResults.length) {
      const empty = document.createElement('div');
      empty.className = 'tn-empty';
      empty.textContent = 'No records matched your Time Machine filters.';
      body.appendChild(empty);
      return wrap;
    }

    const byColl = this._groupResultsByCollection(state.timeMachineResults);
    for (const [collName, items] of byColl) {
      const subLabel = document.createElement('div');
      subLabel.className = 'tn-tm-subcoll';
      subLabel.textContent = collName;
      body.appendChild(subLabel);
      for (const item of items) body.appendChild(this._buildRow(item, state));
    }
    return wrap;
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
    titleEl.textContent = this._panelTitleText();

    const countEl = document.createElement('div');
    countEl.className    = 'tn-count';
    countEl.dataset.role = 'count';

    const collapsedSectionsWrap = document.createElement('span');
    collapsedSectionsWrap.className = 'tn-collapsed-sections-wrap';

    const tmHeaderBtn = document.createElement('button');
    tmHeaderBtn.type = 'button';
    tmHeaderBtn.className = 'tn-tm-header-btn button-none button-small button-minimal-hover';
    tmHeaderBtn.title = 'Expand Time Machine and run query';
    tmHeaderBtn.style.display = 'none';
    tmHeaderBtn.setAttribute('aria-label', 'Expand Time Machine and run query');
    this._appendTmGenerateIcon(tmHeaderBtn, 18);
    tmHeaderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this._timeMachineEnabled()) return;
      state._sectionCollapsed[TN_TM_SECTION_KEY] = false;
      if (this._collapsed) {
        this._collapsed = false;
        this._saveBool('tn_footer_collapsed', this._collapsed);
        const body = root.querySelector('[data-role="body"]');
        const tgl = root.querySelector('.tn-toggle');
        if (body) body.style.display = 'block';
        if (tgl) tgl.textContent = '−';
      }
      this._renderFooterBody(state);
      this._syncTnHeaderExtras(state);
      void this._runTimeMachineGenerate(state);
    });

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
    header.appendChild(collapsedSectionsWrap);
    header.appendChild(tmHeaderBtn);
    header.appendChild(settingsBtn);

    const body = document.createElement('div');
    body.dataset.role  = 'body';
    body.className     = 'tn-body';
    body.style.display = this._collapsed ? 'none' : 'block';

    toggle.addEventListener('click', () => {
      const wasCollapsed = this._collapsed;
      this._collapsed    = !this._collapsed;
      if (!this._collapsed && wasCollapsed && this._allInnerTnSectionsCollapsed(state)) {
        this._expandAllTnSections(state);
      }
      this._saveBool('tn_footer_collapsed', this._collapsed);
      toggle.textContent = this._collapsed ? '+' : '−';
      body.style.display = this._collapsed ? 'none' : 'block';
      if (!this._collapsed) {
        this._renderFooterBody(state);
        this._maybeKickTimeMachineLoad(state);
      }
      this._syncTnHeaderExtras(state);
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

    this._syncFooterTitles();

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

      if (!this._timeMachineEnabled()) {
        state.timeMachineResults = null;
        state.timeMachineLoading = false;
      }

      state._lastMainResults = results;
      state._lastCollectionIcons = {};
      for (const item of results) {
        const n = item.collectionName;
        if (n && item.collectionIcon && !state._lastCollectionIcons[n]) {
          state._lastCollectionIcons[n] = item.collectionIcon;
        }
      }

      this._renderFooterBody(state);

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
      return hit.results.map((x) => ({ ...x }));
    }

    const y = parseInt(yyyymmdd.slice(0,4), 10);
    const m = parseInt(yyyymmdd.slice(4,6), 10) - 1;
    const d = parseInt(yyyymmdd.slice(6,8), 10);
    const dayStart = new Date(y, m, d,  0,  0,  0,   0);
    const dayEnd   = new Date(y, m, d, 23, 59, 59, 999);

    const excludedSet  = new Set(this._settings.excludedCollections.map(n => n.toLowerCase()));
    const journalNames = new Set(['journal', 'journals']);
    const collections  = await this.data.getAllCollections();

    const perColl = await Promise.all(
      collections.map(async (coll) => {
        const name = coll.getName() || '';
        if (!name) return [];
        if (journalNames.has(name.toLowerCase())) return [];
        if (excludedSet.has(name.toLowerCase())) return [];

        let records;
        try { records = await coll.getAllRecords(); } catch (_) { return []; }

        const collIcon = this._collectionIconName(coll);
        const matches = [];
        for (const record of records) {
          const dateVal = this._getDateFieldValue(record);
          if (!dateVal) continue;
          if (dateVal >= dayStart && dateVal <= dayEnd) {
            matches.push({ record, collectionName: name, dateVal, collectionIcon: collIcon });
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
    globalThis.ThymerPluginSettings?.scheduleFlush?.(this, () => [TN_SETTINGS_KEY, 'tn_footer_collapsed']);
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
      .tn-footer .tn-collapsed-sections-wrap {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        justify-content: flex-end;
        max-width: 42%;
      }
      .tn-footer .tn-collapsed-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.12);
        color: #8a7e6a;
        flex-shrink: 0;
      }
      .tn-footer .tn-collapsed-chip:hover {
        background: rgba(255,255,255,0.06);
        color: #e8e0d0;
      }
      .tn-footer .tn-collapsed-chip-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }
      .tn-footer .tn-tm-header-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        color: #8a7e6a;
        flex-shrink: 0;
        padding: 0;
        line-height: 0;
      }
      .tn-footer .tn-tm-header-btn:hover { color: #e8e0d0; }
      .tn-footer .tn-section {
        margin-top: 10px;
        border-top: 1px solid rgba(255,255,255,0.08);
        padding-top: 8px;
      }
      .tn-footer .tn-section:first-of-type { margin-top: 0; border-top: none; padding-top: 0; }
      .tn-footer .tn-section-head { margin-bottom: 6px; }
      .tn-footer .tn-section-head-inner {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
      }
      .tn-footer .tn-section-icon {
        display: inline-flex;
        align-items: center;
        color: #8a7e6a;
        flex-shrink: 0;
      }
      .tn-footer .tn-section-title {
        flex: 1;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: #8a7e6a;
      }
      .tn-footer .tn-section-collapse-btn {
        color: #8a7e6a;
        padding: 0 4px;
        font-size: 14px;
        flex-shrink: 0;
      }
      .tn-footer .tn-section-collapse-btn:hover { color: #e8e0d0; }
      .tn-footer .tn-section-body { padding-left: 2px; }
      .tn-footer .tn-tm-section { border-top: 1px solid rgba(255,255,255,0.08); }
      .tn-footer .tn-tm-subcoll {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #8a7e6a;
        margin: 8px 0 4px;
      }
      .tn-footer .tn-collection-icon-emoji { font-size: 14px; line-height: 1; }
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
