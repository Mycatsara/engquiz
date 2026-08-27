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

  /* ── 4. 본문 보기 ─────────────────── */
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
