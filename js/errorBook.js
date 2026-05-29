const ErrorBook = (() => {
  let sortBy = 'lastErrorTime';
  let order = 'desc';

  function formatErrorCount(count) {
    if (count <= 3) {
      return '<span class="error-dots">' + '●'.repeat(count) + '</span>';
    }
    return '<span class="error-number">' + count + '</span>';
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function init() {
    document.querySelectorAll('#errorbook-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (sortBy === col) {
          order = order === 'asc' ? 'desc' : 'asc';
        } else {
          sortBy = col;
          order = 'desc';
        }
        render();
      });
    });

    document.getElementById('errorbook-clear').addEventListener('click', async () => {
      if (confirm('确认清空所有生词？')) {
        await DB.clearErrorBook();
        render();
      }
    });

    document.getElementById('errorbook-export').addEventListener('click', exportPDF);
  }

  async function render() {
    const data = await DB.getErrorBook(sortBy, order);
    document.getElementById('errorbook-export').disabled = data.length === 0;
    const tbody = document.getElementById('errorbook-tbody');
    const empty = document.getElementById('errorbook-empty');

    document.querySelectorAll('#errorbook-table th[data-sort] .table__sort-icon').forEach(el => {
      el.textContent = '';
    });
    const activeTh = document.querySelector(`#errorbook-table th[data-sort="${sortBy}"] .table__sort-icon`);
    if (activeTh) {
      activeTh.textContent = order === 'asc' ? '▲' : '▼';
    }

    if (data.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = data.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.word}</td>
        <td>${item.definitions.join('；')}</td>
        <td>${item.module || '-'}</td>
        <td>${formatErrorCount(item.errorCount)}</td>
        <td>${formatTime(item.lastErrorTime)}</td>
      </tr>
    `).join('');
  }

  async function exportPDF() {
    const data = await DB.getErrorBook(sortBy, order);
    if (data.length === 0) return;

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '700px';
    container.style.fontFamily = '"Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    container.style.fontSize = '12px';
    container.style.color = '#333';
    container.style.background = '#fff';
    container.style.padding = '16px';

    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    let html = '<h2 style="margin-bottom:12px">生词本</h2>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<thead><tr style="background:#9B7ED8;color:#fff">';
    html += '<th style="padding:8px;border:1px solid #ddd">#</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">单词</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">释义</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">来源模块</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">错误次数</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">最后错误时间</th>';
    html += '</tr></thead><tbody>';

    data.forEach((item, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f5f2fc';
      html += '<tr style="background:' + bg + '">';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (i + 1) + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold">' + item.word + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + item.definitions.join('；') + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (item.module || '-') + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd;text-align:center">' + item.errorCount + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + formatTime(item.lastErrorTime) + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2 });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;
      const imgData = canvas.toDataURL('image/png');

      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = margin - (imgHeight - (pageHeight - margin * 2));
        doc.addPage();
        doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      doc.save('生词本_' + dateStr + '.pdf');
    } finally {
      document.body.removeChild(container);
    }
  }

  return { init, render };
})();
