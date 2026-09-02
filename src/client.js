// DSH Multi Tools browser half: dependency dashboard and managed-preset selector.
window.__ModuleLoader__.load({
  id: '@pirate-608/dsh-multi-tools',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useMemo, useState } = React;
    const NS = 'settings.dshMultiTools';
    const COPY = {
      zh: {
        tab: 'Multi Tools', title: 'DSH Multi Tools', intro: '选择新会话可用的独立 Preset，并检查本机依赖。此页面不会安装软件、下载模型或启动应用。',
        loading: '正在检查本机依赖…', error: '无法读取 Multi Tools 状态。', retry: '重试', live: '实时检查', refresh: '刷新',
        save: '保存选择', saving: '正在保存…', cancel: '取消', confirm: '确认移除', confirmHint: '以下受管 Preset 将从新会话列表移除；已运行会话不受影响：',
        core: '始终启用', enabled: '已启用', disabled: '未启用', unsupported: '当前平台不可用', personal: '个人构建',
        preset: 'Preset', runtime: '运行时', liveState: '实时状态', noLive: '尚未实时检查', changed: '有未保存的选择', saved: '选择已保存。',
      },
      en: {
        tab: 'Multi Tools', title: 'DSH Multi Tools', intro: 'Choose independent presets for new sessions and inspect local dependencies. This page never installs software, downloads models, or starts applications.',
        loading: 'Checking local dependencies…', error: 'Multi Tools status is unavailable.', retry: 'Retry', live: 'Live check', refresh: 'Refresh',
        save: 'Save selection', saving: 'Saving…', cancel: 'Cancel', confirm: 'Confirm removal', confirmHint: 'These managed presets will leave the new-session roster; running sessions are unchanged:',
        core: 'Always enabled', enabled: 'Enabled', disabled: 'Disabled', unsupported: 'Unavailable on this platform', personal: 'Personal build',
        preset: 'Preset', runtime: 'Runtime', liveState: 'Live status', noLive: 'Live status not checked', changed: 'Unsaved selection', saved: 'Selection saved.',
      },
    };
    const CSS = `
      .dmt_root{display:flex;flex-direction:column;gap:14px;max-width:880px;color:var(--dsw-alias-label-primary)}
      .dmt_head h3,.dmt_head p,.dmt_msg{margin:0}.dmt_head{display:flex;flex-direction:column;gap:4px}.dmt_head p,.dmt_msg{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
      .dmt_toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dmt_toolbar button,.dmt_actions button{height:30px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;padding:0 11px;cursor:pointer}.dmt_toolbar button:disabled,.dmt_actions button:disabled{opacity:.5;cursor:not-allowed}.dmt_primary{background:var(--dsw-alias-state-business-primary)!important;color:#fff!important;border-color:transparent!important}
      .dmt_grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px}.dmt_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:9px}.dmt_card[data-blocked=true]{border-color:color-mix(in srgb,var(--dsw-alias-state-warning-primary) 55%,var(--dsw-alias-border-l2))}
      .dmt_title{display:flex;align-items:center;gap:8px}.dmt_title strong{flex:1}.dmt_badge{font-size:11px;line-height:18px;padding:0 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}.dmt_badge[data-state=ready]{color:var(--dsw-alias-state-success-primary)}.dmt_badge[data-state=blocked],.dmt_badge[data-state=needs-setup]{color:var(--dsw-alias-state-warning-primary)}
      .dmt_toggle{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dsw-alias-label-secondary)}.dmt_facts{display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-tertiary)}.dmt_deps{display:flex;flex-direction:column;gap:5px;margin:0;padding:0;list-style:none}.dmt_dep{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary)}.dmt_dep b{font-weight:500;color:var(--dsw-alias-label-primary)}.dmt_dep code{display:block;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary);font-size:11px}
      .dmt_confirm{border:1px solid var(--dsw-alias-state-warning-primary);border-radius:9px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}.dmt_confirm p,.dmt_confirm ul{margin:0;font-size:12px}.dmt_actions{display:flex;gap:8px}
    `;

    function injectStyles() {
      if (document.querySelector('style[data-plugin-css="dsh-multi-tools"]')) return;
      const tag = document.createElement('style');
      tag.dataset.pluginCss = 'dsh-multi-tools';
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }
    const Json = { parse(v) { return v; } };
    const codec = (symbol) => ({ mode: 'strict', typeSymbol: symbol, schema: Json });
    const parameters = (optional) => [{ name: 'request', wire: 'request', source: 'json', codec: codec('dsh-multi-tools#request'), ...(optional ? { acceptsUndefined: true } : {}) }];
    const method = (name, optional) => ({
      id: 'dsh-multi-tools#multiTools/' + name,
      service: 'multiTools', namespace: 'multiTools', method: name,
      invocation: { kind: 'direct' }, parameters: parameters(optional),
      result: codec('dsh-multi-tools#' + name + 'Result'),
    });
    const REMOTE = { package: '@pirate-608/dsh-multi-tools', descriptors: [method('status', true), method('applySelection', false)] };
    async function unwrap(value) {
      const result = await value;
      if (result && typeof result === 'object' && 'ok' in result) {
        if (!result.ok) throw new Error(result.error?.message || result.error?.code || 'remote failed');
        return result.value;
      }
      return result;
    }

    function installModLensPasteBridge(ctx) {
      let routeAvailable = true;
      let verdicts = {};
      const maxAgeMs = 60000;
      function imageFilesOf(event) {
        const items = event.clipboardData?.items;
        if (!items) return [];
        const files = [];
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (item.kind !== 'file') continue;
          const file = item.getAsFile();
          if (file && /^image\//.test(file.type)) files.push(file);
        }
        return files;
      }
      function modelLabel() {
        for (const button of document.querySelectorAll('button[aria-label]')) {
          const label = button.getAttribute('aria-label') || '';
          if (/选择模型|select model|current model/i.test(label)) return label;
        }
        return '';
      }
      function refreshVerdict(label) {
        if (!routeAvailable || verdicts[label]?.pending) return;
        const previous = verdicts[label];
        const entry = { pending: true, takeover: previous?.takeover === true, at: previous?.at || 0 };
        verdicts[label] = entry;
        fetch(`/modlens/paste?model=${encodeURIComponent(label)}`).then(response => {
          if (response.status === 404) {
            routeAvailable = false; entry.pending = false; return null;
          }
          if (!response.ok) throw new Error(`policy ${response.status}`);
          return response.json();
        }).then(body => {
          entry.pending = false;
          if (body) { entry.takeover = body.takeover === true; entry.at = Date.now(); }
        }).catch(() => { entry.pending = false; });
      }
      function insertText(target, text) {
        const element = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') ? target : document.activeElement;
        if (!element || (element.tagName !== 'TEXTAREA' && element.tagName !== 'INPUT')) return;
        element.focus();
        let inserted = false;
        try { inserted = document.execCommand('insertText', false, text); } catch { inserted = false; }
        if (!inserted) {
          const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, element.value + text);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      async function upload(file) {
        const response = await fetch('/modlens/paste', { method: 'POST', body: await file.arrayBuffer() });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const error = new Error(body.error || `paste upload failed (${response.status})`);
          error.status = response.status;
          throw error;
        }
        return response.json();
      }
      function onFocus() { refreshVerdict(modelLabel()); }
      function onPaste(event) {
        if (!routeAvailable) return;
        const files = imageFilesOf(event);
        if (!files.length) return;
        const label = modelLabel();
        const verdict = verdicts[label];
        refreshVerdict(label);
        if (!verdict || verdict.takeover !== true || verdict.at === 0 || Date.now() - verdict.at > maxAgeMs) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = event.target;
        Promise.all(files.map(upload)).then(results => {
          const text = results.map(result => result.path).filter(Boolean).join(' ');
          if (text) insertText(target, `${text} `);
        }).catch(error => {
          if (error?.status === 404) { routeAvailable = false; verdicts = {}; }
          console.error(`[modlens] paste-to-private-reference failed: ${error?.message || error}`);
        });
      }
      document.addEventListener('focusin', onFocus, true);
      document.addEventListener('paste', onPaste, true);
      if (typeof ctx.effect === 'function') {
        ctx.effect(() => () => {
          document.removeEventListener('focusin', onFocus, true);
          document.removeEventListener('paste', onPaste, true);
        }, 'dsh-multi-tools: modlens paste bridge');
      }
    }

    const inject = ['slots', 'locale', 'remote'];
    async function apply(ctx) {
      injectStyles();
      installModLensPasteBridge(ctx);
      const remote = ctx.remote || ctx.get('remote');
      await remote.$mount(REMOTE);
      const locale = ctx.locale || ctx.get('locale');
      if (locale?.register) ctx.effect(() => locale.register(NS, COPY), 'dsh-multi-tools.locale');
      ctx.inject(['slots', 'locale', 'remote', 'remote.multiTools'], (scope) => {
        const api = scope.remote.multiTools;
        const t = scope.locale.bind(NS);
        scope.slots.inject('settings.plugins.tab', () => scope.slots.register({
          name: 'settings.plugins.tab', id: 'multi-tools', order: 30,
          label: () => t('tab'), locale: NS,
          inject: () => ({
            readStatus: (mode) => unwrap(api.status({ mode })),
            saveSelection: (enabled, expectedRevision) => unwrap(api.applySelection({ enabled, expectedRevision })),
          }),
        }, MultiToolsTab));
      });
    }

    function MultiToolsTab({ t, readStatus, saveSelection }) {
      const [state, setState] = useState({ kind: 'loading' });
      const [draft, setDraft] = useState([]);
      const [draftDirty, setDraftDirty] = useState(false);
      const [busy, setBusy] = useState(false);
      const [confirm, setConfirm] = useState(null);
      const [message, setMessage] = useState('');
      const load = (mode) => {
        setState({ kind: 'loading' }); setMessage('');
        Promise.resolve(readStatus(mode)).then(snapshot => {
          setState({ kind: 'ready', snapshot });
          if (!draftDirty) setDraft(snapshot.integrations.filter(x => x.id !== 'modlens' && x.configuredEnabled).map(x => x.id));
        }, error => setState({ kind: 'error', message: String(error?.message || error) }));
      };
      useEffect(() => { load('installed'); }, []);
      const snapshot = state.kind === 'ready' ? state.snapshot : null;
      const configured = useMemo(() => snapshot ? snapshot.integrations.filter(x => x.id !== 'modlens' && x.configuredEnabled).map(x => x.id).sort() : [], [snapshot]);
      const normalizedDraft = [...draft].sort();
      const dirty = JSON.stringify(configured) !== JSON.stringify(normalizedDraft);
      const toggle = (id) => {
        setDraftDirty(true);
        setDraft(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
      };
      const startSave = () => {
        const removals = configured.filter(id => !draft.includes(id));
        if (removals.length) { setConfirm(removals); return; }
        commit();
      };
      const commit = () => {
        setBusy(true); setConfirm(null); setMessage('');
        Promise.resolve(saveSelection(normalizedDraft, snapshot.revision)).then(next => {
          setState({ kind: 'ready', snapshot: next });
          setDraft(next.integrations.filter(x => x.id !== 'modlens' && x.configuredEnabled).map(x => x.id));
          setDraftDirty(false);
          setMessage(t('saved')); setBusy(false);
        }, error => { setMessage(String(error?.message || error)); setBusy(false); });
      };
      return h('div', { className: 'dmt_root' },
        h('div', { className: 'dmt_head' }, h('h3', null, t('title')), h('p', null, t('intro'))),
        h('div', { className: 'dmt_toolbar' },
          h('button', { type: 'button', disabled: busy, onClick: () => load('installed') }, t('refresh')),
          h('button', { type: 'button', disabled: busy, onClick: () => load('live') }, t('live')),
          h('button', { type: 'button', className: 'dmt_primary', disabled: busy || !dirty || !snapshot, onClick: startSave }, busy ? t('saving') : t('save')),
          dirty ? h('span', { className: 'dmt_msg' }, t('changed')) : null,
        ),
        message ? h('p', { className: 'dmt_msg', role: 'status' }, message) : null,
        state.kind === 'loading' ? h('p', { className: 'dmt_msg' }, t('loading')) : null,
        state.kind === 'error' ? h('div', { className: 'dmt_msg', role: 'alert' }, state.message, ' ', h('button', { onClick: () => load('installed') }, t('retry'))) : null,
        confirm ? h('div', { className: 'dmt_confirm' },
          h('p', null, t('confirmHint')), h('ul', null, confirm.map(id => h('li', { key: id }, id))),
          h('div', { className: 'dmt_actions' }, h('button', { className: 'dmt_primary', onClick: commit }, t('confirm')), h('button', { onClick: () => setConfirm(null) }, t('cancel'))),
        ) : null,
        snapshot ? h('div', { className: 'dmt_grid' }, snapshot.integrations.map(item => h(IntegrationCard, { key: item.id, item, checked: item.id === 'modlens' || draft.includes(item.id), toggle, t }))) : null,
      );
    }

    function IntegrationCard({ item, checked, toggle, t }) {
      const unsupported = item.availability === 'unsupported-platform';
      const deps = [...item.runtime, ...item.live];
      return h('article', { className: 'dmt_card', 'data-blocked': item.overall === 'blocked' || item.overall === 'needs-setup' },
        h('div', { className: 'dmt_title' }, h('strong', null, item.id), h('span', { className: 'dmt_badge', 'data-state': item.overall }, item.overall)),
        item.id === 'modlens'
          ? h('span', { className: 'dmt_toggle' }, t('core'))
          : h('label', { className: 'dmt_toggle' }, h('input', { type: 'checkbox', checked, disabled: unsupported && !checked, onChange: () => toggle(item.id) }), unsupported ? t('unsupported') : checked ? t('enabled') : t('disabled')),
        h('div', { className: 'dmt_facts' }, h('span', null, t('preset'), ': ', item.preset), item.redistribution === 'personal-only' ? h('span', null, t('personal')) : null),
        h('ul', { className: 'dmt_deps' }, deps.map(dep => h('li', { className: 'dmt_dep', key: dep.id }, h('b', null, dep.label, ' · ', dep.state), ': ', dep.summary, dep.remediation ? h(dep.remediation.kind === 'command' ? 'code' : 'span', null, dep.remediation.text) : null))),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
