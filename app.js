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
    // 시험지 탭의 문항 수 선택지를 은행 보유량에 맞춘다
    const mcMax = unitData.bank.filter((q) => q.type === 'mc').length;
    const shMax = unitData.bank.filter((q) => q.type === 'short').length;
    const opts = (max) => Array.from({ length: max + 1 }, (_, i) =>
      `<option value="${i}" ${i === max ? 'selected' : ''}>${i}</option>`).join('');
    $('examMc').innerHTML = opts(mcMax);
    $('examShort').innerHTML = opts(shMax);
    if (currentTab === 'passage') renderPassage();
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
    const items = QLogic.makeWordTest(unitData.words, n, dir, rng());
    const title = '단어 시험 (' + items.length + '문항)';
    if (items.length < n) {
      alert('이 단원의 단어장에는 ' + unitData.words.length + '개가 있어 ' + items.length + '문항으로 만듭니다.');
    }
    let q = sheetHead(title);
    q += `<table class="word-table"><tr><th>번호</th><th>문제</th><th>답</th></tr>`;
    let a = sheetHead(title + ' — 정답');
    items.forEach((it, i) => {
      q += `<tr><td class="no">${i + 1}</td><td>${esc(it.prompt)}</td><td class="ans"></td></tr>`;
      a += `<div class="a-item"><b>${i + 1}.</b> ${esc(it.prompt)} → <span class="a-ans">${esc(it.answer)}</span></div>`;
    });
    q += `</table>`;
    showSheets(q, a);
  }

  /* ── 3. 영작 연습 (단어 배열) ─────────────────── */
  function genScramble() {
    const n = parseInt($('scrCount').value, 10);
    const r = rng();
    const picked = QLogic.pickN(unitData.passage, n, r);
    let q = sheetHead('영작 연습 — 단어 배열');
    let a = sheetHead('영작 연습 — 정답');
    picked.forEach((s, i) => {
      const sc = QLogic.scrambleSentence(s.en, r);
      q += `<div class="q-item"><div class="q-text"><span class="q-num">${i + 1}.</span>${esc(s.ko)}</div>
        <div class="scr-words">${sc.words.map((w) => `<span>${esc(w)}</span>`).join('')}</div>
        <div class="scr-line"></div></div>`;
      a += `<div class="a-item"><b>${i + 1}.</b> <span class="a-ans">${esc(s.en)}</span></div>`;
    });
    showSheets(q, a);
  }

  /* ── 4. 시험지 (문제은행) ─────────────────── */
  function genExam() {
    const mcN = parseInt($('examMc').value, 10);
    const shN = parseInt($('examShort').value, 10);
    if (mcN + shN === 0) { alert('문항 수를 1개 이상 골라주세요.'); return; }
    const doShuffle = $('examShuffle').checked;
    const r = rng();
    let selected = QLogic.selectFromBank(unitData.bank, mcN, shN, r);
    if (doShuffle) {
      selected = selected.map((qq) => (qq.type === 'mc' ? QLogic.shuffleChoices(qq, r) : qq));
    }
    let q = sheetHead('영어 내신 대비 평가');
    q += `<div class="passage-box"><div class="direction">※ 다음 글을 읽고 물음에 답하시오.</div>` +
      unitData.passage.map((s) => esc(s.en)).join(' ') + `</div>`;
    let a = sheetHead('영어 내신 대비 평가 — 정답 및 해설');
    selected.forEach((qq, i) => {
      q += `<div class="q-item"><div class="q-text"><span class="q-num">${i + 1}.</span>${esc(qq.q)} <span class="pts">[${qq.points}점]</span></div>`;
      if (qq.type === 'mc') {
        q += `<ol class="choices">` + qq.choices.map((c, j) => `<li>${CIRC[j]} ${esc(c)}</li>`).join('') + `</ol>`;
        a += `<div class="a-item"><b>${i + 1}.</b> <span class="a-ans">${CIRC[qq.answer]} ${esc(qq.choices[qq.answer])}</span><div class="a-exp">${esc(qq.explain || '')}</div></div>`;
      } else {
        q += `<div class="write-box"></div>`;
        a += `<div class="a-item"><b>${i + 1}.</b> <span class="a-ans">${esc(qq.answer)}</span><div class="a-exp">${esc(qq.explain || '')}</div></div>`;
      }
      q += `</div>`;
    });
    showSheets(q, a);
  }

  /* ── 5. 본문 보기 ─────────────────── */
  function renderPassage() {
    let q = sheetHead('본문 전체');
    unitData.passage.forEach((s, i) => {
      q += `<div class="cloze-line"><span class="cloze-num">${i + 1}.</span><span class="cloze-en">${esc(s.en)}</span><div class="cloze-ko">${esc(s.ko)}</div></div>`;
    });
    q += `<h3 style="margin:16px 0 8px">단어 (${unitData.words.length})</h3>` +
      `<table class="word-table"><tr><th>영어</th><th>뜻</th></tr>` +
      unitData.words.map((w) => `<tr><td>${esc(w.en)}</td><td>${esc(w.ko)}</td></tr>`).join('') +
      `</table>`;
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
  });

  function guard(fn) {
    return () => {
      if (!unitData) { alert('단원 데이터가 아직 준비되지 않았습니다.'); return; }
      fn();
    };
  }
  $('btnCloze').addEventListener('click', guard(genCloze));
  $('btnWord').addEventListener('click', guard(genWord));
  $('btnScramble').addEventListener('click', guard(genScramble));
  $('btnExam').addEventListener('click', guard(genExam));

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

  fillProfiles();
})();
