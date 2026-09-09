/**
 * ICBANQ Receivables 수금현황 대시보드 v5
 * Google Apps Script - 서버 로직
 * 
 * [매핑 흐름 - v5 확정 로직]
 * STEP 1: 미수금_리스트 Sheet의 '수금여부' 빈칸 추출
 * STEP 2: AR_원본(미수금내역)과 대조 → 겹치지 않으면 이월로 분류 (분석 제외)
 * STEP 3: 수금_원본과 매칭
 *   - 1차: 이름 매칭 (정규화 + 유사도 0.85+)
 *   - 2차: 이름 0.70~0.85 + 금액 ±1% 일치
 * 
 * [수금률 계산]
 * 분자: 완료(O) 거래처의 예정금액 합 (기존 O + 신규 매칭)
 * 분모: 분석 대상 거래처의 예정금액 합 (이월 제외)
 */

// ════════════════════════════════════════════
// 설정
// ════════════════════════════════════════════
const CFG = {
  SHEET_MISUGEUM:   '미수금_리스트',     // 기준: 팀명/업체명/예정금액/수금여부
  SHEET_AR:         'AR_원본',           // ERP 미수금내역
  SHEET_SUGEUN:     '수금_원본',         // WIN-CMS 수금파일
  SHEET_ORDER:      '주문트래킹',        // 거래처-담당자 (보조)
  SHEET_SALES_DB:   '담당자_DB',         // 거래처-담당자 (우선, 직접 관리)
  SHEET_OUTPUT:    '현재_수금데이터',
  SHEET_NEW_MATCH:  '신규매칭_검증',
  SHEET_CARRYOVER:  '이월_확인',
  SHEET_CHART:      '그래프_데이터',
  SHEET_COMMENT:    '댓글',
  SHEET_ALIAS:      '별칭_DB',
  SHEET_BLACKLIST:  '매칭_제외',
  
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
    .createMenu('💰 수금 매핑 v6')
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

/**
 * 납기일 자동 채우기 - 주문트래킹/AR_원본에서 거래처별 최신 납기일 추출
 * 미수금_리스트 E열에 자동 입력
 */
function autoFillDueDate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMisu = findSheet(ss, [CFG.SHEET_MISUGEUM, '미수금_리스트', '미수금리스트', 'Sheet1']);
  const sheetAR = findSheet(ss, [CFG.SHEET_AR, 'AR_원본', 'AR원본']);
  const sheetOrder = findSheet(ss, [CFG.SHEET_ORDER, '주문트래킹', '주문_트래킹']);
  
  if (!sheetMisu) {
    SpreadsheetApp.getUi().alert('미수금_리스트 시트를 찾을 수 없습니다.');
    return;
  }
  
  const ui = SpreadsheetApp.getUi();
  const dueDateMap = {};
  
  // 1) AR_원본에서 날짜 컬럼 자동 탐색 (CREDIT_DATE, 납기일, 발행일 등)
  if (sheetAR) {
    try {
      const arData = sheetAR.getDataRange().getValues();
      const arHeader = arData[0].map(h => String(h).trim().toUpperCase());
      
      let companyCol = arHeader.indexOf('COMPANY');
      if (companyCol < 0) companyCol = arHeader.indexOf('업체명');
      if (companyCol < 0) companyCol = 0;
      
      // 날짜 컬럼 후보들 (한국 ERP에서 흔한 컬럼명)
      const dateColCandidates = ['DUE_DATE', '납기일', 'CREDIT_DATE', '발행일', 'INV_DATE', '청구일', 'DOC_DATE', '전표일', 'AR_DATE'];
      let dateCol = -1;
      for (const cand of dateColCandidates) {
        const idx = arHeader.indexOf(cand.toUpperCase());
        if (idx >= 0) { dateCol = idx; break; }
      }
      
      if (dateCol >= 0) {
        for (let i = 1; i < arData.length; i++) {
          const company = String(arData[i][companyCol] || '').trim();
          const dateVal = arData[i][dateCol];
          if (company && dateVal) {
            let d = dateVal instanceof Date ? dateVal : new Date(dateVal);
            if (!isNaN(d.getTime())) {
              // 동일 거래처 여러 건이면 가장 오래된 거 (Aging이 길어야 우선순위 높음)
              if (!dueDateMap[company] || d < dueDateMap[company]) {
                dueDateMap[company] = d;
              }
            }
          }
        }
      }
    } catch (e) {}
  }
  
  // 2) 주문트래킹에서도 시도 (있으면)
  if (sheetOrder && Object.keys(dueDateMap).length === 0) {
    try {
      const orderData = sheetOrder.getDataRange().getValues();
      const orderHeader = orderData[0].map(h => String(h).trim().toUpperCase());
      
      let companyCol = -1;
      for (const cand of ['CUSTOMER COMPANY', 'COMPANY', '업체명', '거래처']) {
        const idx = orderHeader.indexOf(cand.toUpperCase());
        if (idx >= 0) { companyCol = idx; break; }
      }
      
      let dateCol = -1;
      for (const cand of ['DUE_DATE', '납기일', 'ORDER_DATE', '주문일', 'DELIVERY_DATE', '납품일']) {
        const idx = orderHeader.indexOf(cand.toUpperCase());
        if (idx >= 0) { dateCol = idx; break; }
      }
      
      if (companyCol >= 0 && dateCol >= 0) {
        for (let i = 1; i < orderData.length; i++) {
          const company = String(orderData[i][companyCol] || '').trim();
          const dateVal = orderData[i][dateCol];
          if (company && dateVal) {
            let d = dateVal instanceof Date ? dateVal : new Date(dateVal);
            if (!isNaN(d.getTime())) {
              if (!dueDateMap[company] || d < dueDateMap[company]) {
                dueDateMap[company] = d;
              }
            }
          }
        }
      }
    } catch (e) {}
  }
  
  // 3) 매핑된 게 없으면 — 매출월 + 30일로 자동 계산 (보수적 기본값)
  if (Object.keys(dueDateMap).length === 0) {
    const response = ui.alert(
      '⚠️ 납기일 자동 탐색 실패',
      '주문트래킹/AR_원본에서 납기일 컬럼을 찾을 수 없습니다.\n\n' +
      '대안: 현재 매출월 기준 +30일로 일괄 설정할까요?\n' +
      '(예: 4월 매출 → 5월 31일 납기)',
      ui.ButtonSet.YES_NO
    );
    if (response === ui.Button.YES) {
      const today = new Date();
      // 다음달 말일
      const defaultDue = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const misuData = sheetMisu.getDataRange().getValues();
      let filled = 0;
      for (let i = 1; i < misuData.length; i++) {
        if (misuData[i][1] && !misuData[i][4]) {
          sheetMisu.getRange(i + 1, 5).setValue(defaultDue);
          filled++;
        }
      }
      sheetMisu.getRange(2, 5, sheetMisu.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd');
      ui.alert('✅ ' + filled + '개 거래처에 기본 납기일(' + Utilities.formatDate(defaultDue, Session.getScriptTimeZone(), 'yyyy-MM-dd') + ') 적용 완료');
    }
    return;
  }
  
  // 4) 미수금_리스트 E열에 채우기
  const misuData = sheetMisu.getDataRange().getValues();
  let matched = 0, unmatched = 0;
  
  for (let i = 1; i < misuData.length; i++) {
    const name = String(misuData[i][1] || '').trim();
    if (!name) continue;
    
    // 이미 입력된 건 건너뛰기 (기존 값 보존)
    if (misuData[i][4]) continue;
    
    // 정확 매칭
    let due = dueDateMap[name];
    
    // 정규화 매칭
    if (!due) {
      const targetNorm = normName(name);
      for (const key in dueDateMap) {
        if (normName(key) === targetNorm) { due = dueDateMap[key]; break; }
      }
    }
    
    // 퍼지 매칭
    if (!due) {
      let bestScore = 0, bestDue = null;
      for (const key in dueDateMap) {
        const score = similarityScore(name, key);
        if (score >= 0.85 && score > bestScore) {
          bestScore = score;
          bestDue = dueDateMap[key];
        }
      }
      if (bestDue) due = bestDue;
    }
    
    if (due) {
      sheetMisu.getRange(i + 1, 5).setValue(due);
      matched++;
    } else {
      unmatched++;
    }
  }
  
  if (matched > 0) {
    sheetMisu.getRange(2, 5, sheetMisu.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd');
  }
  
  ui.alert(
    '✅ 납기일 자동 채우기 완료\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n' +
    '✓ 매칭 성공: ' + matched + '건\n' +
    '✗ 매칭 실패: ' + unmatched + '건\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '※ 매칭 실패한 거래처는 E열에 수동 입력해주세요.\n' +
    '※ 기존 값이 있는 행은 변경되지 않습니다.'
  );
}

// ════════════════════════════════════════════
// 2. 유틸 함수
// ════════════════════════════════════════════

/**
 * 담당자 매핑 진단 - Apps Script 에디터에서 직접 실행 후 로그 확인
 */
function diagnoseSalesDB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 전체 시트 목록 출력
  Logger.log('=== 전체 시트 목록 ===');
  ss.getSheets().forEach(s => Logger.log('  "' + s.getName() + '"'));
  
  const sheetSalesDB = findSheet(ss, [CFG.SHEET_SALES_DB, '담당자_DB', '담당자DB']);
  Logger.log('\n담당자_DB 시트: ' + (sheetSalesDB ? '발견 → "' + sheetSalesDB.getName() + '"' : '없음'));
  
  if (!sheetSalesDB) return;
  
  const data = sheetSalesDB.getDataRange().getValues();
  Logger.log('총 행수: ' + data.length);
  Logger.log('헤더(1행): ' + JSON.stringify(data[0]));
  Logger.log('2행: ' + JSON.stringify(data[1]));
  Logger.log('3행: ' + JSON.stringify(data[2]));
  Logger.log('4행: ' + JSON.stringify(data[3]));
  
  // 컬럼별 null/빈값 체크
  Logger.log('\n=== 컬럼별 데이터 확인 ===');
  for (let col = 0; col < 4; col++) {
    let filled = 0;
    for (let row = 1; row < data.length; row++) {
      if (data[row][col] !== null && data[row][col] !== '') filled++;
    }
    Logger.log('컬럼[' + col + ']: ' + filled + '개 채워짐 / 헤더=' + data[0][col]);
  }
  
  // 현재_수금데이터 샘플과 직접 비교
  const sheetOut = findSheet(ss, [CFG.SHEET_OUTPUT, '현재_수금데이터']);
  if (sheetOut) {
    const outName = String(sheetOut.getDataRange().getValues()[1][1] || '').trim();
    Logger.log('\n현재_수금데이터 첫 업체명: "' + outName + '"');
    
    // 담당자_DB에서 직접 찾기
    let found = false;
    for (let i = 1; i < data.length; i++) {
      const dbName = String(data[i][1] || '').trim();
      if (dbName === outName) {
        Logger.log('직접 매칭 성공! → 담당자: ' + data[i][2]);
        found = true;
        break;
      }
    }
    if (!found) Logger.log('직접 매칭 실패 → 담당자_DB에 "' + outName + '" 없음');
  }
}

function diagnoseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const all = ss.getSheets().map(s => '"' + s.getName() + '"');
  
  const needed = {
    '미수금_리스트': CFG.SHEET_MISUGEUM,
    'AR_원본': CFG.SHEET_AR,
    '수금_원본': CFG.SHEET_SUGEUN,
    '현재_수금데이터': CFG.SHEET_OUTPUT,
  };
  
  let msg = '📋 현재 시트 목록:\n';
  all.forEach(n => msg += '  ' + n + '\n');
  msg += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
  msg += '🔍 CFG에 설정된 시트명:\n';
  for (const [label, name] of Object.entries(needed)) {
    const found = ss.getSheetByName(name);
    msg += (found ? '  ✅ ' : '  ❌ ') + label + ' → "' + name + '"\n';
  }
  
  SpreadsheetApp.getUi().alert(msg);
}

function findSheet(ss, names) {
  for (const name of names) {
    const sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  return null;
}

/**
 * 빈 KPI 객체
 */
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

/**
 * 빈 Aging 객체
 */
function emptyAging() {
  return {
    '7일이내':  { count: 0, amount: 0 },
    '14일이내': { count: 0, amount: 0 },
    '21일이내': { count: 0, amount: 0 },
    '30일이내': { count: 0, amount: 0 },
    '30일초과': { count: 0, amount: 0 },
  };
}

/**
 * 업체명 정규화 - 공백, 법인격, 특수문자 제거
 */
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

/**
 * 두 문자열 유사도 (0~1)
 */
function similarityScore(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;

  const shorter = na.length <= nb.length ? na : nb;
  const longer  = na.length <= nb.length ? nb : na;

  // 완전 포함: 짧은 쪽이 긴 쪽에 완전히 들어가면 높은 점수
  if (shorter.length >= 2 && longer.indexOf(shorter) >= 0) {
    // 짧은 쪽 길이 비율에 따라 점수 조정 (너무 짧으면 낮게)
    const ratio = shorter.length / longer.length;
    if (ratio >= 0.7) return 0.95;
    if (ratio >= 0.5) return 0.90;
    if (ratio >= 0.3) return 0.85;
    return 0.80;
  }

  // 앞부분 일치 (prefix)
  if (shorter.length >= 3 && longer.startsWith(shorter)) return 0.92;

  return levenshteinRatio(na, nb);
}

function levenshteinRatio(a, b) {
  if (!a.length) return b.length ? 0 : 1;
  if (!b.length) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  const maxLen = Math.max(m, n);
  return 1 - (dp[m][n] / maxLen);
}

/**
 * 입금주명에서 후보 추출 (괄호 안 회사명 포함)
 */
function extractCandidates(name) {
  if (!name) return [];
  const s = String(name).replace(/[（）]/g, m => m === '（' ? '(' : ')').replace(/　/g, ' ');
  const cands = [s];
  
  // 괄호 안 내용
  const m1 = s.match(/\(([^)]+)\)/);
  if (m1) cands.push(m1[1]);
  
  // 닫는 괄호 없는 케이스
  const m2 = s.match(/\(([^)]*)$/);
  if (m2 && m2[1].length >= 2) cands.push(m2[1]);
  
  // 괄호 제거
  const noParen = s.replace(/\([^)]*\)?/g, '').trim();
  if (noParen && noParen !== s) cands.push(noParen);
  
  return cands.filter(c => c);
}

function smartMatch(masterName, payerName) {
  const nm = normName(masterName);
  const np = normName(payerName);
  if (!nm || !np) return 0;
  if (nm === np) return 1.0;

  // ★ 공통 접미사/접두사 제거 (매칭 노이즈 제거)
  // 이런 단어들은 매칭 근거로 쓰면 안됨 (너무 많은 회사가 공유)
  const commonWords = [
    '일렉트로닉스', '일렉트로닉', '일렉트로', '일렉',
    '테크놀로지스', '테크놀로지', '테크노', '테크',
    '코퍼레이션', '컴퍼니', '컴포넌트', '컴포', '컴',
    '트레이딩', '인더스트리', '솔루션', '솔류션',
    '시스템즈', '시스템', '메카트로닉스', '메카',
    '엔지니어링', '엔지니어', '엔터프라이즈',
    '홀딩스', '그룹', '상사', '전자', '반도체',
    '주식회사', '유한회사',
    'electronics', 'technology', 'corporation', 'company', 'trading'
  ];

  const stripCommon = (s) => {
    let r = s;
    for (const w of commonWords) {
      r = r.split(w).join('');  // 모든 위치에서 제거
    }
    return r.trim();
  };

  const cleanM = stripCommon(nm);
  const cleanP = stripCommon(np);

  // 공통어 제거 후 너무 짧아지면 매칭 불가
  if (cleanM.length < 2 || cleanP.length < 2) {
    // 공통어만으로 매칭되려던 케이스 → 거부
    return 0;
  }

  // 완전일치
  if (cleanM === cleanP) return 1.0;

  // 짧은 쪽이 긴 쪽에 완전 포함 (공통어 제거 후 기준)
  const shorter = cleanM.length <= cleanP.length ? cleanM : cleanP;
  const longer  = cleanM.length <= cleanP.length ? cleanP : cleanM;

  if (shorter.length >= 3 && longer.indexOf(shorter) >= 0) {
    const ratio = shorter.length / longer.length;
    if (ratio >= 0.7)  return 0.95;
    if (ratio >= 0.5)  return 0.90;
    if (ratio >= 0.4)  return 0.85;
    return 0;
  }

  // 앞 3글자 이상 일치 (공통어 제거 후 기준)
  if (cleanM.length >= 3 && cleanP.length >= 3) {
    if (cleanP.indexOf(cleanM.substring(0, 3)) >= 0) return 0.90;
    if (cleanM.indexOf(cleanP.substring(0, 3)) >= 0) return 0.88;
  }

  return 0;
}

// ════════════════════════════════════════════
// 별칭 DB (Alias Dictionary) - 학습 시스템
// ════════════════════════════════════════════

/**
 * 별칭 DB 시트 가져오기 (없으면 생성)
 */
function getAliasSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CFG.SHEET_ALIAS);
  if (!sheet) {
    sheet = ss.insertSheet(CFG.SHEET_ALIAS);
    sheet.getRange(1, 1, 1, 5).setValues([['거래처명', '입금주명_패턴', '확정일', '확정자', '학습방식']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#fff');
    sheet.setColumnWidths(1, 5, 180);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 블랙리스트 시트 가져오기 (없으면 생성)
 */
function getBlacklistSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CFG.SHEET_BLACKLIST);
  if (!sheet) {
    sheet = ss.insertSheet(CFG.SHEET_BLACKLIST);
    sheet.getRange(1, 1, 1, 4).setValues([['거래처명', '제외할_입금주명', '제외일', '제외자']]);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#dc2626').setFontColor('#fff');
    sheet.setColumnWidths(1, 4, 180);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 별칭 DB를 Map으로 로드
 * @return Map<string, Set<string>> { 거래처명: Set([입금주패턴들]) }
 */
function loadAliases() {
  const sheet = getAliasSheet();
  const data = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const company = String(data[i][0] || '').trim();
    const pattern = String(data[i][1] || '').trim();
    if (company && pattern) {
      if (!map[company]) map[company] = new Set();
      map[company].add(pattern);
      map[company].add(normName(pattern));
    }
  }
  return map;
}

/**
 * 블랙리스트 로드
 * @return Map<string, Set<string>>
 */
function loadBlacklist() {
  const sheet = getBlacklistSheet();
  const data = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const company = String(data[i][0] || '').trim();
    const pattern = String(data[i][1] || '').trim();
    if (company && pattern) {
      if (!map[company]) map[company] = new Set();
      map[company].add(normName(pattern));
    }
  }
  return map;
}

/**
 * 별칭 DB에서 매칭 시도 (정확/정규화 매칭)
 */
function matchByAlias(company, payerName, aliasMap) {
  if (!aliasMap[company]) return false;
  const patterns = aliasMap[company];
  if (patterns.has(payerName)) return true;
  if (patterns.has(normName(payerName))) return true;
  return false;
}

/**
 * 블랙리스트 체크 (정규화 후 비교)
 */
function isBlacklisted(company, payerName, blacklistMap) {
  if (!blacklistMap[company]) return false;
  return blacklistMap[company].has(normName(payerName));
}

/**
 * 별칭 추가 - 웹앱에서 호출
 */
function addAlias(company, pattern, writer, method) {
  try {
    const sheet = getAliasSheet();
    // 중복 체크
    const data = sheet.getDataRange().getValues();
    const normPattern = normName(pattern);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === company && normName(data[i][1]) === normPattern) {
        return { success: true, message: '이미 등록된 별칭', skipped: true };
      }
    }
    sheet.appendRow([
      company,
      pattern,
      new Date(),
      writer || '시스템',
      method || '수동'
    ]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * 블랙리스트 추가
 */
function addBlacklist(company, pattern, writer) {
  try {
    const sheet = getBlacklistSheet();
    const data = sheet.getDataRange().getValues();
    const normPattern = normName(pattern);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === company && normName(data[i][1]) === normPattern) {
        return { success: true, message: '이미 등록됨', skipped: true };
      }
    }
    sheet.appendRow([company, pattern, new Date(), writer || '시스템']);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * 별칭 삭제
 */
function removeAlias(company, pattern) {
  try {
    const sheet = getAliasSheet();
    const data = sheet.getDataRange().getValues();
    const normPattern = normName(pattern);
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === company && normName(data[i][1]) === normPattern) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: '찾을 수 없음' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * 별칭 DB 조회 (웹앱용)
 */
function getAliasesForWeb() {
  try {
    const sheet = getAliasSheet();
    const data = sheet.getDataRange().getValues();
    const groups = {};
    let total = 0;
    
    for (let i = 1; i < data.length; i++) {
      const company = String(data[i][0] || '').trim();
      if (!company) continue;
      const pattern = String(data[i][1] || '').trim();
      const date = data[i][2];
      const writer = String(data[i][3] || '');
      const method = String(data[i][4] || '');
      
      if (!groups[company]) groups[company] = [];
      groups[company].push({
        pattern: pattern,
        date: date instanceof Date ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(date || ''),
        writer: writer,
        method: method
      });
      total++;
    }
    
    // 정렬: 패턴 많은 순
    const sorted = Object.entries(groups)
      .map(([k, v]) => ({ company: k, patterns: v, count: v.length }))
      .sort((a, b) => b.count - a.count);
    
    return { total: total, companies: sorted.length, groups: sorted };
  } catch (e) {
    return { total: 0, companies: 0, groups: [], error: e.toString() };
  }
}

/**
 * 매칭 사전 통계 알림
 */
function showAliasStats() {
  const data = getAliasesForWeb();
  let msg = '🧠 매칭 사전 현황\n\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n';
  msg += '총 학습 별칭: ' + data.total + '건\n';
  msg += '학습된 거래처: ' + data.companies + '개\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';
  if (data.groups.length > 0) {
    msg += '📌 별칭 많은 거래처 TOP 5:\n';
    data.groups.slice(0, 5).forEach(g => {
      msg += '  ' + g.company + ' (' + g.count + '개)\n';
    });
  } else {
    msg += '아직 학습된 별칭이 없습니다.\n매핑 실행 후 매칭 확정하면 자동으로 학습됩니다.';
  }
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * 블랙리스트 통계
 */
function showBlacklistStats() {
  const sheet = getBlacklistSheet();
  const data = sheet.getDataRange().getValues();
  let msg = '🚫 블랙리스트 현황\n\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n';
  msg += '총 제외 항목: ' + (data.length - 1) + '건\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';
  if (data.length > 1) {
    msg += '최근 등록:\n';
    for (let i = Math.max(1, data.length - 5); i < data.length; i++) {
      msg += '  ' + data[i][0] + ' ↮ ' + data[i][1] + '\n';
    }
  } else {
    msg += '아직 제외 항목이 없습니다.';
  }
  SpreadsheetApp.getUi().alert(msg);
}

function parseNumber(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

// ════════════════════════════════════════════
// 3. 메인 매핑 실행 (심플 버전: 미수금_리스트 vs AR_원본 대조)
// 로직: 미수금_리스트에 있는 업체가 AR_원본에도 있으면 미수, 없으면 수금완료
// ════════════════════════════════════════════
// ════════════════════════════════════════════
// 3. 메인 매핑 실행 (3단계 로직)
// STEP 1: 미수금_리스트 파싱
// STEP 2: 수금_원본 매핑 (부분일치 포함) → 매핑되면 완료
// STEP 3: 미매핑건을 AR_원본과 대조
//          → AR에 있음: 미수
//          → AR에 없음: 수금완료 O
// ════════════════════════════════════════════
function runMapping() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ui  = SpreadsheetApp.getUi();
  const startTime = new Date();

  // ── 시트 확인 ──
  const sheetMisu   = ss.getSheetByName(CFG.SHEET_MISUGEUM);
  const sheetAR     = ss.getSheetByName(CFG.SHEET_AR);
  const sheetSugeun = ss.getSheetByName(CFG.SHEET_SUGEUN);
  const missing = [
    !sheetMisu   ? '미수금_리스트' : null,
    !sheetAR     ? 'AR_원본'      : null,
    !sheetSugeun ? '수금_원본'    : null,
  ].filter(Boolean).join(', ');
  if (missing) { ui.alert('❌ 시트 없음: ' + missing); return; }

  let sheetOutput = ss.getSheetByName(CFG.SHEET_OUTPUT);
  if (!sheetOutput) sheetOutput = ss.insertSheet(CFG.SHEET_OUTPUT);

  // ── STEP 1: 미수금_리스트 파싱 ──
  const misuData = sheetMisu.getDataRange().getValues().slice(1);
  const allRecords = misuData
    .filter(r => r[1] && r[2])
    .map((r, idx) => ({
      rowNum:   idx + 2,
      team:     String(r[0] || '').trim(),
      name:     String(r[1]).trim(),
      expected: parseNumber(r[2]),
      yn:       String(r[3] || '').trim(),
    }));

  // 이미 O인 건 → 기완료
  const alreadyDone  = allRecords.filter(r => r.yn === 'O' || r.yn === 'o' || r.yn === '○');
  const needsCheck   = allRecords.filter(r => r.yn !== 'O' && r.yn !== 'o' && r.yn !== '○');
  Logger.log('STEP1: 전체 ' + allRecords.length + '건 / 기완료 ' + alreadyDone.length + '건 / 체크필요 ' + needsCheck.length + '건');

  // ── STEP 2: 수금_원본 파싱 ──
  // 실제 구조: IDX(A) / 입금일자(B) / 은행계좌(C) / 세부계좌(D) / 금액(E) / 비고-입금주명(F)
  // 헤더 있음 (1행: IDX, 입금일자, 은행계좌, 세부계좌, 금액, 비고)
  const sugeunData = sheetSugeun.getDataRange().getValues();

  // 헤더에서 금액/입금주명 컬럼 자동 탐지
  const sgHeader = sugeunData[0].map(v => String(v || '').trim().toUpperCase());
  let colAmt   = sgHeader.findIndex(h => h.includes('금액') || h === 'AMOUNT');
  let colPayer = sgHeader.findIndex(h => h.includes('비고') || h.includes('입금주명') || h.includes('REMARK'));
  // 헤더 없는 경우 (A=업체명, B=금액)
  const hasHeader = sgHeader.some(h => ['IDX','금액','비고','AMOUNT','입금일자'].includes(h));
  if (!hasHeader) { colAmt = 1; colPayer = 0; }
  if (colAmt   < 0) colAmt   = 4;  // 기본값: E열
  if (colPayer < 0) colPayer = 5;  // 기본값: F열

  const sgStartRow = hasHeader ? 1 : 0;
  Logger.log('수금_원본 컬럼: 금액=' + colAmt + '(' + (sugeunData[0][colAmt]||'') + ') 입금주명=' + colPayer + '(' + (sugeunData[0][colPayer]||'') + ')');

  const payRows = [];
  for (let i = sgStartRow; i < sugeunData.length; i++) {
    const payer = String(sugeunData[i][colPayer] || '').replace(/-\d+$/, '').trim();
    const amt   = parseNumber(sugeunData[i][colAmt]);
    if (payer && amt > 0) payRows.push({ payer, amt });
  }
  Logger.log('STEP2: 수금_원본 ' + payRows.length + '건 / 샘플: ' + JSON.stringify(payRows.slice(0,2)));

  // 별칭DB + 블랙리스트 로드
  const aliasMap     = loadAliases();
  const blacklistMap = loadBlacklist();

  const sugeunMatched   = [];  // 수금_원본에서 매핑된 것
  const sugeunUnmatched = [];  // 수금_원본에 없는 것

  for (const rec of needsCheck) {
    // 0차: 별칭DB
    let matched = false;
    for (const p of payRows) {
      if (isBlacklisted(rec.name, p.payer, blacklistMap)) continue;
      if (matchByAlias(rec.name, p.payer, aliasMap)) {
        rec.matchedPayer = p.payer;
        rec.matchedAmt   = p.amt;
        rec.matchedBy    = '별칭DB';
        rec.matchedScore = 1.0;
        rec.autoLearned  = false;
        matched = true;
        break;
      }
    }
    if (matched) { sugeunMatched.push(rec); continue; }

    // 1차: 이름 유사도 0.85+
    let nameMatches = [];
    for (const p of payRows) {
      if (isBlacklisted(rec.name, p.payer, blacklistMap)) continue;
      const score = smartMatch(rec.name, p.payer);
      if (score >= CFG.NAME_HIGH_THRESHOLD) nameMatches.push({ ...p, score });
    }
    if (nameMatches.length > 0) {
      nameMatches.sort((a, b) => b.score - a.score);
      const best = nameMatches[0];
      rec.matchedPayer = best.payer;
      rec.matchedAmt   = nameMatches.reduce((s, m) => s + m.amt, 0);
      rec.matchedBy    = '이름';
      rec.matchedScore = best.score;
      rec.autoLearned  = best.score >= CFG.AUTO_LEARN_THRESHOLD;
      if (rec.autoLearned) addAlias(rec.name, best.payer, '자동학습', '자동(' + best.score.toFixed(2) + ')');
      sugeunMatched.push(rec);
      continue;
    }

    // 2차: 이름 0.70~0.85 + 금액 ±1%
    let amtMatches = [];
    for (const p of payRows) {
      if (isBlacklisted(rec.name, p.payer, blacklistMap)) continue;
      const score = smartMatch(rec.name, p.payer);
      if (score >= CFG.NAME_LOW_THRESHOLD && score < CFG.NAME_HIGH_THRESHOLD) {
        const diff = Math.abs(p.amt - rec.expected);
        if (diff <= Math.max(rec.expected * CFG.AMOUNT_TOLERANCE, 100)) {
          amtMatches.push({ ...p, score });
        }
      }
    }
    if (amtMatches.length > 0) {
      amtMatches.sort((a, b) => b.score - a.score);
      const best = amtMatches[0];
      rec.matchedPayer = best.payer;
      rec.matchedAmt   = best.amt;
      rec.matchedBy    = '이름+금액';
      rec.matchedScore = best.score;
      rec.autoLearned  = false;
      sugeunMatched.push(rec);
      continue;
    }

    sugeunUnmatched.push(rec);
  }
  Logger.log('STEP2 결과: 수금매핑 ' + sugeunMatched.length + '건 / 미매핑 ' + sugeunUnmatched.length + '건');

  // ── STEP 3: 미매핑건 → AR_원본 대조 ──
  // AR_원본 구조: A열=업체명, B열=AR금액 (헤더 없음, 1행부터 데이터)
  const arData = sheetAR.getDataRange().getValues();
  const arHead = arData[0].map(h => String(h).trim().toUpperCase());
  let arCompanyCol = arHead.findIndex(h => h.includes('COMPANY') || h.includes('업체명') || h.includes('거래처'));
  // 헤더 없으면 A열(0)이 업체명
  if (arCompanyCol < 0) arCompanyCol = 0;
  const arStartRow = arCompanyCol > 0 ? 1 : 0;  // 헤더 있으면 1행 스킵

  const arSet     = new Set();
  const arNormSet = new Set();
  for (let i = arStartRow; i < arData.length; i++) {
    const name = String(arData[i][arCompanyCol] || '').trim();
    if (name) { arSet.add(name); arNormSet.add(normName(name)); }
  }
  Logger.log('STEP3: AR_원본 ' + arSet.size + '개 업체 / 샘플: ' + JSON.stringify([...arSet].slice(0,3)));

  const arUnpaid    = [];  // AR에 있음 → 진짜 미수
  const arCompleted = [];  // AR에 없음 → 수금완료

  for (const rec of sugeunUnmatched) {
    const inAR = arSet.has(rec.name) || arNormSet.has(normName(rec.name));
    if (inAR) {
      arUnpaid.push(rec);    // 미수
    } else {
      arCompleted.push(rec); // AR에도 없음 → 완료
    }
  }
  Logger.log('STEP3 결과: AR미수 ' + arUnpaid.length + '건 / AR완료 ' + arCompleted.length + '건');

  // ── STEP 4: 결과 집계 ──
  const finalRecords = [];

  // 기완료
  for (const r of alreadyDone) {
    finalRecords.push([r.team, r.name, r.expected, r.expected, 0, 1.0, '완료', '기존완료', '']);
  }
  // 수금_원본 매핑 완료
  for (const r of sugeunMatched) {
    const ratio = r.matchedAmt > 0 ? Math.min(r.matchedAmt / r.expected, 1) : 1;
    finalRecords.push([
      r.team, r.name, r.expected,
      Math.min(r.matchedAmt || r.expected, r.expected),
      Math.max(r.expected - (r.matchedAmt || r.expected), 0),
      ratio,
      ratio >= 0.9 ? '완료' : '부분수금',
      '신규매칭',
      (r.matchedPayer || '') + ' (' + (r.matchedBy || '') + ')'
    ]);
    // 미수금_리스트 D열 O 자동 기록
    if (ratio >= 0.9) {
      try { sheetMisu.getRange(r.rowNum, 4).setValue('O'); } catch(e) {}
    }
  }
  // AR에 없음 → 완료
  for (const r of arCompleted) {
    finalRecords.push([r.team, r.name, r.expected, r.expected, 0, 1.0, '완료', 'AR완료', 'AR_원본에 없음']);
    try { sheetMisu.getRange(r.rowNum, 4).setValue('O'); } catch(e) {}
  }
  // 진짜 미수
  for (const r of arUnpaid) {
    finalRecords.push([
      r.team, r.name, r.expected, 0, r.expected, 0, '미수', '',
      r.expected >= CFG.HIGH_AMOUNT ? '고액미수' : ''
    ]);
  }

  // 정렬
  const statusOrder = { '미수': 0, '부분수금': 1, '완료': 2 };
  const teamOrder   = { 'B2D': 0, 'S1': 1, 'S2': 2, 'S3': 3 };
  finalRecords.sort((a, b) => {
    const so = (statusOrder[a[6]] ?? 9) - (statusOrder[b[6]] ?? 9);
    if (so !== 0) return so;
    return (teamOrder[a[0]] ?? 9) - (teamOrder[b[0]] ?? 9);
  });

  // ── STEP 5: 현재_수금데이터 업데이트 ──
  sheetOutput.clearContents();
  const headers = ['팀', '업체명', '예정금액', '입금금액', '차액', '수금률', '상태', '구분', '매칭근거'];
  sheetOutput.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheetOutput.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#ffffff');
  if (finalRecords.length > 0) {
    sheetOutput.getRange(2, 1, finalRecords.length, headers.length).setValues(finalRecords);
    sheetOutput.getRange(2, 3, finalRecords.length, 3).setNumberFormat('#,##0');
    sheetOutput.getRange(2, 6, finalRecords.length, 1).setNumberFormat('0%');
  }

  // ── STEP 6: 신규매칭_검증 시트 ──
  let sheetNewMatch = ss.getSheetByName(CFG.SHEET_NEW_MATCH);
  if (!sheetNewMatch) sheetNewMatch = ss.insertSheet(CFG.SHEET_NEW_MATCH);
  sheetNewMatch.clearContents();
  const nmHeaders = ['팀', '업체명', '예정금액', '매칭_입금주명', '입금금액', '유사도', '매칭방식', '학습상태'];
  sheetNewMatch.getRange(1, 1, 1, nmHeaders.length).setValues([nmHeaders]);
  sheetNewMatch.getRange(1, 1, 1, nmHeaders.length).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#fff');
  if (sugeunMatched.length > 0) {
    const nmData = sugeunMatched.sort((a, b) => (b.matchedAmt||0) - (a.matchedAmt||0)).map(r => {
      const ls = r.matchedBy === '별칭DB' ? '✓ 학습됨' : r.autoLearned ? '🤖 자동학습됨' : '⚠ 검증필요';
      return [r.team, r.name, r.expected, r.matchedPayer||'', r.matchedAmt||0, (r.matchedScore||0).toFixed(2), r.matchedBy||'', ls];
    });
    sheetNewMatch.getRange(2, 1, nmData.length, nmHeaders.length).setValues(nmData);
    sheetNewMatch.getRange(2, 3, nmData.length, 1).setNumberFormat('#,##0');
    sheetNewMatch.getRange(2, 5, nmData.length, 1).setNumberFormat('#,##0');
  }
  sheetNewMatch.setFrozenRows(1);

  // ── STEP 7: 미매칭_목록 업데이트 ──
  let sheetUM = ss.getSheetByName('미매칭_목록');
  if (!sheetUM) {
    sheetUM = ss.insertSheet('미매칭_목록');
    const umH = ['팀', '업체명', '담당자(입력)', '예정금액', '상태', '최초발견일', '처리상태'];
    sheetUM.getRange(1, 1, 1, umH.length).setValues([umH]);
    sheetUM.getRange(1, 1, 1, umH.length).setFontWeight('bold').setBackground('#f59e0b').setFontColor('#fff');
    [60,260,100,120,70,110,90].forEach((w, i) => sheetUM.setColumnWidth(i+1, w));
    sheetUM.setFrozenRows(1);
  }
  const umExisting = {};
  const umRows = sheetUM.getDataRange().getValues();
  for (let i = 1; i < umRows.length; i++) {
    const n = String(umRows[i][1] || '').trim();
    if (n) umExisting[n] = i + 1;
  }
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  for (const r of finalRecords) {
    const name = r[1], status = r[6];
    if (status === '완료') {
      if (umExisting[name]) {
        sheetUM.getRange(umExisting[name], 7).setValue('✅완료');
        sheetUM.getRange(umExisting[name], 1, 1, 7).setBackground('#d1fae5');
      }
    } else {
      if (umExisting[name]) {
        sheetUM.getRange(umExisting[name], 4).setValue(r[2]);
        sheetUM.getRange(umExisting[name], 5).setValue(status);
        sheetUM.getRange(umExisting[name], 7).setValue('⏳미완료');
        sheetUM.getRange(umExisting[name], 1, 1, 7).setBackground('#fef3c7');
      } else {
        sheetUM.appendRow([r[0], name, '', r[2], status, today, '⏳미완료']);
        const nr = sheetUM.getLastRow();
        sheetUM.getRange(nr, 1, 1, 7).setBackground('#fef3c7');
        sheetUM.getRange(nr, 4).setNumberFormat('#,##0');
        umExisting[name] = nr;
      }
    }
  }

  // ── 결과 알림 ──
  const totalExpected = finalRecords.reduce((s, r) => s + r[2], 0);
  const completedAmt  = finalRecords.filter(r => r[6] === '완료').reduce((s, r) => s + r[2], 0);
  const rate = totalExpected > 0 ? (completedAmt / totalExpected * 100) : 0;
  const elapsed = ((new Date() - startTime) / 1000).toFixed(1);

  ui.alert(
    '✅ 매핑 완료! (' + elapsed + '초)\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n' +
    'STEP1 기완료(기존O):  ' + alreadyDone.length + '건\n' +
    'STEP2 수금_원본 매핑: ' + sugeunMatched.length + '건\n' +
    'STEP3 AR없음→완료:   ' + arCompleted.length + '건\n' +
    'STEP3 AR있음→미수:   ' + arUnpaid.length + '건\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🎯 수금률: ' + rate.toFixed(1) + '%\n' +
    '완료: ' + finalRecords.filter(r => r[6]==='완료').length + '건 / ' +
    '미수: ' + arUnpaid.length + '건\n\n' +
    '📋 신규매칭_검증에서 ⚠ 검증필요 건 확인해주세요!'
  );
}

function getOverviewData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 시트 자동 탐색 (이름이 약간 달라도 찾기)
  const sheetOut   = findSheet(ss, [CFG.SHEET_OUTPUT, '현재_수금데이터', '현재수금데이터']);
  const sheetNew   = findSheet(ss, [CFG.SHEET_NEW_MATCH, '신규매칭_검증', '신규매칭검증']);
  const sheetCO    = findSheet(ss, [CFG.SHEET_CARRYOVER, '이월_확인', '이월확인']);
  const sheetMisu  = findSheet(ss, [CFG.SHEET_MISUGEUM, '미수금_리스트', '미수금리스트', 'Sheet1']);
  const sheetAR    = findSheet(ss, [CFG.SHEET_AR, 'AR_원본', 'AR원본']);
  
  // ⚠️ 현재_수금데이터 시트가 없으면 명확한 안내 반환
  if (!sheetOut) {
    return {
      meta: { now: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') },
      error: '먼저 [💰 수금 매핑 v5] 메뉴 → [▶ 매핑 실행]을 클릭해주세요!',
      kpi: emptyKpi(),
      teams: [], sales_list: [], high_value: [], new_matched: [], carryover: [],
      aging: emptyAging(), records: []
    };
  }
  
  // 출력 시트 데이터 (없으면 빈 배열)
  let outData = [];
  try {
    outData = sheetOut.getDataRange().getValues().slice(1);
  } catch (e) {
    return {
      meta: { now: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') },
      error: '현재_수금데이터 시트를 읽을 수 없습니다. 매핑을 다시 실행해주세요.',
      kpi: emptyKpi(),
      teams: [], sales_list: [], high_value: [], new_matched: [], carryover: [],
      aging: emptyAging(), records: []
    };
  }
  
  // AR_원본 ARDATE → 거래처별 경과일 매핑
  // 업체명 | ARDATE 컬럼 기준, 같은 거래처 여러 행이면 가장 오래된 것(경과일 최대) 사용
  const arDaysMap = {};
  try {
    const arRaw = sheetAR.getDataRange().getValues();
    const arHead = arRaw[0].map(h => String(h).trim().toUpperCase());
    const colCo   = arHead.indexOf('업체명') >= 0 ? arHead.indexOf('업체명') : 0;
    const colDate = arHead.indexOf('ARDATE');
    
    if (colDate >= 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = 1; i < arRaw.length; i++) {
        const name = String(arRaw[i][colCo] || '').trim();
        const raw  = arRaw[i][colDate];
        if (!name || !raw) continue;
        const arDate = raw instanceof Date ? raw : new Date(raw);
        if (isNaN(arDate.getTime())) continue;
        const days = Math.floor((today - arDate) / 86400000);
        if (!arDaysMap[name] || days > arDaysMap[name]) {
          arDaysMap[name] = days;   // 가장 오래된 건 기준
        }
      }
    }
  } catch(e) {}

  /**
   * 경과일 → Aging 버킷 분류 (월별 수금 사이클 기준)
   * 미수 거래처만 대상 (수금완료는 Aging 표시 불필요)
   */
  const calcAging = (days) => {
    if (days <= 7)  return '7일이내';
    if (days <= 14) return '14일이내';
    if (days <= 21) return '21일이내';
    if (days <= 30) return '30일이내';
    return '30일초과';
  };

  const records = outData
    .filter(r => r[1] && String(r[1]).trim() !== '합계')
    .map(r => {
      const name        = String(r[1] || '');
      // 정확 매칭 먼저, 없으면 정규화 매칭
      let overdueDays   = arDaysMap[name];
      if (overdueDays === undefined) {
        const norm = normName(name);
        for (const key in arDaysMap) {
          if (normName(key) === norm) { overdueDays = arDaysMap[key]; break; }
        }
      }
      overdueDays = overdueDays || 0;
      const agingBucket = calcAging(overdueDays);

      return {
        team:        String(r[0] || ''),
        name:        name,
        expected:    Number(r[2] || 0),
        paid:        Number(r[3] || 0),
        diff:        Number(r[4] || 0),
        rate:        Number(r[5] || 0),
        status:      String(r[6] || ''),
        gubun:       String(r[7] || ''),
        basis:       String(r[8] || ''),
        // 매칭 입금주명: basis에서 파싱 (형식: "입금주명 (매칭방식)")
        matched_payer: (function() {
          const b = String(r[8] || '');
          if (!b || b === '고액미수') return '';
          // "입금주명 (이름)" 형식에서 입금주명 추출
          const m = b.match(/^(.+?)\s*\([^)]+\)$/);
          return m ? m[1].trim() : (b.indexOf('(') < 0 ? b : '');
        })(),
        overdueDays: overdueDays,
        agingBucket: agingBucket,
      };
    });
  
  // ── 담당자 매핑 ──────────────────────────────────────────
  // A열=ISales(담당자코드), B열=업체명 구조 (헤더 자동 스킵)
  // ─────────────────────────────────────────────────────────
  const salesMap     = {};
  const salesMapNorm = {};

  const loadSalesSheet_ = (sheet) => {
    if (!sheet) return;
    const rows = sheet.getDataRange().getValues();
    for (const row of rows) {
      const a = String(row[0] || '').trim();
      const b = String(row[1] || '').trim();
      if (!a || !b) continue;
      // 헤더 스킵
      if (a.toUpperCase() === 'ISALES') continue;
      if (b.toUpperCase() === 'CUSTOMER COMPANY') continue;
      if (b === '업체명' || b === '팀명') continue;
      salesMap[b]               = a;
      salesMapNorm[normName(b)] = a;
    }
  };

  // 1) 담당자_DB 우선
  loadSalesSheet_(findSheet(ss, [CFG.SHEET_SALES_DB, '담당자_DB', '담당자DB']));
  Logger.log('담당자_DB 로드: ' + Object.keys(salesMap).length + '개');

  // 2) 미매칭_목록 C열 즉시 반영 (입력하면 웹앱 새로고침만으로 바로 반영)
  const sheetUM2 = ss.getSheetByName('미매칭_목록');
  if (sheetUM2) {
    const umRows = sheetUM2.getDataRange().getValues();
    for (const row of umRows) {
      const company = String(row[1] || '').trim(); // B열: 업체명
      const sales   = String(row[2] || '').trim(); // C열: 담당자(입력)
      if (!company || !sales || company === '업체명') continue;
      if (!salesMap[company] && !salesMapNorm[normName(company)]) {
        salesMap[company]               = sales;
        salesMapNorm[normName(company)] = sales;
      }
    }
    Logger.log('미매칭_목록 보완 후: ' + Object.keys(salesMap).length + '개');
  }

  // 3) 주문트래킹 보조
  const sheetOrderForSales = findSheet(ss, [CFG.SHEET_ORDER, '주문트래킹', '주문_트래킹']);
  if (sheetOrderForSales) {
    const orderRows = sheetOrderForSales.getDataRange().getValues();
    const cnt = {};
    for (const row of orderRows) {
      const a = String(row[0] || '').trim();
      const b = String(row[1] || '').trim();
      if (!a || !b || a.toUpperCase() === 'ISALES') continue;
      if (!cnt[b]) cnt[b] = {};
      cnt[b][a] = (cnt[b][a] || 0) + 1;
    }
    for (const company in cnt) {
      if (salesMap[company] || salesMapNorm[normName(company)]) continue;
      let max = 0, best = '';
      for (const s in cnt[company]) {
        if (cnt[company][s] > max) { max = cnt[company][s]; best = s; }
      }
      if (best) { salesMap[company] = best; salesMapNorm[normName(company)] = best; }
    }
  }
  Logger.log('최종 담당자 맵: ' + Object.keys(salesMap).length + '개');

  // 3) records에 담당자 적용 (정확 → 정규화 → 퍼지)
  for (const r of records) {
    const nm = normName(r.name);
    if (salesMap[r.name]) {
      r.sales = salesMap[r.name];
    } else if (salesMapNorm[nm]) {
      r.sales = salesMapNorm[nm];
    } else {
      let best = '', bestScore = 0;
      for (const k in salesMap) {
        const score = similarityScore(r.name, k);
        if (score > bestScore) { bestScore = score; best = salesMap[k]; }
      }
      r.sales = bestScore >= 0.85 ? best : '';
    }
  }
  Logger.log('담당자 매핑: ' + records.filter(r => r.sales).length + '/' + records.length + '개');

  // ★ 미수금_리스트 D열(수금여부) 실시간 반영
  // 확정 버튼으로 O 표시된 것을 매핑 재실행 없이 즉시 수금률에 반영
  let liveUpdated = 0;
  if (sheetMisu) {
    try {
      const misuData = sheetMisu.getDataRange().getValues();
      const misuMap = {};  // { 정규화업체명: 수금여부 }
      for (let i = 1; i < misuData.length; i++) {
        const name = String(misuData[i][1] || '').trim();
        const yn   = String(misuData[i][3] || '').trim();
        if (name) misuMap[normName(name)] = yn;
      }
      // records status 실시간 업데이트
      for (const r of records) {
        const yn = misuMap[normName(r.name)];
        if ((yn === 'O' || yn === 'o' || yn === '○') && r.status !== '완료') {
          Logger.log('실시간반영: ' + r.name + ' status ' + r.status + ' → 완료 (D열=' + yn + ')');
          r.status = '완료';
          liveUpdated++;
        }
      }
      Logger.log('실시간 반영 건수: ' + liveUpdated + ' / misuMap 크기: ' + Object.keys(misuMap).length);
    } catch(e) { Logger.log('실시간반영 오류: ' + e.toString()); }
  }
  // ★ 수금률 = 현재_수금데이터 F열(수금률) 평균값 (시트 기준)
  // F열: 완료=1(100%), 미수=0(0%), 부분수금=0.xx
  const ov_totalExpected  = records.reduce((s, r) => s + r.expected, 0);
  const ov_completedRecs  = records.filter(r => r.status === '완료');
  const ov_newMatchedRecs = records.filter(r => r.gubun === '신규매칭');
  const ov_partialRecs    = records.filter(r => r.status === '부분수금');
  const ov_unpaidRecs     = records.filter(r => r.status === '미수');

  // F열 rate 평균 (0~1 소수이면 *100, 이미 % 정수이면 그대로)
  const rateValues = records.map(r => r.rate).filter(v => !isNaN(v) && v !== null);
  const avgRate = rateValues.length > 0 ? rateValues.reduce((s, v) => s + v, 0) / rateValues.length : 0;
  // F열이 0~1 소수인지 0~100 정수인지 판단
  const rate = avgRate <= 1 ? Math.round(avgRate * 1000) / 10 : Math.round(avgRate * 10) / 10;

  // 금액 기준은 시트 그대로
  const completedAmt  = ov_completedRecs.reduce((s, r) => s + r.expected, 0)
                      + ov_partialRecs.reduce((s, r) => s + r.paid, 0);
  const newMatchedAmt = ov_newMatchedRecs.reduce((s, r) => s + r.paid, 0);
  const unpaidAmt     = ov_unpaidRecs.reduce((s, r) => s + r.expected, 0)
                      + ov_partialRecs.reduce((s, r) => s + r.diff, 0);

  Logger.log('수금률(F열평균): ' + rate + '% / rateValues 샘플: ' + JSON.stringify(rateValues.slice(0,5)));
  
  // 이월 데이터
  const carryoverRecords = [];
  if (sheetCO) {
    const coData = sheetCO.getDataRange().getValues().slice(1);
    for (const row of coData) {
      if (row[1]) {
        const name = String(row[1]);
        carryoverRecords.push({
          team: String(row[0] || ''),
          name: name,
          amount: Number(row[2] || 0),
          sales: salesMap[name] || '',
        });
      }
    }
  }
  carryoverRecords.sort((a, b) => b.amount - a.amount);
  
  // 신규 매칭 (검증용)
  const newMatchDetails = [];
  if (sheetNew) {
    const nmData = sheetNew.getDataRange().getValues().slice(1);
    for (const row of nmData) {
      if (row[1]) {
        const name = String(row[1]);
        const learnStatus = String(row[7] || '');
        newMatchDetails.push({
          team: String(row[0] || ''),
          name: name,
          expected: Number(row[2] || 0),
          matched_payer: String(row[3] || ''),
          paid: Number(row[4] || 0),
          score: Number(row[5] || 0),
          matched_by: String(row[6] || ''),
          auto_learned: learnStatus.indexOf('자동학습') >= 0 || learnStatus.indexOf('학습됨') >= 0,
          sales: salesMap[name] || '',
        });
      }
    }
  }
  
  // 팀별 통계
  const teamStats = {};
  for (const t of ['B2D', 'S1', 'S2', 'S3']) {
    teamStats[t] = { team: t, cnt: 0, remain_cnt: 0, old: 0, completed: 0, remain: 0 };
  }
  for (const r of records) {
    if (!teamStats[r.team]) continue;
    teamStats[r.team].cnt++;
    teamStats[r.team].old += r.expected;
    if (r.status === '완료') {
      teamStats[r.team].completed += r.expected;
    } else {
      teamStats[r.team].remain += r.expected;
      teamStats[r.team].remain_cnt++;
    }
  }
  const teams = Object.values(teamStats).map(t => ({
    ...t,
    rate: t.old > 0 ? Math.round(t.completed / t.old * 1000) / 10 : 0
  }));
  
  // 담당자별 통계 (미매칭도 포함 → AR 총액 = 담당자별 합계 보장)
  const salesStats = {};
  for (const r of records) {
    const s = r.sales || '미매칭';
    if (!salesStats[s]) salesStats[s] = { sales: s, cnt: 0, remain_cnt: 0, old: 0, completed: 0, remain: 0 };
    salesStats[s].cnt++;
    salesStats[s].old += r.expected;
    if (r.status === '완료') {
      salesStats[s].completed += r.expected;
    } else {
      salesStats[s].remain += r.expected;
      salesStats[s].remain_cnt++;
    }
  }
  // 담당자 있는 것 + 미매칭 그룹 모두 포함 (AR 총액 검증용)
  const salesList = Object.values(salesStats)
    .map(s => ({ ...s, rate: s.old > 0 ? Math.round(s.completed / s.old * 1000) / 10 : 0 }))
    .sort((a, b) => {
      // 미매칭은 맨 뒤
      if (a.sales === '미매칭') return 1;
      if (b.sales === '미매칭') return -1;
      return b.old - a.old;
    });
  
  // 합계 검증 로그 (AR 총액 = 담당자별 합계 확인)
  const salesTotal = salesList.reduce((sum, s) => sum + s.old, 0);
  Logger.log(`AR 총액 검증: 전체 ${ov_totalExpected} / 담당자별 합계 ${salesTotal} / 일치: ${ov_totalExpected === salesTotal}`);
  
  // 고액 미수
  const highValue = ov_unpaidRecs
    .filter(r => r.expected >= CFG.HIGH_AMOUNT)
    .map(r => ({ name: r.name, team: r.team, sales: r.sales, amount: r.expected, overdueDays: r.overdueDays, agingBucket: r.agingBucket }))
    .sort((a, b) => b.amount - a.amount);
  
  // Aging 통계 (미수 거래처만)
  const agingStats = {
    '7일이내':  { count: 0, amount: 0 },
    '14일이내': { count: 0, amount: 0 },
    '21일이내': { count: 0, amount: 0 },
    '30일이내': { count: 0, amount: 0 },
    '30일초과': { count: 0, amount: 0 },
  };
  for (const r of ov_unpaidRecs) {
    if (agingStats[r.agingBucket]) {
      agingStats[r.agingBucket].count++;
      agingStats[r.agingBucket].amount += r.expected;
    }
  }
  
  return {
    meta: { now: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') },
    kpi: {
      analyzed_count: records.length,
      analyzed_amt: ov_totalExpected,
      completed_count: ov_completedRecs.length,
      completed_amt: completedAmt,
      unpaid_count: ov_unpaidRecs.length + ov_partialRecs.length,
      unpaid_amt: unpaidAmt,
      partial_count: ov_partialRecs.length,
      new_matched_count: ov_newMatchedRecs.length,
      new_matched_amt: newMatchedAmt,
      removed_count: carryoverRecords.length,
      removed_amt: carryoverRecords.reduce((s, r) => s + r.amount, 0),
      original_o_count: ov_completedRecs.length - ov_newMatchedRecs.filter(r => r.status === '완료').length,
      rate: Math.round(rate * 10) / 10,
      rate_base: CFG.RATE_BASE,
    },
    teams: teams,
    sales_list: salesList,
    high_value: highValue,
    new_matched: newMatchDetails,
    carryover: carryoverRecords,
    aging: agingStats,
    records: records,
  };
}

function getChartData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.SHEET_CHART);
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  const result = { labels: [], w0: [], w1: [], w2: [], w3: [], fin: [] };
  let currentYear = '';
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) currentYear = String(row[0]).replace('년', '').trim();
    if (row[1] && currentYear) {
      const month = String(row[1]).replace('월', '').trim().padStart(2, '0');
      result.labels.push(currentYear + '-' + month);
      result.w0.push(row[5] ? Math.round(row[5] * 100) : null);
      result.w1.push(row[6] ? Math.round(row[6] * 100) : null);
      result.w2.push(row[7] ? Math.round(row[7] * 100) : null);
      result.w3.push(row[8] ? Math.round(row[8] * 100) : null);
      result.fin.push(row[9] ? Math.round(row[9] * 100) : null);
    }
  }
  
  // ★ 완전히 빈 마지막 행들 제거 (예: 신규 월 row가 추가됐지만 데이터 미입력)
  while (result.labels.length > 0) {
    const i = result.labels.length - 1;
    if (result.w0[i] === null && result.w1[i] === null &&
        result.w2[i] === null && result.w3[i] === null && result.fin[i] === null) {
      result.labels.pop(); result.w0.pop(); result.w1.pop();
      result.w2.pop(); result.w3.pop(); result.fin.pop();
    } else {
      break;
    }
  }

  // 평균 (마지막 월 제외 - 현재 진행중인 달 제외)
  const avg = arr => {
    const valid = arr.slice(0, -1).filter(v => v !== null);
    return valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : 0;
  };
  result.avg = {
    w0: avg(result.w0),
    w1: avg(result.w1),
    w2: avg(result.w2),
    w3: avg(result.w3),
    fin: avg(result.fin),
  };

  // 전월 동기 / 전년 동기 비교
  // ★ 안전장치: 마지막 행이 빈 데이터(신규 월 row)면 그 앞의 유효한 마지막 인덱스 사용
  let lastIdx = result.labels.length - 1;
  while (lastIdx > 0 &&
         result.w0[lastIdx] === null && result.w1[lastIdx] === null &&
         result.w2[lastIdx] === null && result.w3[lastIdx] === null &&
         result.fin[lastIdx] === null) {
    lastIdx--;
  }
  const prevIdx  = lastIdx - 1;
  const yoyIdx   = lastIdx - 12;

  // 현재 달의 최신 회수율 (fin → w3 → w2 → w1 → w0 순으로 있는 것)
  const currentRate = result.fin[lastIdx] ?? result.w3[lastIdx] ?? result.w2[lastIdx] ?? result.w1[lastIdx] ?? result.w0[lastIdx] ?? null;

  // 전월 최종 회수율
  const prevRate = (prevIdx >= 0) ? (result.fin[prevIdx] ?? result.w3[prevIdx] ?? null) : null;

  // 전년 동기 (같은 주차 기준으로 비교)
  const yoyRate = (yoyIdx >= 0) ? (result.fin[yoyIdx] ?? result.w3[yoyIdx] ?? null) : null;

  // ★ 비율 값 유효성 검증 (0~100 범위 벗어나면 무효 처리 - 비정상 데이터 방지)
  const isValidRate = (v) => v !== null && !isNaN(v) && v >= 0 && v <= 100;
  const safeCurrentRate = isValidRate(currentRate) ? currentRate : null;
  const safePrevRate    = isValidRate(prevRate)    ? prevRate    : null;
  const safeYoyRate     = isValidRate(yoyRate)     ? yoyRate     : null;

  Logger.log('차트 비교: lastIdx=' + lastIdx + ' label=' + result.labels[lastIdx] +
             ' current=' + safeCurrentRate + ' prev=' + safePrevRate + ' yoy=' + safeYoyRate);

  result.comparison = {
    current:     safeCurrentRate,
    prev_label:  prevIdx >= 0 ? result.labels[prevIdx] : null,
    prev_rate:   safePrevRate,
    prev_diff:   (safeCurrentRate !== null && safePrevRate !== null) ? Math.round((safeCurrentRate - safePrevRate) * 10) / 10 : null,
    yoy_label:   yoyIdx >= 0 ? result.labels[yoyIdx] : null,
    yoy_rate:    safeYoyRate,
    yoy_diff:    (safeCurrentRate !== null && safeYoyRate !== null) ? Math.round((safeCurrentRate - safeYoyRate) * 10) / 10 : null,
    avg_w0: result.avg.w0,
    avg_fin: result.avg.fin,
  };

  return result;
}

// ════════════════════════════════════════════
// 5. 수금 완료 처리 (실시간 시트 업데이트)
// ════════════════════════════════════════════

/**
 * 거래처를 수금 완료('O')로 표시 + 입금주명 자동 학습
 */
function markAsCompleted(companyName, writerName, payerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_MISUGEUM);
    if (!sheet) return { success: false, error: '미수금_리스트 시트 없음' };
    
    const data = sheet.getDataRange().getValues();
    let found = false;
    let rowNum = -1;
    
    // 정확 매칭 우선
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(companyName).trim()) {
        rowNum = i + 1;
        found = true;
        break;
      }
    }
    
    // 못 찾으면 정규화 매칭
    if (!found) {
      const targetNorm = normName(companyName);
      for (let i = 1; i < data.length; i++) {
        if (normName(data[i][1]) === targetNorm) {
          rowNum = i + 1;
          found = true;
          break;
        }
      }
    }
    
    if (!found) return { success: false, error: '거래처를 찾을 수 없음: ' + companyName };
    
    sheet.getRange(rowNum, 4).setValue('O');
    Logger.log('markAsCompleted: "' + companyName + '" → 미수금_리스트 ' + rowNum + '행 D열에 O 기록 (시트상 업체명="' + data[rowNum-1][1] + '")');
    
    // ✨ 역방향 학습: payerName이 함께 들어오면 별칭 DB에도 자동 등록
    let learned = false;
    if (payerName && payerName.trim() && payerName !== companyName) {
      const aliasResult = addAlias(companyName, payerName.trim(), writerName || '시스템', '수금완료_확정');
      if (aliasResult.success && !aliasResult.skipped) learned = true;
    }
    
    addComment(companyName, '✓ 수금 완료 처리' + (learned ? ' (별칭 학습: ' + payerName + ')' : ''), writerName || '시스템');
    
    return { success: true, row: rowNum, learned: learned, message: companyName + ' 수금완료 처리됨' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * 신규매칭_검증에서 매칭 확정 - 별칭 학습 + 수금완료 + 현재_수금데이터 즉시 반영
 */
function confirmMatch(companyName, payerName, writerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1) 별칭 DB 등록
    addAlias(companyName, payerName, writerName || '시스템', '수동확정');

    // 2) 미수금_리스트 수금여부 'O' 표시
    const completeResult = markAsCompleted(companyName, writerName, payerName);

    // 3) 현재_수금데이터 시트 해당 행 즉시 업데이트
    const sheetOut = findSheet(ss, [CFG.SHEET_OUTPUT, '현재_수금데이터']);
    if (sheetOut) {
      const data = sheetOut.getDataRange().getValues();
      const normTarget = normName(companyName);
      for (let i = 1; i < data.length; i++) {
        const name = String(data[i][1] || '').trim();
        if (name === companyName || normName(name) === normTarget) {
          sheetOut.getRange(i + 1, 7).setValue('완료');  // G열: 상태
          sheetOut.getRange(i + 1, 8).setValue('신규매칭'); // H열: 구분
          sheetOut.getRange(i + 1, 9).setValue(payerName + ' (수동확정)'); // I열: 매칭근거
          break;
        }
      }
    }

    return {
      success: true,
      aliasLearned: true,
      completed: completeResult.success
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * 신규매칭_검증에서 매칭 거부 - 블랙리스트 추가
 */
function rejectMatch(companyName, payerName, writerName) {
  try {
    const result = addBlacklist(companyName, payerName, writerName || '시스템');
    return result;
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * 수금 완료 취소 (O → 빈칸)
 */
function unmarkCompleted(companyName, writerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_MISUGEUM);
    if (!sheet) return { success: false, error: '미수금_리스트 시트 없음' };
    
    const data = sheet.getDataRange().getValues();
    let rowNum = -1;
    const targetNorm = normName(companyName);
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(companyName).trim() || normName(data[i][1]) === targetNorm) {
        rowNum = i + 1;
        break;
      }
    }
    
    if (rowNum < 0) return { success: false, error: '거래처를 찾을 수 없음' };
    
    sheet.getRange(rowNum, 4).clearContent();
    addComment(companyName, '⟲ 수금완료 취소됨 (웹앱)', writerName || '시스템');
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ════════════════════════════════════════════
// 6. 댓글 시스템 (기존 유지)
// ════════════════════════════════════════════
function getComments(companyName) {
  try {
    if (!companyName) return [];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_COMMENT);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const comments = [];
    const searchName = String(companyName).trim();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[1]).trim() === searchName) {
        const dateStr = row[0] instanceof Date ?
          Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(row[0]);
        comments.push({
          date: dateStr,
          name: String(row[1] || ''),
          comment: String(row[2] || ''),
          author: String(row[3] || '익명')
        });
      }
    }
    return comments;
  } catch (e) { return []; }
}

function addComment(companyName, comment, writerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CFG.SHEET_COMMENT);
    if (!sheet) {
      sheet = ss.insertSheet(CFG.SHEET_COMMENT);
      sheet.getRange(1, 1, 1, 4).setValues([['날짜', '업체명', '댓글', '작성자']]);
    }
    const author = (writerName && writerName.trim()) ? writerName : Session.getActiveUser().getEmail();
    sheet.appendRow([new Date(), companyName, comment, author]);
    return { success: true };
  } catch (e) { return { success: false, error: e.toString() }; }
}

// ════════════════════════════════════════════
// 6. 요약 메뉴
// ════════════════════════════════════════════
/**
 * 미매칭_목록의 C열(담당자) 입력값을 담당자_DB에 일괄 저장
 * 메뉴에서 실행 또는 웹앱 버튼에서 호출
 */
function learnSalesFromUnmatched() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ui  = SpreadsheetApp.getUi();
  const sheetUM = ss.getSheetByName('미매칭_목록');
  if (!sheetUM) { ui.alert('미매칭_목록 시트가 없습니다. 먼저 매핑 실행!'); return; }

  // 담당자_DB 시트
  let sheetDB = findSheet(ss, [CFG.SHEET_SALES_DB, '담당자_DB', '담당자DB']);
  if (!sheetDB) {
    sheetDB = ss.insertSheet(CFG.SHEET_SALES_DB);
    sheetDB.getRange(1, 1, 1, 2).setValues([['ISales', 'Customer Company']]);
  }

  // 기존 담당자_DB 업체명 목록 (중복 방지)
  const existing = new Set();
  const dbRows = sheetDB.getDataRange().getValues();
  for (let i = 1; i < dbRows.length; i++) {
    const b = String(dbRows[i][1] || '').trim();
    if (b) existing.add(normName(b));
  }

  // 미매칭_목록에서 C열(담당자) 입력된 것만 추출
  const umRows = sheetUM.getDataRange().getValues();
  let learned = 0, skipped = 0;

  for (let i = 1; i < umRows.length; i++) {
    const company = String(umRows[i][1] || '').trim(); // B열: 업체명
    const sales   = String(umRows[i][2] || '').trim(); // C열: 담당자 (입력)
    const status  = String(umRows[i][6] || '').trim(); // G열: 처리상태

    if (!company || !sales || status === '✅완료') { skipped++; continue; }

    // 담당자_DB에 없으면 추가
    if (!existing.has(normName(company))) {
      sheetDB.appendRow([sales, company]);
      existing.add(normName(company));

      // 미매칭_목록 → 완료 처리
      sheetUM.getRange(i + 1, 7).setValue('✅완료');
      sheetUM.getRange(i + 1, 1, 1, 7).setBackground('#d1fae5');
      learned++;
    } else {
      skipped++;
    }
  }

  ui.alert(
    '✅ 담당자 학습 완료!\n\n' +
    '━━━━━━━━━━━━━━━━━━━━\n' +
    '담당자_DB 저장: ' + learned + '건\n' +
    '스킵(이미 있음): ' + skipped + '건\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '다음 매핑 실행 시 자동으로 반영됩니다!'
  );
}

/**
 * 미매칭 현황 요약
 */
function showUnmatchedSales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('미매칭_목록');
  if (!sheet) { SpreadsheetApp.getUi().alert('미매칭_목록 없음. 매핑 실행 먼저!'); return; }

  const data = sheet.getDataRange().getValues().slice(1);
  const pending  = data.filter(r => String(r[6]).trim() !== '✅완료');
  const resolved = data.filter(r => String(r[6]).trim() === '✅완료');

  const teamCount = {};
  for (const r of pending) {
    const t = r[0] || '미상';
    teamCount[t] = (teamCount[t] || 0) + 1;
  }

  let msg = '👤 담당자 미매칭 현황\n\n';
  msg += '⏳ 미완료: ' + pending.length + '개사\n';
  msg += '✅ 완료:   ' + resolved.length + '개사\n\n';
  if (pending.length > 0) {
    msg += '팀별 미완료:\n';
    for (const t of ['B2D','S1','S2','S3']) {
      if (teamCount[t]) msg += '  ' + t + ': ' + teamCount[t] + '개사\n';
    }
    msg += '\n📋 처리 방법:\n';
    msg += '  1. 미매칭_목록 시트 C열에 담당자 코드 입력\n';
    msg += '  2. 메뉴 → [📥 담당자 학습 저장] 클릭\n';
    msg += '  3. 다음 매핑부터 자동 반영!';
  } else {
    msg += '🎉 모든 거래처에 담당자가 매핑됐습니다!';
  }
  SpreadsheetApp.getUi().alert(msg);
}

function showSummary() {
  const data = getOverviewData();
  const k = data.kpi;
  const teams = data.teams.slice().sort((a, b) => b.rate - a.rate);
  
  SpreadsheetApp.getUi().alert(
    '📊 수금 현황 요약\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '🎯 수금률: ' + k.rate + '%\n' +
    '   (월말 ' + k.rate_base + '% → +' + (k.rate - k.rate_base).toFixed(1) + '%p)\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '분석 대상: ' + k.analyzed_count + '건 / ' + (k.analyzed_amt/1e8).toFixed(2) + '억\n' +
    '  ├ 완료: ' + k.completed_count + '건 (신규 ' + k.new_matched_count + '건 포함)\n' +
    '  └ 미수: ' + k.unpaid_count + '건 / ' + (k.unpaid_amt/1e8).toFixed(2) + '억\n\n' +
    '이월: ' + k.removed_count + '건 / ' + (k.removed_amt/1e8).toFixed(2) + '억\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '🏆 팀별 순위:\n' +
    teams.map((t, i) => '  ' + (i+1) + '. ' + t.team + ' ' + t.rate + '%').join('\n')
  );
}

/** OPS Portal JSON helpers - added by Codex. */
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

