const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const file = path.resolve(__dirname, '../app/components/RequestDetailModal.tsx');
const source = fs.readFileSync(file, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
let updates = 0;
const moduleObject = { exports: {} };
const mockRequire = id => id === '../services/requestStorage'
  ? { updateRequest: () => { updates++; throw new Error('Link rendering must not update requests'); } }
  : require(id);
new Function('require', 'module', 'exports', output)(mockRequire, moduleObject, moduleObject.exports);
const Modal = moduleObject.exports.RequestDetailModal;
const base = { id: 'link-test', type: 'test', status: '요청접수', requester: 'test', requestedAt: '2026-09-29' };
const expected = {
  revisedTaxInvoice: 'https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=H4600000000',
  reverseIssueApproval: 'https://www2.smartbill.co.kr/xMain/mb/mb_login/login.aspx?SourcePage=/xDti/no_conf/my/com_list.aspx?'
};
for (const [kind, url] of Object.entries(expected)) {
  const html = renderToStaticMarkup(React.createElement(Modal, { request: { ...base, kind }, canProcess: true, onClose() {} }));
  assert.ok(html.includes(`href="${url.replaceAll('&', '&amp;')}"`));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('referrerPolicy="no-referrer"'));
  assert.ok(html.includes('처리중') && html.includes('반려') && html.includes('완료'));
  const readOnly = renderToStaticMarkup(React.createElement(Modal, { request: { ...base, kind }, canProcess: false, onClose() {} }));
  assert.ok(!readOnly.includes('target="_blank"'));
}
const other = renderToStaticMarkup(React.createElement(Modal, { request: { ...base, kind: 'cardPayment' }, canProcess: true, onClose() {} }));
assert.ok(!other.includes('target="_blank"'));
assert.equal(updates, 0);
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let linkCount = 0;
function visit(node) {
  if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === 'a') {
    linkCount++;
    assert.ok(!node.attributes.properties.some(attribute => attribute.name?.getText(ast).startsWith('on')));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(linkCount, 1);
console.log('PASS: both supplied URLs, processing-role visibility, unrelated types unchanged, new-tab isolation, no link handlers or status writes. SSR/static checks only.');
