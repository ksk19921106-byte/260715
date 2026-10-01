const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { closingStages, buildClosingReport } = require('./app/services/opsClosingReport.ts');
const stages = closingStages('2026-09');
assert.deepEqual(stages.map(s => s.date), ['2026-09-03','2026-09-06','2026-09-09','2026-09-10']);
function record(index, status, extra = {}) {
  return { cycle:'2026-08', date:stages[index].date, task:stages[index].id, subject:'Owen', status, evidence:[], updatedBy:'Robin', updatedAt:stages[index].date+'T01:00:00Z', ...extra };
}
function report(records, today = '2026-09-10') { return buildClosingReport(records,'2026-09',['Owen'],today)[0]; }
assert.equal(report([]).result,'평가 대기');
assert.equal(report([record(0,'complete')]).first.label,'1차');
assert.equal(report([record(0,'complete')]).checks[1].record,undefined);
assert.equal(report([record(0,'incomplete'),record(2,'complete')]).first.label,'3차');
assert.equal(report([record(0,'complete'),record(2,'incomplete')]).result,'재확인 필요');
assert.equal(report([record(0,'complete'),record(2,'auto')]).result,'자동 재판정 대기');
assert.equal(report([record(0,'auto')]).first,undefined);
assert.equal(report([record(0,'complete',{updatedAt:'2026-09-04T00:00:00Z'})]).first.lateEntry,true);
assert.equal(report([record(0,'complete',{updatedAt:'2026-09-03T15:00:00Z'})]).first.lateEntry,true);
assert.equal(report([record(2,'complete')],'2026-09-06').first,undefined);
assert.equal(report([record(0,'complete',{cycle:'2026-07'})]).first,undefined);
assert.equal(report([record(0,'complete',{subject:'Harvey'})]).first,undefined);
assert.equal(report([record(0,'complete',{task:'month-end-review'})]).first,undefined);
assert.equal(report([record(0,'complete'),record(0,'auto',{updatedAt:'2026-09-04T00:00:00Z'})]).first,undefined);
assert.equal(buildClosingReport([], '2026-09', [], '2026-09-10').length,0);
console.log('PASS: schedule, scope, first completion, reopening, resets, late entry, future and missing records');
