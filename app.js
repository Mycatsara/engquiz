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
    const r = rng();
    const mcAvail = unitData.bank.filter((x) => x.type === 'mc').length;
    const shAvail = unitData.bank.filter((x) => x.type === 'short').length;
    if ((mcN > 0 && mcAvail < mcN) || (shN > 0 && shAvail < shN)) {
      alert('이 단원 문제은행에는 객관식 ' + mcAvail + '개, 서술형 ' + shAvail + '개가 있어 그 범위 안에서 만듭니다.');
    }
    let selected = QLogic.selectFromBank(unitData.bank, mcN, shN, r);
    if (doShuffle) {
      selected = selected.map((qq) => (qq.type === 'mc' ? QLogic.shuffleChoices(qq, r) : qq));
    }
    let q = sheetHead('영어 내신 대비 평가');
    let a = sheetHead('영어 내신 대비 평가 — 정답 및 해설');
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

  function wbCountOf(cntVal, poolSize, ratio) {
    if (cntVal === 'all') return poolSize;
    return Math.min(poolSize, Math.max(1, Math.round(parseInt(cntVal, 10) * (ratio || 1))));
  }

  // 해석 쓰기
  function wbTrans(r, cntVal) {
    let idxs = unitData.passage.map((_, i) => i);
    if (cntVal !== 'all') idxs = QLogic.pickN(idxs, parseInt(cntVal, 10), r).sort((x, y) => x - y);
    let q = '', a = '';
    idxs.forEach((pi, i) => {
      const s = unitData.passage[pi];
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${i + 1}.</span>${esc(s.en)}</div><div class="write-box"></div></div>`;
      a += `<div class="a-item"><b>${i + 1}.</b> ${esc(s.en)}<div class="a-exp"><span class="a-ans">${esc(s.ko)}</span></div></div>`;
    });
    return { q: q, a: a, n: idxs.length };
  }

  // 어휘 선택 / 어법 선택 공용: pairs = [{i, o(정답), x(오답)}]
  function wbChoice(pairs, r, cntVal) {
    let sel = pairs.map((_, i) => i);
    if (cntVal !== 'all') sel = QLogic.pickN(sel, parseInt(cntVal, 10), r).sort((x, y) => x - y);
    let q = '', a = '';
    sel.forEach((pi, n) => {
      const p = pairs[pi];
      const s = unitData.passage[p.i].en;
      const flip = r() < 0.5;
      const box = `<b>( ${esc(flip ? p.x : p.o)} / ${esc(flip ? p.o : p.x)} )</b>`;
      const shown = esc(s).replace(esc(p.o), box);
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${n + 1}.</span>${shown}</div></div>`;
      a += `<div class="a-item"><b>${n + 1}.</b> <span class="a-ans">${esc(p.o)}</span></div>`;
    });
    return { q: q, a: a, n: sel.length };
  }

  // 동사 바꾸기: verbs = [{i, o(정답 형태), b(원형)}]
  function wbVerbFrag(r, cntVal) {
    const pool = unitData.wbVerb;
    let sel = pool.map((_, i) => i);
    if (cntVal !== 'all') sel = QLogic.pickN(sel, parseInt(cntVal, 10), r).sort((x, y) => x - y);
    let q = '', a = '';
    sel.forEach((pi, n) => {
      const p = pool[pi];
      const s = unitData.passage[p.i].en;
      const shown = esc(s).replace(esc(p.o), `<b>( ${esc(p.b)} )</b>`);
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${n + 1}.</span>${shown}</div></div>`;
      a += `<div class="a-item"><b>${n + 1}.</b> <span class="a-ans">${esc(p.o)}</span></div>`;
    });
    return { q: q, a: a, n: sel.length };
  }

  // 어법 오류 수정: wbGram의 오답형을 문장에 심고 찾아 고치게 한다
  function wbFix(pairs, r, cntVal) {
    let sel = pairs.map((_, i) => i);
    if (cntVal !== 'all') sel = QLogic.pickN(sel, parseInt(cntVal, 10), r).sort((x, y) => x - y);
    let q = '', a = '';
    sel.forEach((pi, n) => {
      const p = pairs[pi];
      const s = unitData.passage[p.i].en;
      const shown = esc(s).replace(esc(p.o), esc(p.x));
      q += `<div class="q-item"><div class="q-text q-sent"><span class="q-num">${n + 1}.</span>${shown}</div><div class="write-box" style="height:34px"></div></div>`;
      a += `<div class="a-item"><b>${n + 1}.</b> <span class="a-ans">${esc(p.x)} → ${esc(p.o)}</span></div>`;
    });
    return { q: q, a: a, n: sel.length };
  }

  // 구간 안에서 연속 windowLen문장 시작점들을 겹치지 않게 뽑는다
  function wbWindows(want, windowLen, r) {
    const ranges = Array.isArray(unitData.sections) && unitData.sections.length
      ? unitData.sections.map((s) => [s.start, s.end])
      : [[0, unitData.passage.length - 1]];
    const starts = [];
    ranges.forEach(([st, en]) => {
      for (let i = st; i + windowLen - 1 <= en; i++) starts.push(i);
    });
    const shuffled = QLogic.shuffle(starts, r);
    const chosen = [];
    for (const st of shuffled) {
      if (chosen.every((c) => Math.abs(c - st) >= windowLen)) chosen.push(st);
      if (chosen.length >= want) break;
    }
    for (const st of shuffled) {
      if (chosen.length >= want) break;
      if (!chosen.includes(st)) chosen.push(st);
    }
    return chosen;
  }

  // 문장 삽입: 연속 5문장 중 가운데 하나를 빼서 위치를 고르게 한다
  function wbInsert(r, cntVal) {
    const want = cntVal === 'all' ? 5 : Math.max(2, Math.round(parseInt(cntVal, 10) / 4));
    const chosen = wbWindows(want, 5, r);
    let q = '', a = '';
    chosen.forEach((st, i) => {
      const k = 1 + Math.floor(r() * 3); // 제거할 문장의 창 내 위치(1~3)
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

  // 순서 배열: 연속 4문장(주어진 글 1 + A·B·C 섞기)
  function wbOrder(r, cntVal) {
    const want = cntVal === 'all' ? 8 : Math.max(2, Math.round(parseInt(cntVal, 10) / 4));
    const chosen = wbWindows(want, 4, r);
    if (!chosen.length) return { q: '', a: '', n: 0 };
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

  function genWorkbook() {
    const type = $('wbType').value;
    const cntVal = $('wbCount').value;
    const r = rng();
    const hasVocab = Array.isArray(unitData.wbVocab) && unitData.wbVocab.length > 0;
    const hasGram = Array.isArray(unitData.wbGram) && unitData.wbGram.length > 0;
    const hasVerb = Array.isArray(unitData.wbVerb) && unitData.wbVerb.length > 0;

    function runOne(t, cv, gramPool) {
      if (t === 'trans') return wbTrans(r, cv);
      if (t === 'vocab') return hasVocab ? wbChoice(unitData.wbVocab, r, cv) : null;
      if (t === 'gram') return hasGram ? wbChoice(gramPool || unitData.wbGram, r, cv) : null;
      if (t === 'verb') return hasVerb ? wbVerbFrag(r, cv) : null;
      if (t === 'fix') return hasGram ? wbFix(gramPool || unitData.wbGram, r, cv) : null;
      if (t === 'insert') return wbInsert(r, cv);
      if (t === 'order') return wbOrder(r, cv);
      return null;
    }

    if (type !== 'all') {
      const frag = runOne(type, cntVal, null);
      if (!frag) { alert('이 단원에는 아직 [' + WB_LABEL[type] + '] 데이터가 없습니다. (단원 등록 시 함께 만듭니다)'); return; }
      let q = sheetHead('워크북 — ' + WB_LABEL[type]);
      q += `<div class="direction-line">※ ${WB_DIR[type]} (1~${frag.n})</div>` + frag.q;
      const a = sheetHead('워크북 — ' + WB_LABEL[type] + ' 정답') + frag.a;
      showSheets(q, a);
      return;
    }

    // 전체 유형: 어법 선택과 오류 수정이 같은 문장을 쓰지 않도록 wbGram을 반씩 나눈다
    let gramA = null, gramB = null;
    if (hasGram) {
      const mixed = QLogic.shuffle(unitData.wbGram, r);
      const half = Math.ceil(mixed.length / 2);
      gramA = mixed.slice(0, half).sort((x, y) => x.i - y.i);
      gramB = mixed.slice(half).sort((x, y) => x.i - y.i);
    }
    const PLAN = [
      ['trans', '10', null], ['vocab', '10', null], ['gram', '10', gramA],
      ['verb', '8', null], ['fix', '8', gramB], ['insert', '10', null], ['order', '10', null],
    ];
    let q = sheetHead('워크북 — 전체 유형');
    let a = sheetHead('워크북 — 전체 유형 정답');
    let secNo = 0;
    PLAN.forEach(([t, cv, pool]) => {
      const frag = runOne(t, cv, pool);
      if (!frag || !frag.n) return;
      secNo++;
      q += `<h3 class="sec-head">${secNo}. ${WB_LABEL[t]}</h3><div class="direction-line">※ ${WB_DIR[t]} (1~${frag.n})</div>` + frag.q;
      a += `<h3 class="sec-head">${secNo}. ${WB_LABEL[t]}</h3>` + frag.a;
    });
    showSheets(q, a);
  }

  /* ── 파일로 저장 (문제지+정답지를 하나의 HTML 파일로) ─────────────────── */
  let cssCache = null;
  async function saveSheets() {
    if (!$('sheetQ').innerHTML.trim()) { alert('먼저 [만들기]를 눌러 자료를 만들어 주세요.'); return; }
    if (cssCache === null) {
      try { cssCache = await (await fetch('style.css')).text(); } catch (e) { cssCache = ''; }
    }
    const p = profile();
    const u = p.units.find((x) => x.id === $('selUnit').value);
    const d = new Date();
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const head = $('sheetQ').querySelector('.sheet-head h2');
    const docTitle = (head ? head.textContent : '자료') + ' — ' + u.label;
    const fname = ('영어문제_' + u.label + '_' + (head ? head.textContent : '자료') + '_' + stamp + '.html')
      .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ');
    const html = '<!DOCTYPE html>\n<html lang="ko"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(docTitle) + '</title><style>' + cssCache +
      '\n.saved-note{max-width:800px;margin:10px auto;font-size:12px;color:#64748b;}' +
      '\n.answer-block{page-break-before:always;}</style></head><body>' +
      '<p class="saved-note no-print">저장된 자료입니다. 인쇄(Ctrl+P)하면 문제지와 정답지가 이어서 출력됩니다.</p>' +
      '<div class="sheet">' + $('sheetQ').innerHTML + '</div>' +
      '<div class="sheet answer-sheet answer-block">' + $('sheetA').innerHTML + '</div>' +
      '</body></html>';
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fname,
          types: [{ description: 'HTML 파일', accept: { 'text/html': ['.html'] } }],
        });
        const w = await handle.createWritable();
        await w.write(html);
        await w.close();
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 사용자가 취소
        // 실패 시 아래 다운로드 방식으로 폴백
      }
    }
    const blob = new Blob([html], { type: 'text/html' });
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = fname;
    aEl.click();
    URL.revokeObjectURL(aEl.href);
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
