// public/qr.js 점검: 표준 표의 값과 비교하고, 따로 만든 해독기로 다시 읽어 봐요.
const path = require('path');
const QR = require(process.argv[2] || path.join(__dirname, '..', 'public', 'qr.js'));
const T = QR._test;
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };

// 1) 리드-솔로몬: 'HELLO WORLD' 1-M 예제의 데이터 → 알려진 오류 정정 바이트
const hw = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
check('RS 1-M HELLO WORLD', JSON.stringify(T.rsRemainder(hw, T.rsDivisor(10))) === JSON.stringify([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]), T.rsRemainder(hw, T.rsDivisor(10)));

// 2) 형식 정보 (M, 마스크 0~7) 표준 표
const FORMAT_M = ['101010000010010', '101000100100101', '101111001111100', '101101101001011', '100010111111001', '100000011001110', '100111110010111', '100101010100000'];
for (let m = 0; m < 8; m++) check(`format M${m}`, T.formatBits(m).toString(2).padStart(15, '0') === FORMAT_M[m], T.formatBits(m).toString(2));

// 3) 버전 정보 (7~10) 표준 표
const VER = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };
for (const v of Object.keys(VER)) check(`version ${v}`, T.versionBits(+v) === VER[v], T.versionBits(+v).toString(16));

// 4) 정렬 패턴 위치, 데이터 바이트 수
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
for (let v = 1; v <= 10; v++) check(`align v${v}`, JSON.stringify(T.alignmentPositions(v, v * 4 + 17)) === JSON.stringify(ALIGN[v]), T.alignmentPositions(v, v * 4 + 17));
const DATA_M = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
for (let v = 1; v <= 10; v++) check(`data codewords v${v}`, T.dataCodewords(v) === DATA_M[v - 1], T.dataCodewords(v));

// 5) 따로 만든 해독기 (표준 블록 표·정렬 위치·읽는 순서를 이 파일에서 직접 정의)
const BLOCKS_M = { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] };
const MASK = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
function decode(M) {
  const size = M.length;
  const ver = (size - 17) / 4;
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) isFn[y][x] = true; };
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) mark(x, y);
  for (let y = 0; y < 9; y++) for (let x = size - 8; x < size; x++) mark(x, y);
  for (let y = size - 8; y < size; y++) for (let x = 0; x < 9; x++) mark(x, y);
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  const ap = ALIGN[ver];
  const last = ap[ap.length - 1];
  for (const ay of ap) for (const ax of ap) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === last) || (ax === last && ay === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(ax + dx, ay + dy);
  }
  if (ver >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { mark(size - 11 + j, i); mark(i, size - 11 + j); }
  // 형식 정보 (두 곳 모두 읽어서 같은지)
  const g = (x, y) => (M[y][x] ? 1 : 0);
  let f1 = 0;
  const pos1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  pos1.forEach(([x, y], i) => { f1 |= g(x, y) << i; });
  let f2 = 0;
  for (let i = 0; i < 8; i++) f2 |= g(size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) f2 |= g(8, size - 15 + i) << i;
  if (f1 !== f2) throw new Error('format copies differ');
  const fmt = (f1 ^ 0x5412) >> 10;
  if (fmt >> 3 !== 0) throw new Error('not level M');
  const mask = fmt & 7;
  if (!M[size - 8][8]) throw new Error('dark module missing');
  // 데이터 읽기 (오른쪽 아래부터 두 줄씩, 위·아래 번갈아)
  const bits = [];
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const y = upward ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (!isFn[y][x]) bits.push((M[y][x] ? 1 : 0) ^ (MASK[mask](x, y) ? 1 : 0));
      }
    }
    upward = !upward;
  }
  const [ecc, groups] = BLOCKS_M[ver];
  const blocks = [];
  groups.forEach(([count, len]) => { for (let i = 0; i < count; i++) blocks.push({ len, data: [], ecc: [] }); });
  const totalCw = blocks.reduce((n, b) => n + b.len + ecc, 0);
  const cw = [];
  for (let i = 0; i < totalCw; i++) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j]; cw.push(v); }
  let p = 0;
  const maxLen = Math.max(...blocks.map((b) => b.len));
  for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.len) b.data.push(cw[p++]);
  for (let i = 0; i < ecc; i++) for (const b of blocks) b.ecc.push(cw[p++]);
  const div = T.rsDivisor(ecc);
  blocks.forEach((b, i) => { if (JSON.stringify(T.rsRemainder(b.data, div)) !== JSON.stringify(b.ecc)) throw new Error(`ecc mismatch in block ${i}`); });
  const data = [].concat(...blocks.map((b) => b.data));
  const dbits = [];
  data.forEach((v) => { for (let i = 7; i >= 0; i--) dbits.push((v >> i) & 1); });
  let q = 0;
  const read = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | dbits[q++]; return v; };
  if (read(4) !== 4) throw new Error('not byte mode');
  const len = read(ver < 10 ? 8 : 16);
  const out = [];
  for (let i = 0; i < len; i++) out.push(read(8));
  // 찾기 패턴 모양
  const FINDER = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    if (g(x, y) !== +FINDER[y][x] || g(size - 7 + x, y) !== +FINDER[y][x] || g(x, size - 7 + y) !== +FINDER[y][x]) throw new Error('finder pattern wrong');
  }
  return { ver, mask, text: new TextDecoder().decode(Uint8Array.from(out)) };
}

const samples = ['A', 'HELLO WORLD', 'https://yeonjidiary.pythonanywhere.com/#/join/ABC123', '연지쌤 영어 다이어리 참여 코드 테스트'];
for (const n of [14, 15, 26, 27, 42, 43, 62, 63, 84, 85, 106, 107, 122, 123, 152, 153, 180, 181, 200, 213]) samples.push('x'.repeat(n - 1) + String(n % 10));
const masksSeen = new Set();
for (const s of samples) {
  try {
    const built = QR.build(s);
    const r = decode(built.modules);
    masksSeen.add(r.mask);
    check(`roundtrip len ${s.length} (v${r.ver})`, r.text === s, { got: r.text.slice(0, 40) });
  } catch (e) {
    check(`roundtrip len ${s.length}`, false, e.message);
  }
}
let tooLong = false;
try { QR.build('x'.repeat(214)); } catch (e) { tooLong = true; }
check('214자는 너무 길다고 알려 줌', tooLong);
const svg = QR.svg('https://example.com/', 'test');
check('SVG 모양', svg.startsWith('<svg') && svg.includes('viewBox="0 0 33 33"') && svg.includes('<path d="M'), svg.slice(0, 80));
console.log(`QR 점검: ${pass}개 통과, ${fail}개 실패 (사용된 마스크: ${[...masksSeen].sort().join(',')})`);
process.exit(fail ? 1 : 0);
