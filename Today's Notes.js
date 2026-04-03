// ==Plugin==
// name: Today's Notes
// description: Footer on journal entries showing records whose date field matches
// icon: ti-calendar-stats
// ==/Plugin==

/*
  FEATURES
  - Shows records from configured collections whose date field matches the journal date
  - Expandable inline preview with collapsible nested nodes
  - Click any preview line to navigate to that record
  - Settings panel: configure date field name(s) and included/excluded collections
  - Survives DOM rebuilds (recordExpandedState pattern from EXPANDABLE_PREVIEW_PATTERN.md)
  - Re-populates automatically when navigating between journal dates

  SETTINGS stored in localStorage "tn_settings_v1"
  {
    dateFields: ["When", "when"],      // property names to check for date matching
    excludedCollections: ["Archives"]  // collection names to hide
  }
*/

const TN_SETTINGS_KEY = 'tn_settings_v1';

class Plugin extends AppPlugin {

  onLoad() {
    this._panelStates     = new Map();
    this._eventHandlerIds = [];
    this._collapsed       = this._loadBool('tn_footer_collapsed', false);
    this._settings        = this._loadSettings();

    this._injectCSS();

    // Register settings panel
    this.ui.registerCustomPanelType('tn-settings', (panel) => this._mountSettingsPanel(panel));
    this.ui.addCommandPaletteCommand({
      label: "Today's Notes: Settings", icon: 'ti-settings',
      onSelected: () => this._openSettings(),
    });

    this._eventHandlerIds.push(this.events.on('panel.navigated', ev => setTimeout(() => this._handlePanel(ev.panel), 400)));
    this._eventHandlerIds.push(this.events.on('panel.focused',   ev => this._handlePanel(ev.panel)));
    this._eventHandlerIds.push(this.events.on('panel.closed',    ev => this._disposePanel(ev.panel?.getId?.())));
    this._eventHandlerIds.push(this.events.on('record.created',  ()  => this._refreshAll()));

    setTimeout(() => {
      const p = this.ui.getActivePanel();
      if (p) this._handlePanel(p);
    }, 300);
  }

  onUnload() {
    for (const id of (this._eventHandlerIds || [])) {
      try { this.events.off(id); } catch (_) {}
    }
    this._eventHandlerIds = [];
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

    console.log('[TN] _handlePanel', { panelId: panelId?.slice(-6), navType, hasContainer: !!container, hasEl: !!panelEl });

    // If container not found, set up a watcher to retry once it appears
    if (!container) {
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
        state._containerWatcher.observe(panelEl, { childList: true, subtree: true });
      }
      return;
    }

    const record = panel?.getActiveRecord?.();
    if (!record)  { this._disposePanel(panelId); return; }

    const journalDate = this._journalDateFromGuid(record.guid);
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
    console.log('[TN] mounting', { panelId: panelId?.slice(-6), date: journalDate, rebuilt, dateChanged, loaded: state.loaded });
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
    obs.observe(panelEl, { childList: true, subtree: true });
    return obs;
  }

  _findContainer(panelEl) {
    if (!panelEl) return null;
    for (const sel of ['.page-content', '.editor-wrapper', '.editor-panel', '#editor']) {
      if (panelEl.matches?.(sel)) return panelEl;
      const child = panelEl.querySelector?.(sel);
      if (child) return child;
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
    if (state.loading) { console.log('[TN] _populate blocked (already loading)', state.journalDate); return; }
    state.loading = true;
    console.log('[TN] _populate START', state.journalDate, new Date().toISOString());

    // Capture current rootEl and date — used after the async call to detect if we've been superseded
    const targetRootEl = state.rootEl;
    const targetDate   = state.journalDate;

    const bodyEl = targetRootEl?.querySelector('[data-role="body"]');
    if (!bodyEl) { state.loading = false; return; }

    bodyEl.innerHTML = '<div class="tn-loading">Loading…</div>';

    try {
      console.log('[TN] fetching records for', targetDate);
      const t0 = performance.now();
      const results = await this._getRecordsForDate(targetDate);
      console.log('[TN] fetch done', targetDate, `${(performance.now()-t0).toFixed(0)}ms`, results.length, 'results');

      // If rootEl was rebuilt or date changed while we awaited, our results are stale — abort
      if (state.rootEl !== targetRootEl || state.journalDate !== targetDate) {
        console.log('[TN] stale, aborting');
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
      const fRect = state.rootEl.getBoundingClientRect();
      console.log('[TN] footer rendered', results.length, 'results',
        `connected:${state.rootEl.isConnected}`,
        `rect:${Math.round(fRect.width)}x${Math.round(fRect.height)} @${Math.round(fRect.top)},${Math.round(fRect.left)}`,
        `visible:${fRect.width > 0 && fRect.height > 0}`
      );
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

  _journalDateFromGuid(guid) {
    if (!guid || guid.length < 8) return null;
    const suffix = guid.slice(-8);
    if (!/^\d{8}$/.test(suffix)) return null;
    const year  = parseInt(suffix.slice(0,4), 10);
    const month = parseInt(suffix.slice(4,6), 10);
    const day   = parseInt(suffix.slice(6,8), 10);
    if (year < 2000 || year > 2099) return null;
    if (month < 1 || month > 12)    return null;
    if (day < 1   || day > 31)      return null;
    return suffix;
  }

  _loadBool(key, def) {
    try { const v = localStorage.getItem(key); return v === null ? def : v === 'true'; } catch (_) { return def; }
  }
  _saveBool(key, val) {
    try { localStorage.setItem(key, val ? 'true' : 'false'); } catch (_) {}
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
      .tn-header {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 30px;
        margin-bottom: 8px;
      }
      .tn-toggle {
        font-size: 13px;
        line-height: 1;
        color: #8a7e6a;
        cursor: pointer;
        padding: 0 4px;
        min-width: 18px;
        flex-shrink: 0;
      }
      .tn-title {
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        flex: 1;
      }
      .tn-count {
        color: #8a7e6a;
        font-size: 12px;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .tn-settings-btn {
        font-size: 13px;
        color: #8a7e6a;
        cursor: pointer;
        padding: 0 2px;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .tn-footer:hover .tn-settings-btn { opacity: 1; }
      .tn-settings-btn:hover { color: #e8e0d0; }
      .tn-body { padding-bottom: 4px; }
      .tn-loading, .tn-empty {
        font-size: 12px;
        color: #8a7e6a;
        padding: 4px 0 6px;
        font-style: italic;
      }
      .tn-coll-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: #8a7e6a;
        padding: 8px 0 3px;
      }
      .tn-record-group {
        margin: 0 -6px;
        border-radius: 6px;
        margin-bottom: 2px;
      }
      .tn-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 5px 6px;
        border-radius: 6px;
        transition: background 0.1s;
      }
      .tn-record-group:not(.tlr-record-expanded) .tn-row:hover { background: rgba(255,255,255,0.05); }
      .tn-record-group.tlr-record-expanded .tn-row { background: rgba(255,255,255,0.04); border-radius: 6px 6px 0 0; }
      .tn-record-name {
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
      .tn-record-name:hover { color: #fff; }
      .tn-arrow {
        opacity: 0;
        color: #8a7e6a;
        flex-shrink: 0;
        font-size: 12px;
        cursor: pointer;
        padding: 0;
        transition: opacity 0.1s;
      }
      .tn-row:hover .tn-arrow { opacity: 1; }
      .tn-arrow:hover { color: #e8e0d0; }

      /* Expand button */
      .tlr-expand-record-btn {
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
      .tlr-expand-record-btn:hover { color: #e8e0d0; }
      .tlr-expand-record-btn.is-expanded { color: var(--color-primary-400,#c4b5fd); }

      /* Preview container */
      .tlr-record-preview {
        display: none;
        flex-direction: column;
        margin: 0 0 6px 10px;
        border-left: 2px solid rgba(255,255,255,0.08);
        padding-left: 8px;
      }
      .tlr-record-expanded .tlr-record-preview { display: flex; }
      .tlr-expand-loading, .tlr-expand-empty {
        font-style: italic;
        color: #8a7e6a;
        font-size: 12px;
        padding: 4px 0;
      }

      /* Preview tree — indent only the children container, not the node itself */
      .tlr-preview-node {
        display: flex;
        flex-direction: column;
      }
      .tlr-preview-row {
        display: flex;
        align-items: center;
        gap: 2px;
        padding-left: calc(var(--tlr-depth, 0) * 16px);
      }
      .tlr-preview-toggle {
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
      .tlr-preview-toggle:hover { color: #e8e0d0; }
      .tlr-preview-spacer { width: 14px; min-width: 14px; flex-shrink: 0; display: inline-block; }
      .tlr-preview-children { display: flex; flex-direction: column; }
      .tlr-preview-children.is-hidden { display: none; }
      .tlr-expand-line {
        flex: 1;
        min-width: 0;
        text-align: left;
        padding: 2px 4px;
        font-size: 12px;
        color: #c8c0b0;
        line-height: 1.4;
        border-radius: 3px;
        word-break: break-word;
        cursor: pointer;
      }
      .tlr-expand-line:hover { background: rgba(255,255,255,0.05); color: #e8e0d0; }

      .tn-prefix { color: #8a7e6a; font-size: 11px; flex-shrink: 0; margin-right: 2px; }
      .tn-line-content strong { color: #e8e0d0; }
      .tn-line-content em { opacity: 0.8; }
      .tn-line-content code { font-family: monospace; font-size: 11px; background: rgba(255,255,255,0.06); padding: 0 3px; border-radius: 3px; }
      .tn-seg-ref  { color: var(--color-primary-400,#c4b5fd); }
      .tn-seg-link { color: var(--color-primary-400,#c4b5fd); text-decoration: none; }
      .tn-seg-link:hover { text-decoration: underline; }
    `);
  }
}
