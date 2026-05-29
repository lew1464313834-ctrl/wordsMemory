const App = (() => {
  let currentTab = 'memory';

  async function loadBuiltinModules() {
    let manifest;
    try {
      const resp = await fetch('data/modules.json');
      if (!resp.ok) {
        console.warn(`内置词库清单加载失败: HTTP ${resp.status}`);
        return;
      }
      manifest = await resp.json();
    } catch (err) {
      console.warn('内置词库清单加载异常:', err);
      return;
    }

    if (!Array.isArray(manifest)) return;

    const modules = await DB.getModules();
    const existingNames = new Set(modules.map(m => m.name));

    for (const entry of manifest) {
      if (!entry.file || !entry.name) continue;
      if (existingNames.has(entry.name)) continue;

      try {
        const resp = await fetch(`data/${entry.file}`);
        if (!resp.ok) {
          console.warn(`内置词库 "${entry.name}" 加载失败: HTTP ${resp.status}`);
          continue;
        }
        const text = await resp.text();
        const result = Vocabulary.parseWordFile(text, entry.name);
        if (!result.success) {
          console.warn(`内置词库 "${entry.name}" 解析失败: ${result.error}`);
          continue;
        }
        await DB.addWords(result.words);
        await DB.addModule(entry.name, 'builtin');
      } catch (err) {
        console.warn(`内置词库 "${entry.name}" 加载异常:`, err);
      }
    }
  }

  async function init() {
    try {
      await DB.open();
      await loadBuiltinModules();
      bindTabs();
      bindUpload();
      await refreshModuleList();
      Memory.init();
      Quiz.init();
      ErrorBook.init();
    } catch (err) {
      document.body.innerHTML = '<div class="empty">浏览器不支持 IndexedDB，请使用现代浏览器打开</div>';
      console.error('IndexedDB init failed:', err);
    }
  }

  function bindTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        switchTab(tabName);
      });
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('tab--active', b.dataset.tab === name));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('tab-content--hidden', c.id !== 'tab-' + name));
    currentTab = name;
    if (name === 'errorbook') ErrorBook.render();
    if (name === 'quiz') Quiz.refreshState();
  }

  function bindUpload() {
    const input = document.getElementById('upload-input');
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('upload-status');
      status.textContent = '导入中...';
      try {
        const result = await Vocabulary.importWords(file);
        if (result.success) {
          let msg = `成功导入 ${result.words.length} 个单词 (${result.total} 条中跳过 ${result.skipped} 条)`;
          status.textContent = msg;
        } else {
          status.textContent = result.error;
        }
        refreshModuleList();
        e.target.value = '';
      } catch (err) {
        status.textContent = '导入失败: ' + err.message;
      }
    });
  }

  async function refreshModuleList() {
    const modules = await DB.getModules();
    const el = document.getElementById('module-list');
    if (modules.length === 0) {
      el.innerHTML = '<span>暂无词库，请上传 JSON 文件</span>';
    } else {
      const names = modules.map(m => m.name).join('、');
      el.innerHTML = '<span>已导入词库: ' + names + '</span>';
    }
    if (Memory.refreshModuleSelect) await Memory.refreshModuleSelect();
    if (Quiz.refreshState) await Quiz.refreshState();
  }

  return { init, switchTab, refreshModuleList };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
