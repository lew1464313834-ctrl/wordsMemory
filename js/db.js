const DB = (() => {
  const DB_NAME = 'wordmemory';
  const DB_VERSION = 1;

  let _db = null;

  async function open() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('vocabulary')) {
          const store = db.createObjectStore('vocabulary', { keyPath: 'id', autoIncrement: true });
          store.createIndex('module', 'module', { unique: false });
        }
        if (!db.objectStoreNames.contains('errorBook')) {
          db.createObjectStore('errorBook', { keyPath: 'word' });
        }
        if (!db.objectStoreNames.contains('modules')) {
          db.createObjectStore('modules', { keyPath: 'name' });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(storeName, mode) {
    return _db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // --- vocabulary ---

  async function clearVocabulary(moduleName) {
    return new Promise((resolve, reject) => {
      const store = tx('vocabulary', 'readwrite');
      const index = store.index('module');
      const cursorReq = index.openCursor(IDBKeyRange.only(moduleName));
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = (e) => reject(e.target.error);
    });
  }

  async function addWords(words) {
    const store = tx('vocabulary', 'readwrite');
    await Promise.all(words.map(w => promisify(store.add(w))));
  }

  async function getVocabulary(moduleName) {
    const store = tx('vocabulary', 'readonly');
    const index = store.index('module');
    return promisify(index.getAll(moduleName));
  }

  async function getAllWords() {
    const store = tx('vocabulary', 'readonly');
    return promisify(store.getAll());
  }

  async function getVocabularyCount(moduleName) {
    const store = tx('vocabulary', 'readonly');
    const index = store.index('module');
    return promisify(index.count(moduleName));
  }

  async function getTotalWordCount() {
    const store = tx('vocabulary', 'readonly');
    return promisify(store.count());
  }

  // --- modules ---

  async function getModules() {
    const store = tx('modules', 'readonly');
    return promisify(store.getAll());
  }

  async function addModule(name, source = 'imported') {
    const store = tx('modules', 'readwrite');
    return promisify(store.put({ name, source, importedAt: Date.now() }));
  }

  async function removeModule(name) {
    const store = tx('modules', 'readwrite');
    return promisify(store.delete(name));
  }

  // --- errorBook ---

  async function upsertErrorWord(word, definitions, moduleName) {
    // Read existing in a separate readonly transaction
    let existing;
    try {
      existing = await promisify(tx('errorBook', 'readonly').get(word));
    } catch (e) {
      existing = undefined;
    }

    // Write in a new readwrite transaction
    if (existing) {
      existing.errorCount += 1;
      existing.lastErrorTime = Date.now();
      return promisify(tx('errorBook', 'readwrite').put(existing));
    }
    return promisify(tx('errorBook', 'readwrite').put({
      word,
      definitions,
      module: moduleName,
      errorCount: 1,
      lastErrorTime: Date.now()
    }));
  }

  async function decrementOrRemoveErrorWord(word) {
    const existing = await promisify(tx('errorBook', 'readonly').get(word));
    if (!existing) return;
    if (existing.errorCount <= 1) {
      return promisify(tx('errorBook', 'readwrite').delete(word));
    }
    existing.errorCount -= 1;
    return promisify(tx('errorBook', 'readwrite').put(existing));
  }

  async function getErrorBook(sortBy, order) {
    const store = tx('errorBook', 'readonly');
    const all = await promisify(store.getAll());
    const dir = order === 'asc' ? 1 : -1;
    all.sort((a, b) => {
      if (sortBy === 'errorCount') return (a.errorCount - b.errorCount) * dir;
      return (a.lastErrorTime - b.lastErrorTime) * dir;
    });
    return all;
  }

  async function clearErrorBook() {
    const store = tx('errorBook', 'readwrite');
    return promisify(store.clear());
  }

  return {
    open,
    addWords, clearVocabulary, getVocabulary, getAllWords, getVocabularyCount, getTotalWordCount,
    getModules, addModule, removeModule,
    upsertErrorWord, decrementOrRemoveErrorWord, getErrorBook, clearErrorBook
  };
})();
