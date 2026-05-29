const Vocabulary = (() => {

  function parseWordFile(jsonText, moduleName) {
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      return { success: false, error: '文件格式错误，请上传 JSON 文件', words: [], skipped: 0 };
    }
    if (!Array.isArray(data)) {
      return { success: false, error: 'JSON 文件内容必须是一个数组', words: [], skipped: 0 };
    }
    if (data.length === 0) {
      return { success: false, error: '词库文件无数据', words: [], skipped: 0 };
    }

    const words = [];
    let skipped = 0;

    for (const item of data) {
      if (!item.word || typeof item.word !== 'string') { skipped++; continue; }
      if (!Array.isArray(item.definition) || item.definition.length === 0) { skipped++; continue; }
      words.push({
        word: item.word.trim(),
        definitions: item.definition.map(d => String(d).trim()),
        module: moduleName
      });
    }

    if (words.length === 0) {
      return { success: false, error: '文件中没有合法的单词记录', words: [], skipped };
    }

    return { success: true, words, skipped, total: data.length };
  }

  async function importWords(file) {
    const moduleName = file.name.replace(/\.json$/i, '');
    const text = await file.text();
    const result = parseWordFile(text, moduleName);

    if (!result.success) {
      return result;
    }

    await DB.open();
    await DB.clearVocabulary(moduleName);
    await DB.removeModule(moduleName);
    await DB.addWords(result.words);
    await DB.addModule(moduleName);

    return result;
  }

  return { parseWordFile, importWords };
})();
