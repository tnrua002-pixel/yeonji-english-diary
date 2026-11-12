/* QR 코드 만들기 — 외부 라이브러리 없이 앱 안에서 그려요.
 * 바이트 모드, 오류 정정 M, 버전 1~10 (주소 200자 정도까지). 표준(ISO/IEC 18004) 순서를 그대로 따라요.
 * 브라우저: window.QR.svg(text, label) / 점검(node): require('./qr.js')
 */
(function (root) {
  'use strict';

  // 오류 정정 M: 버전별 (블록마다 오류 정정 바이트 수, 블록 수)
  const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const ECL_FORMAT_BITS = 0; // M (L=1, M=0, Q=3, H=2)

  function rawDataModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver) {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
  }

  // GF(2^8) 곱셈 (기약 다항식 0x11D)
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let rootVal = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], rootVal);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      rootVal = gfMul(rootVal, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
    }
    return result;
  }

  function utf8(text) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
    return Array.from(unescape(encodeURIComponent(text)), (c) => c.charCodeAt(0));
  }

  // 1) 글자 → 데이터 바이트 (+ 버전 고르기)
  function encodeData(text) {
    const bytes = utf8(text);
    let ver = 1;
    for (; ver <= 10; ver++) {
      const need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= dataCodewords(ver) * 8) break;
    }
    if (ver > 10) throw new Error('QR 코드로 만들기에는 글자가 너무 길어요.');
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(0x4, 4); // 바이트 모드
    put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach((b) => put(b, 8));
    const cap = dataCodewords(ver) * 8;
    put(0, Math.min(4, cap - bits.length)); // 끝 표시
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }
    return { ver, data };
  }

  // 2) 블록으로 나누고 오류 정정 바이트를 붙여 섞어요
  function addEccAndInterleave(data, ver) {
    const numBlocks = NUM_BLOCKS[ver];
    const eccLen = ECC_PER_BLOCK[ver];
    const raw = Math.floor(rawDataModules(ver) / 8);
    const numShort = numBlocks - (raw % numBlocks);
    const shortLen = Math.floor(raw / numBlocks);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const datLen = shortLen - eccLen + (i < numShort ? 0 : 1);
      const dat = data.slice(k, k + datLen);
      k += datLen;
      const ecc = rsRemainder(dat, div);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((blk, j) => {
        if (i !== shortLen - eccLen || j >= numShort) result.push(blk[i]);
      });
    }
    return result;
  }

  function alignmentPositions(ver, size) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < n; pos -= step) result.splice(1, 0, pos);
    return result;
  }
  function formatBits(mask) {
    const data = (ECL_FORMAT_BITS << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }
  function versionBits(ver) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (ver << 12) | rem;
  }
  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  // 3) 모듈(검은/흰 칸) 배치
  function build(text) {
    const { ver, data } = encodeData(text);
    const codewords = addEccAndInterleave(data, ver);
    const size = ver * 4 + 17;
    const mod = [];
    const fn = [];
    for (let y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const set = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); } // 타이밍
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
        }
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const align = alignmentPositions(ver, size);
    const na = align.length;
    for (let i = 0; i < na; i++) {
      for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
    const drawFormat = (mask) => {
      const bits = formatBits(mask);
      const bit = (i) => ((bits >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0); // 자리만 먼저 잡아 둬요
    if (ver >= 7) {
      const bits = versionBits(ver);
      for (let i = 0; i < 18; i++) {
        const dark = ((bits >>> i) & 1) !== 0;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        set(a, b, dark); set(b, a, dark);
      }
    }
    // 데이터를 지그재그로 채워요
    let k = 0;
    const total = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && k < total) {
            mod[y][x] = ((codewords[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0;
            k++;
          }
        }
      }
    }
    // 가장 읽기 좋은 마스크를 골라요
    const applyMask = (m) => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
    };
    let best = 0;
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      const score = penalty(mod, size);
      if (score < bestScore) { best = m; bestScore = score; }
      applyMask(m);
    }
    applyMask(best);
    drawFormat(best);
    return { ver, size, mask: best, modules: mod, codewords };
  }

  function penalty(mod, size) {
    let score = 0;
    const finderLike = [true, false, true, true, true, false, true];
    const lineScore = (line) => {
      let s = 0;
      let color = null;
      let run = 0;
      for (let i = 0; i < size; i++) {
        if (line[i] === color) { run++; if (run === 5) s += 3; else if (run > 5) s += 1; } else { color = line[i]; run = 1; }
      }
      for (let i = 0; i + 7 <= size; i++) {
        let same = true;
        for (let t = 0; t < 7; t++) if (line[i + t] !== finderLike[t]) { same = false; break; }
        if (!same) continue;
        const lightBefore = [1, 2, 3, 4].every((d) => i - d < 0 || !line[i - d]);
        const lightAfter = [0, 1, 2, 3].every((d) => i + 7 + d >= size || !line[i + 7 + d]);
        if (lightBefore || lightAfter) s += 40;
      }
      return s;
    };
    for (let y = 0; y < size; y++) score += lineScore(mod[y]);
    for (let x = 0; x < size; x++) score += lineScore(mod.map((row) => row[x]));
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) score += 3;
      }
    }
    let dark = 0;
    mod.forEach((row) => row.forEach((v) => { if (v) dark++; }));
    const totalCells = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - totalCells * 10) / totalCells) - 1) * 10;
    return score;
  }

  // 4) SVG로 그려요 (가장자리 여백 4칸, 흰 바탕에 검은 칸)
  function svg(text, label) {
    const { size, modules } = build(text);
    const q = 4;
    const dim = size + q * 2;
    let d = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) d += `M${x + q},${y + q}h1v1h-1z`;
    const aria = String(label || 'QR 코드').replace(/[&<>"]/g, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="${aria}">`
      + `<rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  const api = { svg, build, _test: { gfMul, rsDivisor, rsRemainder, formatBits, versionBits, alignmentPositions, encodeData, addEccAndInterleave, dataCodewords } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QR = api;
}(typeof window !== 'undefined' ? window : this));
