/* 영어 내신 문제 도구 — 화면 동작 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const CIRC = ['①', '②', '③', '④', '⑤'];
  let currentTab = 'cloze';
  let unitData = null; // 현재 단원 데이터

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));
  }

  function rng() { return QLogic.mulberry32(Date.now() % 2147483647 + Math.floor(Math.random() * 1e6)); }

  /* ── 프로필·단원 선택 ─────────────────── */
  function profile() {
    return window.QREG.profiles.find((p) => p.id === $('selProfile').value);
  }

  function fillProfiles() {
    $('selProfile').innerHTML = window.QREG.profiles
      .map((p) => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
    fillUnits();
  }

  function fillUnits() {
    const p = profile();
    $('selUnit').innerHTML = p.units
      .map((u) => `<option value="${esc(u.id)}">${esc(u.label)}</option>`).join('');
    loadUnit();
  }

  function loadUnit() {
    const p = profile();
    const u = p.units.find((x) => x.id === $('selUnit').value);
    const key = p.id + '/' + u.id;
    unitData = null;
    clearSheets();
    window.QUNITS = window.QUNITS || {};
    if (window.QUNITS[key]) { unitData = window.QUNITS[key]; onUnitReady(); return; }
    const s = document.createElement('script');
    s.src = 'data/' + p.id + '/' + u.file;
    s.onload = () => {
      unitData = window.QUNITS[key] || null;
      if (!unitData) alert('단원 데이터를 읽지 못했습니다: ' + key);
      onUnitReady();
    };
    s.onerror = () => alert('단원 파일을 찾을 수 없습니다: data/' + p.id + '/' + u.file);
    document.body.appendChild(s);
  }

  function onUnitReady() {
    if (!unitData) return;
    if (currentTab === 'passage') renderPassage();
    if (currentTab === 'analysis') renderAnalysis();
  }

  /* ── 공통 렌더 ─────────────────── */
  function sheetHead(subtitle) {
    const p = profile();
    const u = p.units.find((x) => x.id === $('selUnit').value);
    return `<div class="sheet-head">
      <h2>${esc(subtitle)}</h2>
      <div class="sub">${esc(p.label)} · ${esc(u.label)}</div>
      <div class="name-line">학년/반: <span></span> 이름: <span></span></div>
    </div>`;
  }

  function clearSheets() {
    $('sheetQ').innerHTML = '';
    $('sheetA').innerHTML = '';
    $('actionbar').classList.add('hidden');
    $('emptyMsg').classList.remove('hidden');
  }

  function showSheets(qHtml, aHtml) {
    $('sheetQ').innerHTML = qHtml;
    $('sheetA').innerHTML = aHtml;
    $('sheetA').classList.add('hidden-screen');
    $('actionbar').classList.remove('hidden');
    $('emptyMsg').classList.add('hidden');
  }

  /* ── 1. 빈칸 암기지 ─────────────────── */
  function genCloze() {
    const rate = parseFloat($('clozeRate').value);
    const hint = $('clozeHint').checked;
    const showKo = $('clozeKo').checked;
    const r = rng();
    let q = sheetHead('본문 빈칸 암기지');
    let a = sheetHead('본문 빈칸 암기지 — 정답');
    unitData.passage.forEach((s, i) => {
      const tokens = QLogic.makeCloze(s.en, rate, r);
      const line = tokens.map((t) => {
        if (!t.blank) return esc(t.text);
        const before = t.text.slice(0, t.text.indexOf(t.core));
        const after = t.text.slice(t.text.indexOf(t.core) + t.core.length);
        const shown = hint
          ? t.core[0] + '_'.repeat(Math.max(t.core.length - 1, 2))
          : '&nbsp;'.repeat(Math.max(t.core.length * 2, 8));
        return esc(before) + `<span class="blank${hint ? ' hint-mode' : ''}">${hint ? esc(shown) : shown}</span>` + esc(after);
      }).join(' ');
      q += `<div class="cloze-line"><span class="cloze-num">${i + 1}.</span><span class="cloze-en">${line}</span>` +
        (showKo ? `<div class="cloze-ko">${esc(s.ko)}</div>` : '') + `</div>`;
      const answers = tokens.filter((t) => t.blank).map((t) => t.core).join(', ');
      a += `<div class="a-item"><b>${i + 1}.</b> <span class="a-ans">${esc(answers) || '(빈칸 없음)'}</span><div class="a-exp">${esc(s.en)}</div></div>`;
    });
    showSheets(q, a);
  }

  /* ── 2. 단어 시험 ─────────────────── */
  function genWord() {
    const n = parseInt($('wordCount').value, 10);
    const dir = $('wordDir').value;
    const r = rng();
    if (dir === 'memo') {
      // 암기장: 단어와 뜻을 같이 인쇄 (본문 등장 순서 유지)
      let idxs = unitData.words.map((_, i) => i);
      if (n < idxs.length) idxs = QLogic.pickN(idxs, n, r).sort((x, y) => x - y);
      const title = '단어 암기장 (' + idxs.length + '개)';
      let q = sheetHead(title);
      q += `<table class="word-table"><tr><th>번호</th><th>단어</th><th>뜻</th></tr>`;
      idxs.forEach((wi, i) => {
        const w = unitData.words[wi];
        q += `<tr><td class="no">${i + 1}</td><td>${esc(w.en)}</td><td class="ans">${esc(w.ko)}</td></tr>`;
      });
      q += `</table>`;
      showSheets(q, sheetHead(title) + '<p>암기장은 정답지가 따로 없습니다. (문제지 인쇄를 사용하세요)</p>');
      return;
    }
    const items = QLogic.makeWordTest(unitData.words, n, dir, r);
    const title = '단어 시험 (' + items.length + '문항)';
    if (items.length < n) {
      alert('이 단원의 단어장에는 ' + unitData.words.length + '개가 있어 ' + items.length + '문항으로 만듭니다.');
    }
    let q = sheetHead(title);
    q += `<table class="word-table"><tr><th>번호</th><th>문제</th><th>답</th></tr>`;
    // 정답지도 시험지와 같은 표 형식 — 답 칸에 정답이 채워진 형태
    let a = sheetHead(title + ' — 정답');
    a += `<table class="word-table"><tr><th>번호</th><th>문제</th><th>답</th></tr>`;
    items.forEach((it, i) => {
      q += `<tr><td class="no">${i + 1}</td><td>${esc(it.prompt)}</td><td class="ans word-ans" data-ans="${esc(it.answer)}"></td></tr>`;
      a += `<tr><td class="no">${i + 1}</td><td>${esc(it.prompt)}</td><td class="ans"><span class="a-ans">${esc(it.answer)}</span></td></tr>`;
    });
    q += `</table>`;
    a += `</table>`;
    q += `<p class="no-print" style="margin-top:8px;font-size:12px;color:#64748b">💡 화면에서 답 칸을 누르면 정답이 보입니다 (다시 누르면 숨김 · 인쇄에는 나오지 않음)</p>`;
    showSheets(q, a);
  }

  /* ── 3. 시험지 (문제은행) ─────────────────── */
  function genExam() {
    const mcN = parseInt($('examMc').value, 10);
    const shN = parseInt($('examShort').value, 10);
    if (mcN + shN === 0) { alert('문항 수를 1개 이상 골라주세요.'); return; }
    const doShuffle = $('examShuffle').checked;
    const round = parseInt($('examRound').value, 10);
    const mcAll = unitData.bank.filter((x) => x.type === 'mc');
    const shAll = unitData.bank.filter((x) => x.type === 'short');
    let r, mcPool, shPool;
    if (round > 0) {
      // 회차 모드: 단원 고유 시드로 은행을 4등분해 회차끼리 문제가 겹치지 않게 하고,
      // 같은 회차는 언제 뽑아도 같은 시험지가 나온다
      const splitR = QLogic.mulberry32(unitSeed(7));
      mcPool = roundSlice(mcAll, 4, round, splitR);
      shPool = roundSlice(shAll, 4, round, splitR);
      r = QLogic.mulberry32(unitSeed(round));
    } else {
      mcPool = mcAll;
      shPool = shAll;
      r = rng();
    }
    if ((mcN > 0 && mcPool.length < mcN) || (shN > 0 && shPool.length < shN)) {
      alert((round > 0 ? '이 회차에는' : '이 단원 문제은행에는') + ' 객관식 ' + mcPool.length + '개, 서술형 ' + shPool.length + '개가 있어 그 범위 안에서 만듭니다.');
    }
    let selected = QLogic.pickN(mcPool, mcN, r).concat(QLogic.pickN(shPool, shN, r));
    if (doShuffle) {
      selected = selected.map((qq) => (qq.type === 'mc' ? QLogic.shuffleChoices(qq, r) : qq));
    }
    const examTitle = '영어 내신 대비 평가' + (round > 0 ? ' — ' + round + '회차' : '');
    let q = sheetHead(examTitle);
    let a = sheetHead(examTitle + ' (정답 및 해설)');
    const secs = Array.isArray(unitData.sections) && unitData.sections.length ? unitData.sections : null;
    if (!secs) {
      // 구간 정보가 없는 단원: 본문 전체 + 문제 나열 (기존 방식)
      q += `<div class="passage-box"><div class="direction">※ 다음 글을 읽고 물음에 답하시오.</div>` +
        unitData.passage.map((s) => esc(s.en)).join(' ') + `</div>`;
      selected.forEach((qq, i) => {
        const it = renderExamItem(qq, i + 1);
        q += it.qh; a += it.ah;
      });
    } else {
      // 구간별 출력: [지문 조각 → 그 구간의 문제들] 반복. F=지문 전체 참고, V=지문 불필요
      const groups = secs.map((s) => ({ id: s.id, start: s.start, end: s.end }))
        .concat([{ id: 'F' }, { id: 'V' }]);
      let num = 0;
      groups.forEach((g) => {
        const qs = selected.filter((x) => (x.sec || 'V') === g.id);
        if (!qs.length) return;
        const first = num + 1;
        const last = num + qs.length;
        const range = first === last ? `(${first})` : `(${first}~${last})`;
        if (g.id === 'F') {
          q += `<div class="direction-line">※ 위 지문 전체를 참고하여 물음에 답하시오. ${range}</div>`;
        } else if (g.id === 'V') {
          q += `<div class="direction-line">※ 다음 물음에 답하시오. ${range}</div>`;
        } else {
          q += `<div class="passage-box"><div class="direction">※ 다음 글을 읽고 물음에 답하시오. ${range}</div>` +
            unitData.passage.slice(g.start, g.end + 1).map((s) => esc(s.en)).join(' ') + `</div>`;
        }
        qs.forEach((qq) => {
          num++;
          const it = renderExamItem(qq, num);
          q += it.qh; a += it.ah;
        });
      });
    }
    showSheets(q, a);
  }

  /* 시험지 문항 1개 렌더 (문제지·정답지 HTML 한 쌍) */
  function renderExamItem(qq, num) {
    let qh = `<div class="q-item"><div class="q-text"><span class="q-num">${num}.</span>${esc(qq.q)} <span class="pts">[${qq.points}점]</span></div>`;
    let ah;
    if (qq.type === 'mc') {
      qh += `<ol class="choices">` + qq.choices.map((c, j) => `<li>${CIRC[j]} ${esc(c)}</li>`).join('') + `</ol>`;
      ah = `<div class="a-item"><b>${num}.</b> <span class="a-ans">${CIRC[qq.answer]} ${esc(qq.choices[qq.answer])}</span><div class="a-exp">${esc(qq.explain || '')}</div></div>`;
    } else {
      qh += `<div class="write-box"></div>`;
      ah = `<div class="a-item"><b>${num}.</b> <span class="a-ans">${esc(qq.answer)}</span><div class="a-exp">${esc(qq.explain || '')}</div></div>`;
    }
    qh += `</div>`;
    return { qh: qh, ah: ah };
  }

  /* ── 4. 워크북 (7가지 유형 + 전체) ─────────────────── */
  const WB_LABEL = {
    trans: '해석 쓰기', vocab: '어휘 선택', gram: '어법 선택', verb: '동사 바꾸기',
    fix: '어법 오류 수정', insert: '문장 삽입', order: '순서 배열',
  };
  const WB_DIR = {
    trans: '주어진 영어 문장을 한글로 해석하시오.',
    vocab: '괄호 안에서 문맥상 적절한 것을 고르시오.',
    gram: '괄호 안에서 어법상 적절한 것을 고르시오.',
    verb: '괄호 안의 동사를 어법상 알맞은 형태로 고치시오.',
    fix: '다음 문장에서 어법상 어색한 부분을 찾아 바르게 고치시오.',
    insert: '글의 흐름상 주어진 문장이 들어가기에 가장 적절한 곳을 고르시오.',
    order: '주어진 글 다음에 이어질 글의 순서를 쓰시오.',
  };

  const WB_TYPES = ['trans', 'vocab', 'gram', 'verb', 'fix', 'insert', 'order'];
  const WB_ROUNDS = 4;          // 워크북 회차 수
  const WB_PER_TYPE_ROUND = 6;  // 회차 모드에서 유형당 문항 수 (7유형 × 6 = 42문항)

  // pool에서 n개를 뽑아 원래 순서(정렬 키)대로 돌려준다
  function wbPick(pool, n, r, keyFn) {
    const picked = QLogic.pickN(pool, Math.min(n, pool.length), r);
    return keyFn ? picked.sort((x, y) => keyFn(x) - keyFn(y)) : picked;
  }

  // 연속 windowLen문장 창의 시작점 목록 (본문 전체가 이어지는 글이므로 구간 경계도 넘을 수 있음)
  function wbAllStarts(windowLen) {
    const starts = [];
    for (let i = 0; i + windowLen - 1 < unitData.passage.length; i++) starts.push(i);
    return starts;
  }

  // 시작점 풀에서 n개 선택: 겹치지 않는 창을 먼저 채우고, 부족하면 겹치는 창도 허용
  function wbPickStarts(startsPool, n, windowLen, r) {
    const shuffled = QLogic.shuffle(startsPool, r);
    const chosen = [];
    for (const st of shuffled) {
      if (chosen.length >= n) break;
      if (chosen.every((c) => Math.abs(c - st) >= windowLen)) chosen.push(st);
    }
    for (const st of shuffled) {
      if (chosen.length >= n) break;
      if (!chosen.includes(st)) chosen.push(st);
    }
    return chosen.sort((x, y) => x - y);
  }

  // 해석 쓰기 — pool: 문장 인덱스 배열
  function wbTrans(pool, n, r) {
    const idxs = wbPick(pool, n, r, (x) => x);
    let q = '', a = '';
    idxs.forEach((pi, i) => {
      const s = unitData.passage[pi];
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${i + 1}.</span>${esc(s.en)}</div><div class="write-box"></div></div>`;
      a += `<div class="a-item"><b>${i + 1}.</b> ${esc(s.en)}<div class="a-exp"><span class="a-ans">${esc(s.ko)}</span></div></div>`;
    });
    return { q: q, a: a, n: idxs.length };
  }

  // 어휘 선택 / 어법 선택 공용 — pool: [{i, o(정답), x(오답)}]
  function wbChoice(pool, n, r) {
    const sel = wbPick(pool, n, r, (p) => p.i);
    let q = '', a = '';
    sel.forEach((p, k) => {
      const s = unitData.passage[p.i].en;
      const flip = r() < 0.5;
      const box = `<b>( ${esc(flip ? p.x : p.o)} / ${esc(flip ? p.o : p.x)} )</b>`;
      const shown = esc(s).replace(esc(p.o), box);
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${k + 1}.</span>${shown}</div></div>`;
      a += `<div class="a-item"><b>${k + 1}.</b> <span class="a-ans">${esc(p.o)}</span></div>`;
    });
    return { q: q, a: a, n: sel.length };
  }

  // 동사 바꾸기 — pool: [{i, o(정답 형태), b(원형)}]
  function wbVerbFrag(pool, n, r) {
    const sel = wbPick(pool, n, r, (p) => p.i);
    let q = '', a = '';
    sel.forEach((p, k) => {
      const s = unitData.passage[p.i].en;
      const shown = esc(s).replace(esc(p.o), `<b>( ${esc(p.b)} )</b>`);
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${k + 1}.</span>${shown}</div></div>`;
      a += `<div class="a-item"><b>${k + 1}.</b> <span class="a-ans">${esc(p.o)}</span></div>`;
    });
    return { q: q, a: a, n: sel.length };
  }

  // 어법 오류 수정 — wbGram의 오답형을 문장에 심고 찾아 고치게 한다
  function wbFix(pool, n, r) {
    const sel = wbPick(pool, n, r, (p) => p.i);
    let q = '', a = '';
    sel.forEach((p, k) => {
      const s = unitData.passage[p.i].en;
      const shown = esc(s).replace(esc(p.o), esc(p.x));
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${k + 1}.</span>${shown}</div><div class="write-box" style="height:34px"></div></div>`;
      a += `<div class="a-item"><b>${k + 1}.</b> <span class="a-ans">${esc(p.x)} → ${esc(p.o)}</span></div>`;
    });
    return { q: q, a: a, n: sel.length };
  }

  // 문장 삽입 — 연속 5문장 중 하나(2~4번째)를 빼서 들어갈 위치를 고르게 한다
  function wbInsert(startsPool, n, r) {
    const chosen = wbPickStarts(startsPool, n, 5, r);
    let q = '', a = '';
    chosen.forEach((st, i) => {
      const k = 1 + Math.floor(r() * 3);
      const given = unitData.passage[st + k].en;
      const remain = [0, 1, 2, 3, 4].filter((d) => d !== k).map((d) => unitData.passage[st + d].en);
      let flow = '';
      remain.forEach((sen, j) => { flow += ` ( ${CIRC[j]} ) ${esc(sen)}`; });
      flow += ` ( ${CIRC[4]} )`;
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${i + 1}.</span>[주어진 문장] <b>${esc(given)}</b></div>` +
        `<div style="margin:6px 0 0 14px">${flow}</div></div>`;
      a += `<div class="a-item"><b>${i + 1}.</b> <span class="a-ans">${CIRC[k]}</span></div>`;
    });
    return { q: q, a: a, n: chosen.length };
  }

  // 순서 배열 — 연속 4문장(주어진 글 1 + A·B·C 섞기)
  function wbOrder(startsPool, n, r) {
    const chosen = wbPickStarts(startsPool, n, 4, r);
    const LET = ['(A)', '(B)', '(C)'];
    let q = '', a = '';
    chosen.forEach((st, i) => {
      const rest = [unitData.passage[st + 1], unitData.passage[st + 2], unitData.passage[st + 3]];
      let perm = QLogic.shuffle([0, 1, 2], r);
      let guard = 0;
      while (perm.join() === '0,1,2' && guard < 10) { perm = QLogic.shuffle([0, 1, 2], r); guard++; }
      if (perm.join() === '0,1,2') perm = [1, 0, 2];
      const answer = [0, 1, 2].map((orig) => LET[perm.indexOf(orig)]).join(' - ');
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${i + 1}.</span>[주어진 글] ${esc(unitData.passage[st].en)}</div>`;
      perm.forEach((origIdx, j) => {
        q += `<div style="margin:6px 0 0 14px">${LET[j]} ${esc(rest[origIdx].en)}</div>`;
      });
      q += `<div style="margin:10px 0 0 14px">답: (      ) - (      ) - (      )</div></div>`;
      a += `<div class="a-item"><b>${i + 1}.</b> <span class="a-ans">${esc(answer)}</span></div>`;
    });
    return { q: q, a: a, n: chosen.length };
  }

  // 단원별 고정 시드 (회차 분할·고정 시험지용)
  function unitSeed(extra) {
    const key = $('selProfile').value + '/' + $('selUnit').value;
    let h = 0;
    for (let ci = 0; ci < key.length; ci++) h = (h * 31 + key.charCodeAt(ci)) >>> 0;
    return (h + (extra || 0)) >>> 0;
  }

  // 배열을 고정 시드로 섞어 rounds등분한 뒤 round(1부터)번째 조각을 돌려준다
  function roundSlice(arr, rounds, round, seedRng) {
    const mixed = QLogic.shuffle(arr, seedRng);
    const per = Math.ceil(mixed.length / rounds);
    return mixed.slice((round - 1) * per, round * per);
  }

  function genWorkbook() {
    const type = $('wbType').value;
    const cnt = parseInt($('wbCount').value, 10);
    const round = parseInt($('wbRound').value, 10);
    const gramAll = Array.isArray(unitData.wbGram) ? unitData.wbGram : [];
    const vocabAll = Array.isArray(unitData.wbVocab) ? unitData.wbVocab : [];
    const verbAll = Array.isArray(unitData.wbVerb) ? unitData.wbVerb : [];

    // 유형별 풀 구성. 무작위: 전체 풀 / 회차: 고정 시드로 4등분한 조각
    let r, pools, perType;
    const transAll = unitData.passage.map((_, i) => i);
    const insAll = wbAllStarts(5);
    const ordAll = wbAllStarts(4);
    if (round > 0) {
      const splitR = QLogic.mulberry32(unitSeed(101));
      const gramR = roundSlice(gramAll, WB_ROUNDS, round, splitR);
      const half = Math.ceil(gramR.length / 2);
      pools = {
        trans: roundSlice(transAll, WB_ROUNDS, round, splitR),
        vocab: roundSlice(vocabAll, WB_ROUNDS, round, splitR),
        gram: gramR.slice(0, half),
        fix: gramR.slice(half),
        verb: roundSlice(verbAll, WB_ROUNDS, round, splitR),
        insert: roundSlice(insAll, WB_ROUNDS, round, splitR),
        order: roundSlice(ordAll, WB_ROUNDS, round, splitR),
      };
      r = QLogic.mulberry32(unitSeed(200 + round));
      perType = WB_PER_TYPE_ROUND;
    } else {
      r = rng();
      // 전체 모드에서 어법 선택·오류 수정이 같은 문장을 쓰지 않도록 반씩 나눈다
      const mixed = QLogic.shuffle(gramAll, r);
      const half = Math.ceil(mixed.length / 2);
      pools = {
        trans: transAll, vocab: vocabAll,
        gram: type === 'all' ? mixed.slice(0, half) : gramAll,
        fix: type === 'all' ? mixed.slice(half) : gramAll,
        verb: verbAll, insert: insAll, order: ordAll,
      };
      perType = cnt;
    }

    function runOne(t, n) {
      const pool = pools[t];
      if (!pool || !pool.length) return null;
      if (t === 'trans') return wbTrans(pool, n, r);
      if (t === 'vocab' || t === 'gram') return wbChoice(pool, n, r);
      if (t === 'verb') return wbVerbFrag(pool, n, r);
      if (t === 'fix') return wbFix(pool, n, r);
      if (t === 'insert') return wbInsert(pool, n, r);
      if (t === 'order') return wbOrder(pool, n, r);
      return null;
    }

    const roundTag = round > 0 ? ' — ' + round + '회차' : '';
    if (type !== 'all') {
      const frag = runOne(type, perType);
      if (!frag) { alert('이 단원에는 아직 [' + WB_LABEL[type] + '] 데이터가 없습니다. (단원 등록 시 함께 만듭니다)'); return; }
      const title = '워크북 — ' + WB_LABEL[type] + roundTag;
      let q = sheetHead(title);
      q += `<div class="direction-line">※ ${WB_DIR[type]} (1~${frag.n})</div>` + frag.q;
      showSheets(q, sheetHead(title + ' (정답)') + frag.a);
      return;
    }
    const title = '워크북 — 전체 유형' + roundTag;
    let q = sheetHead(title);
    let a = sheetHead(title + ' (정답)');
    let secNo = 0;
    WB_TYPES.forEach((t) => {
      const frag = runOne(t, perType);
      if (!frag || !frag.n) return;
      secNo++;
      q += `<h3 class="sec-head">${secNo}. ${WB_LABEL[t]}</h3><div class="direction-line">※ ${WB_DIR[t]} (1~${frag.n})</div>` + frag.q;
      a += `<h3 class="sec-head">${secNo}. ${WB_LABEL[t]}</h3>` + frag.a;
    });
    showSheets(q, a);
  }

  /* ── PDF로 저장 (문제지 → 새 페이지 → 정답지) ─────────────────── */
  async function saveSheets() {
    if (!$('sheetQ').innerHTML.trim()) { alert('먼저 [만들기]를 눌러 자료를 만들어 주세요.'); return; }
    if (typeof window.html2pdf !== 'function') {
      alert('PDF 변환 도구를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.');
      return;
    }
    const p = profile();
    const u = p.units.find((x) => x.id === $('selUnit').value);
    const d = new Date();
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const head = $('sheetQ').querySelector('.sheet-head h2');
    const fname = ('영어문제_' + u.label + '_' + (head ? head.textContent : '자료') + '_' + stamp + '.pdf')
      .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ');

    // 화면 시트를 복제해 인쇄용 모양(테두리·여백 제거)으로 만든 뒤 PDF로 변환
    const root = document.createElement('div');
    root.style.cssText = 'width:700px;background:#fff;color:#222;font-family:"Malgun Gothic","맑은 고딕",sans-serif;';
    const qClone = $('sheetQ').cloneNode(true);
    const aClone = $('sheetA').cloneNode(true);
    [qClone, aClone].forEach((el) => {
      el.style.cssText = 'border:none;max-width:none;margin:0;padding:0;border-radius:0;display:block;';
      el.classList.remove('hidden-screen');
      el.querySelectorAll('.no-print').forEach((n) => n.remove());
      el.querySelectorAll('td.word-ans .revealed').forEach((n) => n.remove());
    });
    aClone.classList.add('pdf-answer-block');
    root.appendChild(qClone);
    root.appendChild(aClone);

    const btn = $('btnSave');
    const oldLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'PDF 만드는 중…';
    try {
      const worker = window.html2pdf().set({
        margin: [12, 12, 14, 12],
        filename: fname,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          before: ['.pdf-answer-block'],
          avoid: ['.q-item', '.passage-box', '.sent-ana', '.cloze-line', '.a-item', 'tr', '.direction-line'],
        },
      }).from(root).toPdf();
      // 하단 중앙 쪽 번호
      const pdf = await worker.get('pdf');
      const total = pdf.internal.getNumberOfPages();
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(9);
      pdf.setTextColor(90);
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.text(String(i), pw / 2, ph - 6, { align: 'center' });
      }
      const blob = pdf.output('blob');
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fname,
            types: [{ description: 'PDF 파일', accept: { 'application/pdf': ['.pdf'] } }],
          });
          const w = await handle.createWritable();
          await w.write(blob);
          await w.close();
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return; // 사용자가 취소
        }
      }
      const aEl = document.createElement('a');
      aEl.href = URL.createObjectURL(blob);
      aEl.download = fname;
      aEl.click();
      URL.revokeObjectURL(aEl.href);
    } catch (e) {
      alert('PDF를 만드는 중 문제가 생겼습니다: ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }

  /* ── 5. 지문 분석 ─────────────────── */
  function renderAnalysis() {
    const noAns = sheetHead('지문 분석') + '<p>정답지가 따로 없는 자료입니다.</p>';
    if (!Array.isArray(unitData.analysis) || !unitData.analysis.length) {
      showSheets(sheetHead('지문 분석') + '<p>이 단원에는 아직 지문 분석 자료가 없습니다.</p>', noAns);
      return;
    }
    let q = sheetHead('지문 분석');
    unitData.analysis.forEach((a) => {
      q += `<h3 class="sec-head">${esc(a.title)}</h3><div class="ana-body">${esc(a.body)}</div>`;
    });
    // 문장별 분석: 본문 전 문장에 대해 영문·해석·문법 포인트
    if (Array.isArray(unitData.sentNotes) && unitData.sentNotes.length === unitData.passage.length) {
      q += `<h3 class="sec-head">문장별 분석</h3>`;
      unitData.passage.forEach((s, i) => {
        const tag = (Array.isArray(unitData.sentTag) && unitData.sentTag[i])
          ? `<span class="sa-tag">${esc(unitData.sentTag[i])}</span>` : '';
        const direct = (Array.isArray(unitData.sentDirect) && unitData.sentDirect[i])
          ? `<div class="sa-direct">직독직해: ${esc(unitData.sentDirect[i])}</div>` : '';
        q += `<div class="sent-ana"><div class="sa-en"><b>${String(i + 1).padStart(2, '0')}</b> ${tag}${esc(s.en)}</div>` +
          direct +
          `<div class="sa-ko">${esc(s.ko)}</div>` +
          (unitData.sentNotes[i] ? `<div class="sa-note">▶ ${esc(unitData.sentNotes[i])}</div>` : '') +
          `</div>`;
      });
    }
    showSheets(q, noAns);
  }

  /* ── 5. 본문 보기 ─────────────────── */
  function renderPassage() {
    const showKo = $('passKo').checked;
    let q = sheetHead('본문 전체');
    const heads = {};
    if (Array.isArray(unitData.sections)) {
      unitData.sections.forEach((s) => { heads[s.start] = s.label; });
    }
    unitData.passage.forEach((s, i) => {
      if (heads[i]) q += `<h3 class="sec-head">${esc(heads[i])}</h3>`;
      q += `<div class="cloze-line"><span class="cloze-num">${i + 1}.</span><span class="cloze-en">${esc(s.en)}</span>` +
        (showKo ? `<div class="cloze-ko">${esc(s.ko)}</div>` : '') + `</div>`;
    });
    showSheets(q, sheetHead('본문 전체') + '<p>정답지가 따로 없는 자료입니다.</p>');
  }

  /* ── 탭·버튼 연결 ─────────────────── */
  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    currentTab = btn.dataset.tab;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.opt-panel').forEach((p) => p.classList.add('hidden'));
    $('opt-' + currentTab).classList.remove('hidden');
    clearSheets();
    if (currentTab === 'passage' && unitData) renderPassage();
    if (currentTab === 'analysis' && unitData) renderAnalysis();
  });

  // 단어 시험: 화면에서 답 칸 클릭 → 정답 표시/숨김
  $('sheetQ').addEventListener('click', (e) => {
    const td = e.target.closest('td.word-ans');
    if (!td) return;
    if (td.firstChild) { td.innerHTML = ''; return; }
    const span = document.createElement('span');
    span.className = 'revealed';
    span.textContent = td.dataset.ans;
    td.appendChild(span);
  });

  function guard(fn) {
    return () => {
      if (!unitData) { alert('단원 데이터가 아직 준비되지 않았습니다.'); return; }
      fn();
    };
  }
  $('btnCloze').addEventListener('click', guard(genCloze));
  $('btnWord').addEventListener('click', guard(genWord));
  $('btnExam').addEventListener('click', guard(genExam));
  $('btnWb').addEventListener('click', guard(genWorkbook));
  $('btnSave').addEventListener('click', saveSheets);

  function printSheet(mode) {
    document.body.classList.add(mode);
    const done = () => document.body.classList.remove(mode);
    window.addEventListener('afterprint', done, { once: true });
    window.print();
    setTimeout(done, 2000); // afterprint 미지원 브라우저 대비
  }
  $('btnPrintQ').addEventListener('click', () => printSheet('print-q'));
  $('btnPrintA').addEventListener('click', () => printSheet('print-a'));
  $('btnToggleA').addEventListener('click', () => $('sheetA').classList.toggle('hidden-screen'));

  $('selProfile').addEventListener('change', fillUnits);
  $('selUnit').addEventListener('change', loadUnit);
  $('passKo').addEventListener('change', () => {
    if (unitData && currentTab === 'passage') renderPassage();
  });

  fillProfiles();
})();
