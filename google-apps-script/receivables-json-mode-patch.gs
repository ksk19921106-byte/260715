/**
 * OPS Portal JSON mode patch for the existing ICBANQ Receivables web app.
 *
 * Apply this to the receivables Apps Script:
 * 1. Replace the current doGet(e) with the doGet(e) below.
 * 2. Paste every helper function near the bottom of the script.
 * 3. Deploy a new web app version.
 *
 * HTML dashboard:
 *   /exec
 *
 * OPS JSON:
 *   /exec?mode=receivables
 */

function doGet(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || '').trim();

  if (mode === 'receivables') {
    return opsReceivablesJsonOutput_(opsBuildReceivablesPayload_());
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ICBANQ Receivables Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function opsReceivablesJsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function opsBuildReceivablesPayload_() {
  try {
    const overview = typeof getOverviewData === 'function' ? getOverviewData() : null;
    const sourceRecords = overview && Array.isArray(overview.records) ? overview.records : [];
    const records = sourceRecords
      .map((record, index) => opsNormalizeReceivableRecord_(record, index))
      .filter(record => record && record.name && record.expected > 0);

    const summary = opsBuildReceivablesSummary_(records, overview);

    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      source: 'ICBANQ Receivables Dashboard',
      summary,
      records,
      rawOverview: {
        meta: overview && overview.meta ? overview.meta : null,
        kpi: overview && overview.kpi ? overview.kpi : null,
        rateTrend: overview && overview.rateTrend ? overview.rateTrend : null,
        error: overview && overview.error ? overview.error : ''
      }
    };
  } catch (error) {
    return {
      ok: false,
      updatedAt: new Date().toISOString(),
      message: error && error.message ? error.message : String(error),
      records: []
    };
  }
}

function opsNormalizeReceivableRecord_(record, index) {
  const expected = opsNumber_(record.expected);
  const paid = opsNumber_(record.paid);
  const explicitDiff = opsNumberOrNull_(record.diff);
  const status = opsNormalizeReceivableStatus_(record.status);
  const diff = explicitDiff !== null ? Math.max(0, explicitDiff) : opsInferDiff_(expected, paid, status);
  const normalizedPaid = paid || Math.max(0, expected - diff);
  const sales = opsPickText_(record, ['sales', 'Sales', 'SALES', 'salesName', 'salesCode', 'owner', 'manager', 'rep', '담당자', '담당', '담당 Sales', '담당Sales', '담당자명', '영업담당', '영업', '담당 영업']);
  const fSales = opsPickText_(record, ['fSales', 'FSales', 'F Sales', 'FS', 'fsales', '상위담당', '팀장', 'FSales / ISales', 'FS / IS', 'FS/IS']);

  return {
    id: record.id || ('receivable-live-' + (index + 1)),
    team: String(record.team || '').trim(),
    sales,
    fSales,
    name: String(record.name || record.company || '').trim(),
    company: String(record.name || record.company || '').trim(),
    expected,
    expectedAmount: expected,
    paid: normalizedPaid,
    paidAmount: normalizedPaid,
    diff,
    unpaidAmount: diff,
    rate: opsNumber_(record.rate) || (expected > 0 ? Math.round((normalizedPaid / expected) * 1000) / 10 : 0),
    status,
    gubun: String(record.gubun || '').trim(),
    basis: String(record.basis || '').trim(),
    matched_payer: String(record.matched_payer || record.matchedPayer || '').trim(),
    collectionMonth: String(record.collectionMonth || record.month || '').trim(),
    dueDate: String(record.dueDate || record.expectedDate || record.date || '').trim(),
    overdueDays: opsNumber_(record.overdueDays),
    agingBucket: String(record.agingBucket || '').trim(),
    erpUrl: String(record.erpUrl || record.trackingUrl || record.orderUrl || record.poUrl || record.link || '').trim()
  };
}

function opsPickText_(record, keys) {
  for (const key of keys) {
    const value = record && record[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function opsBuildReceivablesSummary_(records, overview) {
  const totalExpected = records.reduce((sum, record) => sum + record.expected, 0);
  const completed = records.filter(record => record.status === '완료');
  const partial = records.filter(record => record.status === '부분수금');
  const unpaid = records.filter(record => record.status === '미수');
  const completedAmount = completed.reduce((sum, record) => sum + record.expected, 0);
  const unpaidAmount = records.reduce((sum, record) => sum + (record.status === '완료' ? 0 : record.diff), 0);
  const webAppRate = opsNumberOrNull_(overview && overview.kpi ? overview.kpi.rate : null);

  return {
    totalCount: records.length,
    totalExpected,
    completedCount: completed.length,
    completedAmount,
    partialCount: partial.length,
    partialAmount: partial.reduce((sum, record) => sum + record.diff, 0),
    unpaidCount: unpaid.length,
    unpaidAmount,
    collectionRate: webAppRate !== null ? opsNormalizePercent_(webAppRate) : (totalExpected > 0 ? Math.round((completedAmount / totalExpected) * 1000) / 10 : 0)
  };
}

function opsInferDiff_(expected, paid, status) {
  if (status === '완료') return 0;
  if (expected > 0 && paid > 0) return Math.max(0, expected - paid);
  return Math.max(0, expected);
}

function opsNormalizeReceivableStatus_(value) {
  const text = String(value || '').trim();
  if (text.indexOf('부분') >= 0) return '부분수금';
  if (text.indexOf('미수') >= 0) return '미수';
  if (text.indexOf('완료') >= 0 || text.indexOf('취소') >= 0 || text === 'O') return '완료';
  return '미수';
}

function opsNumber_(value) {
  const number = Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function opsNumberOrNull_(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = opsNumber_(value);
  return Number.isFinite(number) ? number : null;
}

function opsNormalizePercent_(value) {
  const number = opsNumber_(value);
  return number <= 1 ? Math.round(number * 1000) / 10 : Math.round(number * 10) / 10;
}
