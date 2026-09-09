/**
 * ICBANQ Receivables 수금현황 대시보드 v7
 * Google Apps Script - 서버 로직
 *
 * [수금률 계산 기준 - 확정]
 * 수금완료 금액 = 완료건 예정금액 합 + 부분수금 실입금액(paid) 합
 * 수금률       = 수금완료 금액 / 전체 예정금액
 * 미수 금액    = 전체 예정금액 - 수금완료 금액
 *
 * [매핑 3단계]
 * STEP 1: 미수금_리스트 파싱 (D열 O = 기완료)
 * STEP 2: 수금_원본 매핑 (별칭DB → 이름유사도 0.85+ → 이름+금액)
 * STEP 3: 미매핑건 AR_원본 대조 (있음=미수 / 없음=완료)
 */

// ════════════════════════════════════════════
// 0. 설정
// ════════════════════════════════════════════
const CFG = {
  SHEET_MISUGEUM:  '미수금_리스트',
  SHEET_AR:        'AR_원본',
  SHEET_SUGEUN:    '수금_원본',
  SHEET_ORDER:     '주문트래킹',
  SHEET_SALES_DB:  '담당자_DB',
  SHEET_OUTPUT:    '현재_수금데이터',
  SHEET_NEW_MATCH: '신규매칭_검증',
  SHEET_CARRYOVER: '이월_확인',
  SHEET_CHART:     '그래프_데이터',
  SHEET_COMMENT:   '댓글',
  SHEET_ALIAS:     '별칭_DB',
  SHEET_BLACKLIST: '매칭_제외',

  NAME_HIGH_THRESHOLD:  0.85,
  NAME_LOW_THRESHOLD:   0.70,
  AUTO_LEARN_THRESHOLD: 0.95,
  AMOUNT_TOLERANCE:     0.01,
  HIGH_AMOUNT:          10000000,
  RATE_BASE:            63.8,
};

// ════════════════════════════════════════════
// 1. 웹앱 진입점
// ════════════════════════════════════════════
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💰 수금 매핑 v7')
    .addItem('▶ 매핑 실행 (3단계)', 'runMapping')
    .addSeparator()
    .addItem('👤 담당자 미매칭 현황', 'showUnmatchedSales')
    .addItem('📥 담당자 학습 저장', 'learnSalesFromUnmatched')
    .addSeparator()
    .addItem('🧠 매칭 사전 보기', 'showAliasStats')
    .addItem('🚫 블랙리스트 보기', 'showBlacklistStats')
    .addSeparator()
    .addItem('📊 결과 요약 보기', 'showSummary')
    .addItem('🔧 시트 진단', 'diagnoseSheets')
    .addToUi();
}

// ════════════════════════════════════════════
// 2. 유틸 함수
// ════════════════════════════════════════════
function findSheet(ss, names) {
  for (const name of names) {
    const s = ss.getSheetByName(name);
    if (s) return s;
  }
  return null;
}

function parseNumber(value) {
  if (!value) return 0;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function normName(s) {
  if (!s) return '';
  return String(s)
    .replace(/[（）]/g, m => m === '（' ? '(' : ')')
    .replace(/[　]/g, ' ')
    .replace(/-\d+$/, '')
    .replace(/주식회사|㈜|\(주\)|\(유\)|유한회사|\(재\)|\(사\)|\(합\)/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s\-\.\,&_/]/g, '')
    .toLowerCase().trim();
}

function levenshteinRatio(a, b) {
  if (!a.length) return b.length ? 0 : 1;
  if (!b.length) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  return 1 - dp[m][n] / Math.max(m, n);
}

function similarityScore(a, b) {
  const na = normName(a), nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  const shorter = na.length <= nb.length ? na : nb;
  const longer  = na.length <= nb.length ? nb : na;
  if (shorter.length >= 2 && longer.indexOf(shorter) >= 0) {
    const r = shorter.length / longer.length;
    if (r >= 0.7) return 0.95;
    if (r >= 0.5) return 0.90;
    if (r >= 0.3) return 0.85;
    return 0.80;
  }
  if (shorter.length >= 3 && longer.startsWith(shorter)) return 0.92;
  return levenshteinRatio(na, nb);
}

// 공통 접미사 제거 후 매칭 (테크, 일렉트로닉스 등 노이즈 제거)
const COMMON_WORDS = [
  '일렉트로닉스','일렉트로닉','일렉트로','일렉',
  '테크놀로지스','테크놀로지','테크노','테크',
  '코퍼레이션','컴퍼니','컴포넌트','컴포',
  '트레이딩','인더스트리','솔루션','솔류션',
  '시스템즈','시스템','엔지니어링','엔지니어',
  '홀딩스','그룹','상사','전자','반도체',
  '주식회사','유한회사',
  'electronics','technology','corporation','company','trading'
];

function stripCommonWords(s) {
  let r = s;
  for (const w of COMMON_WORDS) r = r.split(w).join('');
  return r.trim();
}

function smartMatch(masterName, payerName) {
  const nm = normName(masterName);
  const np = normName(payerName);
  if (!nm || !np) return 0;
  if (nm === np) return 1.0;

  const cm = stripCommonWords(nm);
  const cp = stripCommonWords(np);
  if (cm.length < 2 || cp.length < 2) return 0;
  if (cm === cp) return 1.0;

  const shorter = cm.length <= cp.length ? cm : cp;
  const longer  = cm.length <= cp.length ? cp : cm;

  if (shorter.length >= 3 && longer.indexOf(shorter) >= 0) {
    const r = shorter.length / longer.length;
    if (r >= 0.7) return 0.95;
    if (r >= 0.5) return 0.90;
    if (r >= 0.4) return 0.85;
    return 0;
  }
  if (cm.length >= 3 && cp.length >= 3) {
    if (cp.indexOf(cm.substring(0, 3)) >= 0) return 0.90;
    if (cm.indexOf(cp.substring(0, 3)) >= 0) return 0.88;
  }
  return 0;
}

function extractCandidates(name) {
  if (!name) return [];
  const s = String(name).replace(/[（）]/g, m => m === '（' ? '(' : ')').replace(/　/g, ' ');
  const cands = [s];
  const m1 = s.match(/\(([^)]+)\)/);
  if (m1) cands.push(m1[1]);
  const m2 = s.match(/\(([^)]*)$/);
  if (m2 && m2[1].length >= 2) cands.push(m2[1]);
  const noParen = s.replace(/\([^)]*\)?/g, '').trim();
  if (noParen && noParen !== s) cands.push(noParen);
  return cands.filter(c => c);
}

function emptyKpi() {
  return {
    analyzed_count: 0, analyzed_amt: 0,
    completed_count: 0, completed_amt: 0,
    unpaid_count: 0, unpaid_amt: 0,
    partial_count: 0, new_matched_count: 0, new_matched_amt: 0,
    removed_count: 0, removed_amt: 0,
    original_o_count: 0, rate: 0, rate_base: CFG.RATE_BASE,
  };
}

function emptyAging() {
  return {
    '7일이내':  { count: 0, amount: 0 },
    '14일이내': { count: 0, amount: 0 },
    '21일이내': { count: 0, amount: 0 },
    '30일이내': { count: 0, amount: 0 },
    '30일초과': { count: 0, amount: 0 },
  };
}

// ════════════════════════════════════════════
// 3. 별칭 DB / 블랙리스트
// ════════════════════════════════════════════
function getAliasSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(CFG.SHEET_ALIAS);
  if (!s) {
    s = ss.insertSheet(CFG.SHEET_ALIAS);
    s.getRange(1,1,1,5).setValues([['거래처명','입금주명_패턴','확정일','확정자','학습방식']]);
    s.getRange(1,1,1,5).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#fff');
    s.setFrozenRows(1);
  }
  return s;
}

function getBlacklistSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(CFG.SHEET_BLACKLIST);
  if (!s) {
    s = ss.insertSheet(CFG.SHEET_BLACKLIST);
    s.getRange(1,1,1,4).setValues([['거래처명','제외할_입금주명','제외일','제외자']]);
    s.getRange(1,1,1,4).setFontWeight('bold').setBackground('#dc2626').setFontColor('#fff');
    s.setFrozenRows(1);
  }
  return s;
}

function loadAliases() {
  const data = getAliasSheet().getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const company = String(data[i][0]||'').trim();
    const pattern = String(data[i][1]||'').trim();
    if (!company || !pattern) continue;
    if (!map[company]) map[company] = new Set();
    map[company].add(pattern);
    map[company].add(normName(pattern));
  }
  return map;
}

function loadBlacklist() {
  const data = getBlacklistSheet().getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const company = String(data[i][0]||'').trim();
    const pattern = String(data[i][1]||'').trim();
    if (!company || !pattern) continue;
    if (!map[company]) map[company] = new Set();
    map[company].add(normName(pattern));
  }
  return map;
}

function matchByAlias(company, payerName, aliasMap) {
  if (!aliasMap[company]) return false;
  return aliasMap[company].has(payerName) || aliasMap[company].has(normName(payerName));
}

function isBlacklisted(company, payerName, blacklistMap) {
  if (!blacklistMap[company]) return false;
  return blacklistMap[company].has(normName(payerName));
}

function addAlias(company, pattern, writer, method) {
  try {
    const s = getAliasSheet();
    const data = s.getDataRange().getValues();
    const normP = normName(pattern);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === company && normName(data[i][1]) === normP)
        return { success: true, skipped: true };
    }
    s.appendRow([company, pattern, new Date(), writer||'시스템', method||'수동']);
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function addBlacklist(company, pattern, writer) {
  try {
    const s = getBlacklistSheet();
    const data = s.getDataRange().getValues();
    const normP = normName(pattern);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === company && normName(data[i][1]) === normP)
        return { success: true, skipped: true };
    }
    s.appendRow([company, pattern, new Date(), writer||'시스템']);
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function removeAlias(company, pattern) {
  try {
    const s = getAliasSheet();
    const data = s.getDataRange().getValues();
    const normP = normName(pattern);
    for (let i = data.length-1; i >= 1; i--) {
      if (String(data[i][0]).trim() === company && normName(data[i][1]) === normP) {
        s.deleteRow(i+1);
        return { success: true };
      }
    }
    return { success: false, error: '찾을 수 없음' };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function getAliasesForWeb() {
  try {
    const data = getAliasSheet().getDataRange().getValues();
    const groups = {};
    let total = 0;
    for (let i = 1; i < data.length; i++) {
      const company = String(data[i][0]||'').trim();
      if (!company) continue;
      const pattern = String(data[i][1]||'').trim();
      const date    = data[i][2];
      const writer  = String(data[i][3]||'');
      const method  = String(data[i][4]||'');
      if (!groups[company]) groups[company] = [];
      groups[company].push({
        pattern, writer, method,
        date: date instanceof Date
          ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
          : String(date||'')
      });
      total++;
    }
    const sorted = Object.entries(groups)
      .map(([k,v]) => ({ company: k, patterns: v, count: v.length }))
      .sort((a,b) => b.count - a.count);
    return { total, companies: sorted.length, groups: sorted };
  } catch(e) { return { total:0, companies:0, groups:[], error: e.toString() }; }
}

function showAliasStats() {
  const d = getAliasesForWeb();
  let msg = '🧠 매칭 사전 현황\n\n총 학습 별칭: ' + d.total + '건\n학습된 거래처: ' + d.companies + '개\n\n';
  if (d.groups.length) {
    msg += 'TOP 5:\n';
    d.groups.slice(0,5).forEach(g => { msg += '  ' + g.company + ' (' + g.count + '개)\n'; });
  } else {
    msg += '아직 학습된 별칭이 없습니다.';
  }
  SpreadsheetApp.getUi().alert(msg);
}

function showBlacklistStats() {
  const data = getBlacklistSheet().getDataRange().getValues();
  let msg = '🚫 블랙리스트 현황\n\n총 제외 항목: ' + (data.length-1) + '건\n\n';
  if (data.length > 1) {
    msg += '최근 등록:\n';
    for (let i = Math.max(1, data.length-5); i < data.length; i++)
      msg += '  ' + data[i][0] + ' ↮ ' + data[i][1] + '\n';
  } else { msg += '아직 제외 항목이 없습니다.'; }
  SpreadsheetApp.getUi().alert(msg);
}

// ════════════════════════════════════════════
// 4. 메인 매핑 실행
// ════════════════════════════════════════════
function runMapping() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const t0 = new Date();

  const sheetMisu   = ss.getSheetByName(CFG.SHEET_MISUGEUM);
  const sheetAR     = ss.getSheetByName(CFG.SHEET_AR);
  const sheetSugeun = ss.getSheetByName(CFG.SHEET_SUGEUN);
  const missing = [
    !sheetMisu   ? '미수금_리스트' : null,
    !sheetAR     ? 'AR_원본'      : null,
    !sheetSugeun ? '수금_원본'    : null,
  ].filter(Boolean).join(', ');
  if (missing) { ui.alert('❌ 시트 없음: ' + missing); return; }

  let sheetOut = ss.getSheetByName(CFG.SHEET_OUTPUT);
  if (!sheetOut) sheetOut = ss.insertSheet(CFG.SHEET_OUTPUT);

  // STEP 1: 미수금_리스트 파싱
  const misuRows = sheetMisu.getDataRange().getValues().slice(1)
    .filter(r => r[1] && r[2])
    .map((r, idx) => ({
      rowNum:   idx + 2,
      team:     String(r[0]||'').trim(),
      name:     String(r[1]).trim(),
      expected: parseNumber(r[2]),
      yn:       String(r[3]||'').trim(),
    }));

  const alreadyDone = misuRows.filter(r => ['O','o','○'].includes(r.yn));
  const needsCheck  = misuRows.filter(r => !['O','o','○'].includes(r.yn));
  Logger.log('STEP1: 전체 ' + misuRows.length + '건 / 기완료 ' + alreadyDone.length + '건 / 체크필요 ' + needsCheck.length + '건');

  // STEP 2: 수금_원본 파싱
  const sgData   = sheetSugeun.getDataRange().getValues();
  const sgHead   = sgData[0].map(v => String(v||'').trim().toUpperCase());
  const hasHead  = sgHead.some(h => ['IDX','금액','비고','AMOUNT','입금일자'].includes(h));
  let colAmt     = sgHead.findIndex(h => h.includes('금액') || h === 'AMOUNT');
  let colPayer   = sgHead.findIndex(h => h.includes('비고') || h.includes('입금주명') || h.includes('REMARK'));
  if (!hasHead)  { colAmt = 1; colPayer = 0; }
  if (colAmt   < 0) colAmt   = 4;
  if (colPayer < 0) colPayer = 5;

  const payRows = [];
  for (let i = hasHead ? 1 : 0; i < sgData.length; i++) {
    const payer = String(sgData[i][colPayer]||'').replace(/-\d+$/, '').trim();
    const amt   = parseNumber(sgData[i][colAmt]);
    if (payer && amt > 0) payRows.push({ payer, amt });
  }
  Logger.log('STEP2: 수금_원본 ' + payRows.length + '건');

  const aliasMap     = loadAliases();
  const blacklistMap = loadBlacklist();
  const sgMatched    = [];
  const sgUnmatched  = [];

  for (const rec of needsCheck) {
    let matched = false;

    // 0차: 별칭DB
    for (const p of payRows) {
      if (isBlacklisted(rec.name, p.payer, blacklistMap)) continue;
      if (matchByAlias(rec.name, p.payer, aliasMap)) {
        rec.matchedPayer = p.payer; rec.matchedAmt = p.amt;
        rec.matchedBy = '별칭DB'; rec.matchedScore = 1.0;
        matched = true; break;
      }
    }
    if (matched) { sgMatched.push(rec); continue; }

    // 1차: 이름 유사도 0.85+
    const nm1 = payRows
      .filter(p => !isBlacklisted(rec.name, p.payer, blacklistMap))
      .map(p => ({ ...p, score: smartMatch(rec.name, p.payer) }))
      .filter(p => p.score >= CFG.NAME_HIGH_THRESHOLD)
      .sort((a,b) => b.score - a.score);
    if (nm1.length) {
      const best = nm1[0];
      rec.matchedPayer = best.payer;
      rec.matchedAmt   = nm1.reduce((s,m) => s + m.amt, 0);
      rec.matchedBy    = '이름'; rec.matchedScore = best.score;
      if (best.score >= CFG.AUTO_LEARN_THRESHOLD)
        addAlias(rec.name, best.payer, '자동학습', '자동(' + best.score.toFixed(2) + ')');
      sgMatched.push(rec); continue;
    }

    // 2차: 이름 0.70~0.85 + 금액 ±1%
    const nm2 = payRows
      .filter(p => !isBlacklisted(rec.name, p.payer, blacklistMap))
      .map(p => ({ ...p, score: smartMatch(rec.name, p.payer) }))
      .filter(p => p.score >= CFG.NAME_LOW_THRESHOLD && p.score < CFG.NAME_HIGH_THRESHOLD &&
                   Math.abs(p.amt - rec.expected) <= Math.max(rec.expected * CFG.AMOUNT_TOLERANCE, 100))
      .sort((a,b) => b.score - a.score);
    if (nm2.length) {
      const best = nm2[0];
      rec.matchedPayer = best.payer; rec.matchedAmt = best.amt;
      rec.matchedBy = '이름+금액'; rec.matchedScore = best.score;
      sgMatched.push(rec); continue;
    }

    sgUnmatched.push(rec);
  }
  Logger.log('STEP2 결과: 매핑 ' + sgMatched.length + '건 / 미매핑 ' + sgUnmatched.length + '건');

  // STEP 3: AR_원본 대조
  const arData = sheetAR.getDataRange().getValues();
  const arHead = arData[0].map(h => String(h).trim().toUpperCase());
  let arCol = arHead.findIndex(h => h.includes('COMPANY') || h.includes('업체명') || h.includes('거래처'));
  if (arCol < 0) arCol = 0;
  const arStart = arCol > 0 ? 1 : 0;

  const arSet     = new Set();
  const arNormSet = new Set();
  for (let i = arStart; i < arData.length; i++) {
    const n = String(arData[i][arCol]||'').trim();
    if (n) { arSet.add(n); arNormSet.add(normName(n)); }
  }
  Logger.log('STEP3: AR_원본 ' + arSet.size + '개');

  const arUnpaid    = [];
  const arCompleted = [];
  for (const rec of sgUnmatched) {
    if (arSet.has(rec.name) || arNormSet.has(normName(rec.name)))
      arUnpaid.push(rec);
    else
      arCompleted.push(rec);
  }
  Logger.log('STEP3 결과: AR미수 ' + arUnpaid.length + '건 / AR완료 ' + arCompleted.length + '건');

  // STEP 4: 결과 집계 → 현재_수금데이터
  const rows = [];

  // 기완료 (D열 O)
  for (const r of alreadyDone)
    rows.push([r.team, r.name, r.expected, r.expected, 0, 1.0, '완료', '기존완료', '']);

  // 수금_원본 매핑
  for (const r of sgMatched) {
    const paid  = Math.min(r.matchedAmt || r.expected, r.expected);
    const diff  = Math.max(r.expected - paid, 0);
    const ratio = r.expected > 0 ? paid / r.expected : 1;
    const status = ratio >= 0.9 ? '완료' : '부분수금';
    rows.push([r.team, r.name, r.expected, paid, diff, ratio, status, '신규매칭',
               (r.matchedPayer||'') + ' (' + (r.matchedBy||'') + ')']);
    if (status === '완료')
      try { sheetMisu.getRange(r.rowNum, 4).setValue('O'); } catch(e) {}
  }

  // AR없음 → 완료
  for (const r of arCompleted) {
    rows.push([r.team, r.name, r.expected, r.expected, 0, 1.0, '완료', 'AR완료', 'AR_원본에 없음']);
    try { sheetMisu.getRange(r.rowNum, 4).setValue('O'); } catch(e) {}
  }

  // 진짜 미수
  for (const r of arUnpaid)
    rows.push([r.team, r.name, r.expected, 0, r.expected, 0, '미수', '',
               r.expected >= CFG.HIGH_AMOUNT ? '고액미수' : '']);

  // 정렬
  const statusOrd = {'미수':0,'부분수금':1,'완료':2};
  const teamOrd   = {'B2D':0,'S1':1,'S2':2,'S3':3};
  rows.sort((a,b) => {
    const so = (statusOrd[a[6]]??9) - (statusOrd[b[6]]??9);
    return so !== 0 ? so : (teamOrd[a[0]]??9) - (teamOrd[b[0]]??9);
  });

  // 시트 출력
  sheetOut.clearContents();
  const HDR = ['팀','업체명','예정금액','입금금액','차액','수금률','상태','구분','매칭근거'];
  sheetOut.getRange(1,1,1,HDR.length).setValues([HDR])
    .setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#fff');
  if (rows.length) {
    sheetOut.getRange(2,1,rows.length,HDR.length).setValues(rows);
    sheetOut.getRange(2,3,rows.length,3).setNumberFormat('#,##0');
    sheetOut.getRange(2,6,rows.length,1).setNumberFormat('0%');
  }

  // 신규매칭_검증 시트
  let sheetNM = ss.getSheetByName(CFG.SHEET_NEW_MATCH);
  if (!sheetNM) sheetNM = ss.insertSheet(CFG.SHEET_NEW_MATCH);
  sheetNM.clearContents();
  const nmHDR = ['팀','업체명','예정금액','매칭_입금주명','입금금액','유사도','매칭방식','학습상태'];
  sheetNM.getRange(1,1,1,nmHDR.length).setValues([nmHDR])
    .setFontWeight('bold').setBackground('#4f46e5').setFontColor('#fff');
  if (sgMatched.length) {
    const nmRows = sgMatched.sort((a,b) => (b.matchedAmt||0)-(a.matchedAmt||0)).map(r => [
      r.team, r.name, r.expected, r.matchedPayer||'', r.matchedAmt||0,
      (r.matchedScore||0).toFixed(2), r.matchedBy||'',
      r.matchedBy==='별칭DB' ? '✓ 학습됨' : r.matchedScore>=CFG.AUTO_LEARN_THRESHOLD ? '🤖 자동학습됨' : '⚠ 검증필요'
    ]);
    sheetNM.getRange(2,1,nmRows.length,nmHDR.length).setValues(nmRows);
    sheetNM.getRange(2,3,nmRows.length,1).setNumberFormat('#,##0');
    sheetNM.getRange(2,5,nmRows.length,1).setNumberFormat('#,##0');
  }
  sheetNM.setFrozenRows(1);

  // 미매칭_목록 업데이트
  let sheetUM = ss.getSheetByName('미매칭_목록');
  if (!sheetUM) {
    sheetUM = ss.insertSheet('미매칭_목록');
    const umH = ['팀','업체명','담당자(입력)','예정금액','상태','최초발견일','처리상태'];
    sheetUM.getRange(1,1,1,umH.length).setValues([umH])
      .setFontWeight('bold').setBackground('#f59e0b').setFontColor('#fff');
    [60,260,100,120,70,110,90].forEach((w,i) => sheetUM.setColumnWidth(i+1,w));
    sheetUM.setFrozenRows(1);
  }
  const umExist = {};
  const umRows2 = sheetUM.getDataRange().getValues();
  for (let i = 1; i < umRows2.length; i++) {
    const n = String(umRows2[i][1]||'').trim();
    if (n) umExist[n] = i+1;
  }
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  for (const r of rows) {
    const name = r[1], status = r[6];
    if (status === '완료') {
      if (umExist[name]) {
        sheetUM.getRange(umExist[name],7).setValue('✅완료');
        sheetUM.getRange(umExist[name],1,1,7).setBackground('#d1fae5');
      }
    } else {
      if (umExist[name]) {
        sheetUM.getRange(umExist[name],4).setValue(r[2]);
        sheetUM.getRange(umExist[name],5).setValue(status);
        sheetUM.getRange(umExist[name],7).setValue('⏳미완료');
        sheetUM.getRange(umExist[name],1,1,7).setBackground('#fef3c7');
      } else {
        sheetUM.appendRow([r[0], name, '', r[2], status, today, '⏳미완료']);
        const nr = sheetUM.getLastRow();
        sheetUM.getRange(nr,1,1,7).setBackground('#fef3c7');
        sheetUM.getRange(nr,4).setNumberFormat('#,##0');
        umExist[name] = nr;
      }
    }
  }

  // 결과 알림
  const totalExp = rows.reduce((s,r) => s + r[2], 0);
  const compAmt  = rows.filter(r => r[6]==='완료').reduce((s,r) => s + r[2], 0)
                 + rows.filter(r => r[6]==='부분수금').reduce((s,r) => s + r[3], 0);
  const rate = totalExp > 0 ? (compAmt/totalExp*100).toFixed(1) : 0;
  ui.alert(
    '✅ 매핑 완료! (' + ((new Date()-t0)/1000).toFixed(1) + '초)\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n' +
    'STEP1 기완료(기존O):  ' + alreadyDone.length + '건\n' +
    'STEP2 수금_원본 매핑: ' + sgMatched.length + '건\n' +
    'STEP3 AR없음→완료:   ' + arCompleted.length + '건\n' +
    'STEP3 AR있음→미수:   ' + arUnpaid.length + '건\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🎯 수금률: ' + rate + '%\n' +
    '완료: ' + rows.filter(r=>r[6]==='완료').length + '건 / 미수: ' + arUnpaid.length + '건\n\n' +
    '📋 신규매칭_검증에서 ⚠ 검증필요 건 확인해주세요!'
  );
}

// ════════════════════════════════════════════
// 5. 대시보드 데이터 조회
// ════════════════════════════════════════════
function getOverviewData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetOut  = findSheet(ss, [CFG.SHEET_OUTPUT, '현재_수금데이터']);
  const sheetNew  = findSheet(ss, [CFG.SHEET_NEW_MATCH, '신규매칭_검증']);
  const sheetCO   = findSheet(ss, [CFG.SHEET_CARRYOVER, '이월_확인']);
  const sheetMisu = findSheet(ss, [CFG.SHEET_MISUGEUM, '미수금_리스트', 'Sheet1']);
  const sheetAR   = findSheet(ss, [CFG.SHEET_AR, 'AR_원본']);

  if (!sheetOut) {
    return {
      meta: { now: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') },
      error: '먼저 [💰 수금 매핑 v7] 메뉴 → [▶ 매핑 실행]을 클릭해주세요!',
      kpi: emptyKpi(), teams: [], sales_list: [], high_value: [],
      new_matched: [], carryover: [], aging: emptyAging(), records: []
    };
  }

  let outData = [];
  try { outData = sheetOut.getDataRange().getValues().slice(1); } catch(e) {}

  // AR_원본 경과일 매핑
  const arDaysMap = {};
  try {
    const arRaw  = sheetAR.getDataRange().getValues();
    const arHead = arRaw[0].map(h => String(h).trim().toUpperCase());
    const colCo  = arHead.indexOf('업체명') >= 0 ? arHead.indexOf('업체명') : 0;
    const colDt  = arHead.indexOf('ARDATE');
    if (colDt >= 0) {
      const today = new Date(); today.setHours(0,0,0,0);
      for (let i = 1; i < arRaw.length; i++) {
        const name = String(arRaw[i][colCo]||'').trim();
        const raw  = arRaw[i][colDt];
        if (!name || !raw) continue;
        const d = raw instanceof Date ? raw : new Date(raw);
        if (isNaN(d.getTime())) continue;
        const days = Math.floor((today-d)/86400000);
        if (!arDaysMap[name] || days > arDaysMap[name]) arDaysMap[name] = days;
      }
    }
  } catch(e) {}

  const calcAging = (days) => {
    if (days <= 7)  return '7일이내';
    if (days <= 14) return '14일이내';
    if (days <= 21) return '21일이내';
    if (days <= 30) return '30일이내';
    return '30일초과';
  };

  // records 파싱
  // 컬럼: A=팀 B=업체명 C=예정금액 D=입금금액 E=차액 F=수금률 G=상태 H=구분 I=매칭근거 J=연체일수 K=미수사유
  const records = outData
    .filter(r => r[1] && String(r[1]).trim() !== '합계')
    .map(r => {
      const name = String(r[1]||'');

      // J열(r[9])에 연체일수가 직접 입력된 경우 우선 사용, 없으면 AR_원본에서 계산
      const jVal = r[9] !== undefined && r[9] !== null && r[9] !== '' ? Number(r[9]) : NaN;
      let od;
      if (!isNaN(jVal) && jVal >= 0) {
        od = jVal;  // J열 직접 입력값 우선
      } else {
        od = arDaysMap[name];
        if (od === undefined) {
          const nm = normName(name);
          for (const k in arDaysMap) { if (normName(k) === nm) { od = arDaysMap[k]; break; } }
        }
        od = od || 0;
      }

      return {
        team:     String(r[0]||''),
        name,
        expected: Number(r[2]||0),
        paid:     Number(r[3]||0),
        diff:     Number(r[4]||0),
        rate:     Number(r[5]||0),
        status:   String(r[6]||''),
        gubun:    String(r[7]||''),
        basis:    String(r[8]||''),
        matched_payer: (function(){
          const b = String(r[8]||'');
          if (!b || b==='고액미수') return '';
          const m = b.match(/^(.+?)\s*\([^)]+\)$/);
          return m ? m[1].trim() : (b.indexOf('(') < 0 ? b : '');
        })(),
        overdueDays: od,
        agingBucket: calcAging(od),
        memo:     String(r[10]||''),  // K열: 미수사유/비고
      };
    });

  // 담당자 매핑
  const salesMap = {}, salesMapNorm = {};
  const loadSales_ = (sheet) => {
    if (!sheet) return;
    for (const row of sheet.getDataRange().getValues()) {
      const a = String(row[0]||'').trim(), b = String(row[1]||'').trim();
      if (!a || !b) continue;
      if (a.toUpperCase()==='ISALES' || b.toUpperCase()==='CUSTOMER COMPANY' || b==='업체명') continue;
      salesMap[b] = a; salesMapNorm[normName(b)] = a;
    }
  };
  loadSales_(findSheet(ss, [CFG.SHEET_SALES_DB, '담당자_DB']));
  Logger.log('담당자_DB 로드: ' + Object.keys(salesMap).length + '개');

  const sheetUM = ss.getSheetByName('미매칭_목록');
  if (sheetUM) {
    for (const row of sheetUM.getDataRange().getValues()) {
      const co = String(row[1]||'').trim(), s = String(row[2]||'').trim();
      if (!co || !s || co==='업체명') continue;
      if (!salesMap[co] && !salesMapNorm[normName(co)]) {
        salesMap[co] = s; salesMapNorm[normName(co)] = s;
      }
    }
  }
  Logger.log('최종 담당자 맵: ' + Object.keys(salesMap).length + '개');

  for (const r of records) {
    const nm = normName(r.name);
    if      (salesMap[r.name])    r.sales = salesMap[r.name];
    else if (salesMapNorm[nm])    r.sales = salesMapNorm[nm];
    else {
      let best = '', bestSc = 0;
      for (const k in salesMap) {
        const sc = similarityScore(r.name, k);
        if (sc > bestSc) { bestSc = sc; best = salesMap[k]; }
      }
      r.sales = bestSc >= 0.85 ? best : '';
    }
  }
  Logger.log('담당자 매핑: ' + records.filter(r=>r.sales).length + '/' + records.length + '개');

  // 미수금_리스트 D열 실시간 반영
  let liveUpdated = 0;
  if (sheetMisu) {
    try {
      const misuData = sheetMisu.getDataRange().getValues();
      const misuMap = {};
      for (let i = 1; i < misuData.length; i++) {
        const n = String(misuData[i][1]||'').trim();
        if (n) misuMap[normName(n)] = String(misuData[i][3]||'').trim();
      }
      Logger.log('실시간 반영 건수: ' + liveUpdated + ' / misuMap 크기: ' + Object.keys(misuMap).length);
      for (const r of records) {
        const yn = misuMap[normName(r.name)];
        if (['O','o','○'].includes(yn) && r.status !== '완료') {
          r.status = '완료'; r.paid = r.expected; r.diff = 0; liveUpdated++;
        }
      }
    } catch(e) { Logger.log('실시간반영 오류: ' + e.toString()); }
  }

  // ★ 수금률 계산 (확정 기준)
  // 수금완료 금액 = 완료건 예정금액 + 부분수금 실입금액(paid)
  // 수금률       = 수금완료 금액 / 전체 예정금액
  const ov_total    = records.reduce((s,r) => s + r.expected, 0);
  const ov_done     = records.filter(r => r.status === '완료');
  const ov_partial  = records.filter(r => r.status === '부분수금');
  const ov_unpaid   = records.filter(r => r.status === '미수');
  const ov_newMatch = records.filter(r => r.gubun === '신규매칭');

  const completedAmt  = ov_done.reduce((s,r) => s + r.expected, 0)
                      + ov_partial.reduce((s,r) => s + r.paid, 0);
  const unpaidAmt     = ov_unpaid.reduce((s,r) => s + r.expected, 0)
                      + ov_partial.reduce((s,r) => s + r.diff, 0);
  const newMatchedAmt = ov_newMatch.reduce((s,r) => s + r.paid, 0);
  const rate          = ov_total > 0 ? Math.round(completedAmt / ov_total * 1000) / 10 : 0;

  Logger.log('수금률: ' + rate + '% (완료 ' + (completedAmt/1e8).toFixed(2) + '억 / 예정 ' + (ov_total/1e8).toFixed(2) + '억)');

  // 이월
  const carryover = [];
  if (sheetCO) {
    for (const row of sheetCO.getDataRange().getValues().slice(1)) {
      if (row[1]) carryover.push({
        team: String(row[0]||''), name: String(row[1]),
        amount: Number(row[2]||0), sales: salesMap[String(row[1])]||''
      });
    }
    carryover.sort((a,b) => b.amount - a.amount);
  }

  // 신규매칭 상세
  const newMatchDetails = [];
  if (sheetNew) {
    for (const row of sheetNew.getDataRange().getValues().slice(1)) {
      if (!row[1]) continue;
      const ls = String(row[7]||'');
      newMatchDetails.push({
        team: String(row[0]||''), name: String(row[1]),
        expected: Number(row[2]||0), matched_payer: String(row[3]||''),
        paid: Number(row[4]||0), score: Number(row[5]||0),
        matched_by: String(row[6]||''),
        auto_learned: ls.indexOf('자동학습')>=0 || ls.indexOf('학습됨')>=0,
        sales: salesMap[String(row[1])]||''
      });
    }
  }

  // 팀별 통계
  const teamStats = {};
  for (const t of ['B2D','S1','S2','S3'])
    teamStats[t] = { team:t, cnt:0, remain_cnt:0, old:0, completed:0, remain:0 };
  for (const r of records) {
    if (!teamStats[r.team]) continue;
    teamStats[r.team].cnt++;
    teamStats[r.team].old += r.expected;
    if (r.status === '완료') {
      teamStats[r.team].completed += r.expected;
    } else if (r.status === '부분수금') {
      teamStats[r.team].completed += r.paid;
      teamStats[r.team].remain    += r.diff;
      teamStats[r.team].remain_cnt++;
    } else {
      teamStats[r.team].remain     += r.expected;
      teamStats[r.team].remain_cnt++;
    }
  }
  const teams = Object.values(teamStats).map(t => ({
    ...t, rate: t.old > 0 ? Math.round(t.completed/t.old*1000)/10 : 0
  }));

  // 담당자별 통계
  const salesStats = {};
  for (const r of records) {
    const s = r.sales || '미매칭';
    if (!salesStats[s]) salesStats[s] = { sales:s, cnt:0, remain_cnt:0, old:0, completed:0, remain:0 };
    salesStats[s].cnt++;
    salesStats[s].old += r.expected;
    if (r.status === '완료') {
      salesStats[s].completed += r.expected;
    } else if (r.status === '부분수금') {
      salesStats[s].completed += r.paid;
      salesStats[s].remain    += r.diff;
      salesStats[s].remain_cnt++;
    } else {
      salesStats[s].remain     += r.expected;
      salesStats[s].remain_cnt++;
    }
  }
  const salesList = Object.values(salesStats)
    .map(s => ({ ...s, rate: s.old>0 ? Math.round(s.completed/s.old*1000)/10 : 0 }))
    .sort((a,b) => a.sales==='미매칭' ? 1 : b.sales==='미매칭' ? -1 : b.old-a.old);

  const salesTotal = salesList.reduce((sum,s) => sum+s.old, 0);
  Logger.log('AR 총액 검증: 전체 ' + ov_total + ' / 담당자별 합계 ' + salesTotal + ' / 일치: ' + (ov_total===salesTotal));

  // 고액 미수
  const highValue = ov_unpaid
    .filter(r => r.expected >= CFG.HIGH_AMOUNT)
    .map(r => ({ name:r.name, team:r.team, sales:r.sales, amount:r.expected,
                 overdueDays:r.overdueDays, agingBucket:r.agingBucket, memo:r.memo||'' }))
    .sort((a,b) => b.amount-a.amount);

  // Aging
  const aging = emptyAging();
  for (const r of ov_unpaid) {
    if (aging[r.agingBucket]) { aging[r.agingBucket].count++; aging[r.agingBucket].amount += r.expected; }
  }

  return {
    meta: { now: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') },
    kpi: {
      analyzed_count:    records.length,
      analyzed_amt:      ov_total,
      completed_count:   ov_done.length + ov_partial.filter(r=>r.paid>=r.expected*0.9).length,
      completed_amt:     completedAmt,
      unpaid_count:      ov_unpaid.length + ov_partial.length,
      unpaid_amt:        unpaidAmt,
      partial_count:     ov_partial.length,
      new_matched_count: ov_newMatch.length,
      new_matched_amt:   newMatchedAmt,
      removed_count:     carryover.length,
      removed_amt:       carryover.reduce((s,r) => s+r.amount, 0),
      original_o_count:  ov_done.length,
      rate:              rate,
      rate_base:         CFG.RATE_BASE,
    },
    teams:       teams,
    sales_list:  salesList,   // Index.html이 DATA.sales_list로 읽음
    high_value:  highValue,   // Index.html이 DATA.high_value로 읽음
    new_matched: newMatchDetails,
    carryover:   carryover,
    aging:       aging,
    records:     records,
  };
}

// ════════════════════════════════════════════
// 6. 차트 데이터
// ════════════════════════════════════════════
function getChartData() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.SHEET_CHART);
  if (!sheet) return null;

  const data   = sheet.getDataRange().getValues();
  const result = { labels:[], w0:[], w1:[], w2:[], w3:[], fin:[] };
  let curYear  = '';

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) curYear = String(row[0]).replace('년','').trim();
    if (row[1] && curYear) {
      const month = String(row[1]).replace('월','').trim().padStart(2,'0');
      result.labels.push(curYear + '-' + month);
      result.w0.push(row[5] ? Math.round(row[5]*100) : null);
      result.w1.push(row[6] ? Math.round(row[6]*100) : null);
      result.w2.push(row[7] ? Math.round(row[7]*100) : null);
      result.w3.push(row[8] ? Math.round(row[8]*100) : null);
      result.fin.push(row[9] ? Math.round(row[9]*100) : null);
    }
  }

  // 빈 마지막 행 제거
  while (result.labels.length > 0) {
    const i = result.labels.length-1;
    if (result.w0[i]===null && result.w1[i]===null && result.w2[i]===null && result.w3[i]===null && result.fin[i]===null) {
      result.labels.pop(); result.w0.pop(); result.w1.pop(); result.w2.pop(); result.w3.pop(); result.fin.pop();
    } else break;
  }

  const avg = arr => {
    const valid = arr.slice(0,-1).filter(v => v!==null);
    return valid.length ? Math.round(valid.reduce((s,v) => s+v, 0)/valid.length) : 0;
  };
  result.avg = { w0:avg(result.w0), w1:avg(result.w1), w2:avg(result.w2), w3:avg(result.w3), fin:avg(result.fin) };

  let lastIdx = result.labels.length-1;
  while (lastIdx > 0 && result.w0[lastIdx]===null && result.w1[lastIdx]===null &&
         result.w2[lastIdx]===null && result.w3[lastIdx]===null && result.fin[lastIdx]===null)
    lastIdx--;

  const prevIdx = lastIdx-1, yoyIdx = lastIdx-12;
  const cur  = result.fin[lastIdx] ?? result.w3[lastIdx] ?? result.w2[lastIdx] ?? result.w1[lastIdx] ?? result.w0[lastIdx] ?? null;
  const prev = prevIdx>=0 ? (result.fin[prevIdx] ?? result.w3[prevIdx] ?? null) : null;
  const yoy  = yoyIdx>=0  ? (result.fin[yoyIdx]  ?? result.w3[yoyIdx]  ?? null) : null;
  const ok   = v => v!==null && !isNaN(v) && v>=0 && v<=100;

  Logger.log('차트 비교: lastIdx=' + lastIdx + ' label=' + result.labels[lastIdx] + ' current=' + cur);
  result.comparison = {
    current:     ok(cur)  ? cur  : null,
    prev_label:  prevIdx>=0 ? result.labels[prevIdx] : null,
    prev_rate:   ok(prev) ? prev : null,
    prev_diff:   ok(cur)&&ok(prev) ? Math.round((cur-prev)*10)/10 : null,
    yoy_label:   yoyIdx>=0 ? result.labels[yoyIdx] : null,
    yoy_rate:    ok(yoy)  ? yoy  : null,
    yoy_diff:    ok(cur)&&ok(yoy)  ? Math.round((cur-yoy)*10)/10  : null,
    avg_w0: result.avg.w0, avg_fin: result.avg.fin,
  };

  return result;
}

// ════════════════════════════════════════════
// 7. 수금 완료 처리
// ════════════════════════════════════════════
function markAsCompleted(companyName, writerName, payerName) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_MISUGEUM);
    if (!sheet) return { success:false, error:'미수금_리스트 시트 없음' };

    const data = sheet.getDataRange().getValues();
    let rowNum = -1;
    const targetNorm = normName(companyName);

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(companyName).trim() || normName(data[i][1]) === targetNorm) {
        rowNum = i+1; break;
      }
    }
    if (rowNum < 0) return { success:false, error:'거래처를 찾을 수 없음: ' + companyName };

    sheet.getRange(rowNum,4).setValue('O');

    let learned = false;
    if (payerName && payerName.trim() && payerName !== companyName) {
      const ar = addAlias(companyName, payerName.trim(), writerName||'시스템', '수금완료_확정');
      if (ar.success && !ar.skipped) learned = true;
    }

    addComment(companyName, '✓ 수금 완료 처리' + (learned ? ' (별칭: '+payerName+')' : ''), writerName||'시스템');
    return { success:true, row:rowNum, learned, message: companyName+' 수금완료 처리됨' };
  } catch(e) { return { success:false, error:e.toString() }; }
}

function confirmMatch(companyName, payerName, writerName) {
  try {
    addAlias(companyName, payerName, writerName||'시스템', '수동확정');
    const cr = markAsCompleted(companyName, writerName, payerName);
    const sheetOut = findSheet(SpreadsheetApp.getActiveSpreadsheet(), [CFG.SHEET_OUTPUT, '현재_수금데이터']);
    if (sheetOut) {
      const data = sheetOut.getDataRange().getValues();
      const nt = normName(companyName);
      for (let i = 1; i < data.length; i++) {
        const n = String(data[i][1]||'').trim();
        if (n === companyName || normName(n) === nt) {
          sheetOut.getRange(i+1,7).setValue('완료');
          sheetOut.getRange(i+1,8).setValue('신규매칭');
          sheetOut.getRange(i+1,9).setValue(payerName+' (수동확정)');
          break;
        }
      }
    }
    return { success:true, aliasLearned:true, completed:cr.success };
  } catch(e) { return { success:false, error:e.toString() }; }
}

function rejectMatch(companyName, payerName, writerName) {
  try { return addBlacklist(companyName, payerName, writerName||'시스템'); }
  catch(e) { return { success:false, error:e.toString() }; }
}

function unmarkCompleted(companyName, writerName) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_MISUGEUM);
    if (!sheet) return { success:false, error:'미수금_리스트 시트 없음' };
    const data = sheet.getDataRange().getValues();
    let rowNum = -1;
    const nt = normName(companyName);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim()===String(companyName).trim() || normName(data[i][1])===nt) { rowNum=i+1; break; }
    }
    if (rowNum < 0) return { success:false, error:'거래처를 찾을 수 없음' };
    sheet.getRange(rowNum,4).clearContent();
    addComment(companyName, '⟲ 수금완료 취소됨', writerName||'시스템');
    return { success:true };
  } catch(e) { return { success:false, error:e.toString() }; }
}

// ════════════════════════════════════════════
// 8. 댓글
// ════════════════════════════════════════════
function getComments(companyName) {
  try {
    if (!companyName) return [];
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_COMMENT);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const out  = [];
    const name = String(companyName).trim();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() !== name) continue;
      out.push({
        date:    data[i][0] instanceof Date
          ? Utilities.formatDate(data[i][0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
          : String(data[i][0]),
        name:    String(data[i][1]||''),
        comment: String(data[i][2]||''),
        author:  String(data[i][3]||'익명'),
      });
    }
    return out;
  } catch(e) { return []; }
}

function addComment(companyName, comment, writerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CFG.SHEET_COMMENT);
    if (!sheet) {
      sheet = ss.insertSheet(CFG.SHEET_COMMENT);
      sheet.getRange(1,1,1,4).setValues([['날짜','업체명','댓글','작성자']]);
    }
    sheet.appendRow([new Date(), companyName, comment, (writerName&&writerName.trim()) ? writerName : Session.getActiveUser().getEmail()]);
    return { success:true };
  } catch(e) { return { success:false, error:e.toString() }; }
}

// ════════════════════════════════════════════
// 9. 담당자 학습 / 요약 / 진단
// ════════════════════════════════════════════
function learnSalesFromUnmatched() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ui  = SpreadsheetApp.getUi();
  const sheetUM = ss.getSheetByName('미매칭_목록');
  if (!sheetUM) { ui.alert('미매칭_목록 없음. 매핑 실행 먼저!'); return; }

  let sheetDB = findSheet(ss, [CFG.SHEET_SALES_DB, '담당자_DB']);
  if (!sheetDB) {
    sheetDB = ss.insertSheet(CFG.SHEET_SALES_DB);
    sheetDB.getRange(1,1,1,2).setValues([['ISales','Customer Company']]);
  }

  const existing = new Set();
  for (const row of sheetDB.getDataRange().getValues().slice(1)) {
    const b = String(row[1]||'').trim();
    if (b) existing.add(normName(b));
  }

  const umRows = sheetUM.getDataRange().getValues();
  let learned = 0, skipped = 0;
  for (let i = 1; i < umRows.length; i++) {
    const company = String(umRows[i][1]||'').trim();
    const sales   = String(umRows[i][2]||'').trim();
    const status  = String(umRows[i][6]||'').trim();
    if (!company || !sales || status==='✅완료') { skipped++; continue; }
    if (!existing.has(normName(company))) {
      sheetDB.appendRow([sales, company]);
      existing.add(normName(company));
      sheetUM.getRange(i+1,7).setValue('✅완료');
      sheetUM.getRange(i+1,1,1,7).setBackground('#d1fae5');
      learned++;
    } else skipped++;
  }
  ui.alert('✅ 담당자 학습 완료!\n\n담당자_DB 저장: ' + learned + '건\n스킵: ' + skipped + '건');
}

function showUnmatchedSales() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('미매칭_목록');
  if (!sheet) { SpreadsheetApp.getUi().alert('미매칭_목록 없음. 매핑 실행 먼저!'); return; }
  const data     = sheet.getDataRange().getValues().slice(1);
  const pending  = data.filter(r => String(r[6]).trim() !== '✅완료');
  const resolved = data.filter(r => String(r[6]).trim() === '✅완료');
  const tc = {};
  for (const r of pending) tc[r[0]||'미상'] = (tc[r[0]||'미상']||0)+1;
  let msg = '👤 담당자 미매칭 현황\n\n⏳ 미완료: ' + pending.length + '개사\n✅ 완료: ' + resolved.length + '개사\n\n';
  if (pending.length) {
    msg += '팀별:\n';
    for (const t of ['B2D','S1','S2','S3']) { if (tc[t]) msg += '  ' + t + ': ' + tc[t] + '개사\n'; }
  } else msg += '🎉 모든 거래처에 담당자 매핑 완료!';
  SpreadsheetApp.getUi().alert(msg);
}

function showSummary() {
  const d = getOverviewData(), k = d.kpi;
  SpreadsheetApp.getUi().alert(
    '📊 수금 현황 요약\n\n🎯 수금률: ' + k.rate + '%\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n' +
    '분석: ' + k.analyzed_count + '건 / ' + (k.analyzed_amt/1e8).toFixed(2) + '억\n' +
    '  완료: ' + k.completed_count + '건 (신규 ' + k.new_matched_count + '건)\n' +
    '  미수: ' + k.unpaid_count + '건 / ' + (k.unpaid_amt/1e8).toFixed(2) + '억\n\n' +
    '팀별:\n' + d.teams.sort((a,b)=>b.rate-a.rate).map((t,i) => '  ' + (i+1) + '. ' + t.team + ' ' + t.rate + '%').join('\n')
  );
}

function diagnoseSheets() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const all = ss.getSheets().map(s => '"'+s.getName()+'"');
  let msg   = '📋 시트 목록:\n' + all.join('\n') + '\n\n';
  const needed = { '미수금_리스트':CFG.SHEET_MISUGEUM, 'AR_원본':CFG.SHEET_AR, '수금_원본':CFG.SHEET_SUGEUN, '현재_수금데이터':CFG.SHEET_OUTPUT };
  for (const [label, name] of Object.entries(needed))
    msg += (ss.getSheetByName(name) ? '✅ ' : '❌ ') + label + ' → "' + name + '"\n';
  SpreadsheetApp.getUi().alert(msg);
}

function autoFillDueDate() {
  SpreadsheetApp.getUi().alert('납기일 자동 채우기 기능은 AR_원본에 ARDATE 컬럼이 필요합니다.');
}

// ════════════════════════════════════════════
// 11. 미수사유 저장 (현재_수금데이터 K열)
// ════════════════════════════════════════════
function saveMemo(companyName, memo) {
  try {
    const ss       = SpreadsheetApp.getActiveSpreadsheet();
    const sheetOut = findSheet(ss, [CFG.SHEET_OUTPUT, '현재_수금데이터']);
    if (!sheetOut) return { success:false, error:'현재_수금데이터 시트 없음' };

    const data = sheetOut.getDataRange().getValues();

    // 헤더 J열(연체일수), K열(미수사유) 없으면 자동 추가
    if (!String(data[0][9]||'').trim()) {
      sheetOut.getRange(1,10).setValue('연체일수')
        .setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#fff');
    }
    if (!String(data[0][10]||'').trim()) {
      sheetOut.getRange(1,11).setValue('미수사유')
        .setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#fff');
    }

    const nt = normName(companyName);
    for (let i = 1; i < data.length; i++) {
      const n = String(data[i][1]||'').trim();
      if (n === companyName || normName(n) === nt) {
        sheetOut.getRange(i+1, 11).setValue(memo);
        return { success:true, row:i+1 };
      }
    }
    return { success:false, error:'거래처를 찾을 수 없음: ' + companyName };
  } catch(e) { return { success:false, error:e.toString() }; }
}

// ════════════════════════════════════════════
// 10. OPS Portal JSON API (외부 대시보드용)
// ════════════════════════════════════════════
function opsReceivablesJsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function opsBuildReceivablesPayload_() {
  try {
    const overview = getOverviewData();
    const sourceRecords = (overview && Array.isArray(overview.records)) ? overview.records : [];
    const records = sourceRecords
      .map((r, i) => opsNormalizeReceivableRecord_(r, i))
      .filter(r => r && r.name && r.expected > 0);
    const summary = opsBuildReceivablesSummary_(records, overview);
    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      source: 'ICBANQ Receivables Dashboard',
      summary, records,
      rawOverview: {
        meta:  overview&&overview.meta  ? overview.meta  : null,
        kpi:   overview&&overview.kpi   ? overview.kpi   : null,
        error: overview&&overview.error ? overview.error : ''
      }
    };
  } catch(e) {
    return { ok:false, updatedAt:new Date().toISOString(), message:String(e&&e.message||e), records:[] };
  }
}

function opsNormalizeReceivableRecord_(r, idx) {
  const expected = opsNumber_(r.expected);
  const paid     = opsNumber_(r.paid);
  const status   = opsNormalizeReceivableStatus_(r.status);
  const explDiff = opsNumberOrNull_(r.diff);
  const diff     = explDiff !== null ? Math.max(0, explDiff) : opsInferDiff_(expected, paid, status);
  const normPaid = paid || Math.max(0, expected - diff);
  const sales    = opsPickText_(r, ['sales', 'Sales', 'SALES', 'salesName', 'salesCode', 'owner', 'manager', 'rep', '담당자', '담당', '담당 Sales', '담당Sales', '담당자명', '영업담당', '영업', '담당 영업']);
  const fSales   = opsPickText_(r, ['fSales', 'FSales', 'F Sales', 'FS', 'fsales', '상위담당', '팀장', 'FSales / ISales', 'FS / IS', 'FS/IS']);

  return {
    id:            r.id || ('receivable-live-' + (idx+1)),
    team:          String(r.team||'').trim(),
    sales,
    fSales,
    name:          String(r.name||r.company||'').trim(),
    company:       String(r.name||r.company||'').trim(),
    expected,      expectedAmount: expected,
    paid:          normPaid, paidAmount: normPaid,
    diff,          unpaidAmount: diff,
    rate:          opsNumber_(r.rate) || (expected>0 ? Math.round(normPaid/expected*1000)/10 : 0),
    status,
    gubun:         String(r.gubun||'').trim(),
    basis:         String(r.basis||'').trim(),
    matched_payer: String(r.matched_payer||r.matchedPayer||'').trim(),
    collectionMonth: String(r.collectionMonth||r.month||'').trim(),
    dueDate:       String(r.dueDate||r.expectedDate||r.date||'').trim(),
    overdueDays:   opsNumber_(r.overdueDays),
    agingBucket:   String(r.agingBucket||'').trim(),
    erpUrl:        String(r.erpUrl||r.trackingUrl||r.orderUrl||r.link||'').trim(),
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
  const totalExpected  = records.reduce((s,r) => s+r.expected, 0);
  const completed      = records.filter(r => r.status==='완료');
  const partial        = records.filter(r => r.status==='부분수금');
  const unpaid         = records.filter(r => r.status==='미수');
  const completedAmt   = completed.reduce((s,r) => s+r.expected, 0)
                       + partial.reduce((s,r) => s+r.paid, 0);
  const unpaidAmt      = unpaid.reduce((s,r) => s+r.expected, 0)
                       + partial.reduce((s,r) => s+r.diff, 0);
  const webRate        = opsNumberOrNull_(overview&&overview.kpi ? overview.kpi.rate : null);

  return {
    totalCount:      records.length,
    totalExpected,
    completedCount:  completed.length,
    completedAmount: completedAmt,
    partialCount:    partial.length,
    partialAmount:   partial.reduce((s,r) => s+r.diff, 0),
    unpaidCount:     unpaid.length,
    unpaidAmount:    unpaidAmt,
    collectionRate:  webRate !== null ? opsNormalizePercent_(webRate)
                     : (totalExpected>0 ? Math.round(completedAmt/totalExpected*1000)/10 : 0),
  };
}

function opsInferDiff_(expected, paid, status) {
  if (status==='완료') return 0;
  if (expected>0 && paid>0) return Math.max(0, expected-paid);
  return Math.max(0, expected);
}

function opsNormalizeReceivableStatus_(value) {
  const t = String(value||'').trim();
  if (t.indexOf('부분')>=0) return '부분수금';
  if (t.indexOf('완료')>=0 || t==='O') return '완료';
  return '미수';
}

function opsNumber_(v) {
  const n = Number(String(v==null?'':v).replace(/[^0-9.-]/g,''));
  return Number.isFinite(n) ? n : 0;
}

function opsNumberOrNull_(v) {
  if (v===null||v===undefined||v==='') return null;
  const n = opsNumber_(v);
  return Number.isFinite(n) ? n : null;
}

function opsNormalizePercent_(v) {
  const n = opsNumber_(v);
  return n<=1 ? Math.round(n*1000)/10 : Math.round(n*10)/10;
}
