(() => {
  'use strict';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function findAllergenButton() {
    return document.querySelector('#allergenPdfBtn, [data-action="allergen-pdf"]') ||
      [...document.querySelectorAll('button, a')].find((element) =>
        element.textContent.trim().toLowerCase().includes('allergenenplan als pdf')
      );
  }

  function collectAllergenRows() {
    const selectors = [
      '#allergenRows tr',
      '#allergenenRows tr',
      '[data-allergen-row]',
      '.allergen-row',
      '.allergenen-row'
    ];

    const nodes = [...new Set(selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
    ))];

    return nodes.map((row) => {
      const cells = [...row.querySelectorAll('td, th, input, select, textarea')]
        .map((element) => {
          if (element.matches('input[type="checkbox"]')) {
            return element.checked ? 'Ja' : 'Nee';
          }
          return (element.value ?? element.textContent ?? '').trim();
        })
        .filter(Boolean);
      return cells;
    }).filter((cells) => cells.length);
  }

  function buildAllergenReport() {
    const rows = collectAllergenRows();
    const company = document.querySelector('[name="company_name"]')?.value || 'ANIMO HACCP';
    const site = document.querySelector('[name="site_name"]')?.value || '';
    const address = document.querySelector('[name="address"]')?.value || '';
    const generated = new Date().toLocaleString('nl-BE');

    const body = rows.length
      ? rows.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
      : '<tr><td>Geen allergenengegevens gevonden op deze pagina.</td></tr>';

    return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <title>Allergenenplan - ${escapeHtml(company)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#172334;margin:0;background:#eef2f6}
    .toolbar{position:sticky;top:0;padding:12px;text-align:center;background:#0d2d52}
    .toolbar button{border:0;border-radius:8px;padding:11px 16px;margin:0 4px;font-weight:700;cursor:pointer}
    .print{background:#00aa70;color:white}.paper{max-width:1000px;margin:20px auto;padding:30px;background:white}
    header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #00aa70}
    h1,h2{color:#0d2d52}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
    th,td{border:1px solid #cbd5df;padding:8px;text-align:left;vertical-align:top}
    th{background:#0d2d52;color:#fff}.meta{text-align:right}.note{margin-top:22px;color:#526273;font-size:11px}
    @page{size:A4 landscape;margin:12mm}
    @media print{body{background:white}.toolbar{display:none}.paper{margin:0;padding:0;max-width:none}tr{break-inside:avoid}}
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print" onclick="window.print()">Opslaan als PDF / Afdrukken</button>
    <button onclick="window.close()">Sluiten</button>
  </div>
  <main class="paper">
    <header>
      <div><h1>Allergenenplan</h1><p>ANIMO HACCP</p></div>
      <div class="meta"><strong>${escapeHtml(company)}</strong><br>${escapeHtml(site)}<br>${escapeHtml(address)}<br><small>${escapeHtml(generated)}</small></div>
    </header>
    <h2>Overzicht</h2>
    <table><tbody>${body}</tbody></table>
    <p class="note">Controleer het document voor gebruik en werk het bij wanneer producten, ingrediënten of bereidingswijzen wijzigen.</p>
  </main>
</body>
</html>`;
  }

  function openAllergenPdf(event) {
    event?.preventDefault();
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('Sta pop-ups toe voor deze website en probeer opnieuw.');
      return;
    }
    reportWindow.document.open();
    reportWindow.document.write(buildAllergenReport());
    reportWindow.document.close();
    reportWindow.focus();
  }

  function initialize() {
    const button = findAllergenButton();
    if (!button || button.dataset.pdfInitialized === 'true') return;
    button.type = 'button';
    button.dataset.pdfInitialized = 'true';
    button.addEventListener('click', openAllergenPdf);
  }

  document.addEventListener('DOMContentLoaded', initialize);
  new MutationObserver(initialize).observe(document.documentElement, { childList: true, subtree: true });
  window.openAllergenPdf = openAllergenPdf;
})();
