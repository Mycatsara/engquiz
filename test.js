/* 영어문제 도구 — 자동 테스트. 실행: node test.js
 * 로직 함수와 데이터 파일 무결성을 함께 검사한다. 수정 후 반드시 통과시킬 것. */
'use strict';
const path = require('path');
const QLogic = require(path.join(__dirname, 'logic.js'));

// 브라우저 전역을 흉내 내서 데이터 파일을 그대로 읽는다
global.window = globalThis;
require(path.join(__dirname, 'data', 'registry.js'));

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.error('  ✗ ' + name); }
}

/* ── 로직 테스트 ─────────────────── */
const rng = QLogic.mulberry32(12345);

// shuffle: 원소 보존, 원본 불변
{
  const src = [1, 2, 3, 4, 5];
  const out = QLogic.shuffle(src, rng);
  ok(out.length === 5 && [1,2,3,4,5].every((v) => out.includes(v)), 'shuffle 원소 보존');
  ok(src.join() === '1,2,3,4,5', 'shuffle 원본 불변');
}

// pickN: 개수·중복
{
  const out = QLogic.pickN([1,2,3,4,5], 3, rng);
  ok(out.length === 3 && new Set(out).size === 3, 'pickN 3개 중복 없음');
  ok(QLogic.pickN([1,2], 10, rng).length === 2, 'pickN 요청이 많으면 전체 반환');
}

// tokenize: 문장부호 분리
{
  const t = QLogic.tokenize('However, small habits win.');
  ok(t[0].core === 'However' && t[0].text === 'However,', 'tokenize 쉼표 분리');
  ok(t[3].core === 'win' && t[3].text === 'win.', 'tokenize 마침표 분리');
}

// makeCloze: 기능어 제외, 빈칸 수, 최소 1개
{
  for (let i = 0; i < 30; i++) {
    const r = QLogic.mulberry32(i);
    const toks = QLogic.makeCloze('Many students think that big changes need big plans.', 0.35, r);
    const blanks = toks.filter((t) => t.blank);
    ok(blanks.length >= 1, 'makeCloze 최소 1개 빈칸 (seed ' + i + ')');
    ok(blanks.every((t) => !['that', 'the', 'a'].includes(t.core.toLowerCase())), 'makeCloze 기능어 제외 (seed ' + i + ')');
    ok(toks.map((t) => t.text).join(' ') === 'Many students think that big changes need big plans.', 'makeCloze 원문 보존 (seed ' + i + ')');
  }
}

// shuffleChoices: 정답 재계산
{
  const q = { type: 'mc', q: 'x', choices: ['A', 'B', 'C', 'D', 'E'], answer: 1 };
  for (let i = 0; i < 30; i++) {
    const r = QLogic.mulberry32(i * 13 + 5);
    const out = QLogic.shuffleChoices(q, r);
    ok(out.choices[out.answer] === 'B', 'shuffleChoices 정답 추적 (seed ' + i + ')');
    ok(out.choices.slice().sort().join() === 'A,B,C,D,E', 'shuffleChoices 선택지 보존 (seed ' + i + ')');
  }
  ok(q.answer === 1 && q.choices[1] === 'B', 'shuffleChoices 원본 불변');
}

// selectFromBank / makeWordTest
{
  const bank = [
    { type: 'mc', id: 1 }, { type: 'mc', id: 2 }, { type: 'mc', id: 3 },
    { type: 'short', id: 4 }, { type: 'short', id: 5 },
  ];
  const out = QLogic.selectFromBank(bank, 2, 1, QLogic.mulberry32(9));
  ok(out.filter((x) => x.type === 'mc').length === 2, 'selectFromBank 객관식 2개');
  ok(out.filter((x) => x.type === 'short').length === 1, 'selectFromBank 서술형 1개');

  const words = [{ en: 'a', ko: '가' }, { en: 'b', ko: '나' }, { en: 'c', ko: '다' }];
  const wt = QLogic.makeWordTest(words, 2, 'e2k', QLogic.mulberry32(3));
  ok(wt.length === 2 && wt.every((x) => x.dir === 'e2k'), 'makeWordTest 영→한');
  const wt2 = QLogic.makeWordTest(words, 3, 'k2e', QLogic.mulberry32(4));
  ok(wt2.every((x) => /^[a-z]+$/.test(x.answer)), 'makeWordTest 한→영 정답은 영어');
}

/* ── 데이터 무결성 테스트 (모든 프로필·단원) ─────────────────── */
ok(window.QREG && window.QREG.profiles.length >= 1, '레지스트리 존재');

window.QREG.profiles.forEach((p) => {
  p.units.forEach((u) => {
    require(path.join(__dirname, 'data', p.id, u.file));
    const d = window.QUNITS[p.id + '/' + u.id];
    const tag = p.id + '/' + u.id;
    ok(!!d, tag + ' 데이터 로드');
    if (!d) return;
    ok(d.passage.length >= 1 && d.passage.every((s) => s.en && s.ko), tag + ' 본문 en/ko 완비');
    if (d.sections) {
      // 구간: 서로 이어지고, 본문 전체를 빈틈없이 덮어야 한다
      let prev = -1;
      d.sections.forEach((s) => {
        ok(s.id && s.label, tag + ' 구간 id/label 존재');
        ok(Number.isInteger(s.start) && Number.isInteger(s.end) &&
          s.start === prev + 1 && s.end >= s.start && s.end < d.passage.length,
          tag + ' 구간 ' + s.id + ' 연속·범위 유효');
        prev = s.end;
      });
      ok(prev === d.passage.length - 1, tag + ' 구간이 본문 전체를 덮음');
      const secIds = new Set(d.sections.map((s) => s.id).concat(['F', 'V']));
      d.bank.forEach((q) => {
        ok(secIds.has(q.sec), tag + ' ' + q.id + ' sec 값 유효 (' + q.sec + ')');
      });
    }
    ok(d.words.length >= 1 && d.words.every((w) => w.en && w.ko), tag + ' 단어 en/ko 완비');
    if (d.analysis) {
      ok(Array.isArray(d.analysis) && d.analysis.length >= 1 &&
        d.analysis.every((a) => typeof a.title === 'string' && a.title.trim() && typeof a.body === 'string' && a.body.trim()),
        tag + ' 지문 분석 title/body 완비');
    }
    if (d.sentNotes) {
      ok(Array.isArray(d.sentNotes) && d.sentNotes.length === d.passage.length,
        tag + ' 문장별 분석 수가 본문 문장 수와 일치 (' + (d.sentNotes ? d.sentNotes.length : 0) + '/' + d.passage.length + ')');
      ok(d.sentNotes.every((n) => typeof n === 'string'), tag + ' 문장별 분석 형식');
    }
    const ids = d.bank.map((q) => q.id);
    ok(new Set(ids).size === ids.length, tag + ' 문항 id 중복 없음');
    d.bank.forEach((q) => {
      ok(q.q && q.q.trim().length > 0, tag + ' ' + q.id + ' 발문 존재');
      ok(typeof q.points === 'number' && q.points > 0, tag + ' ' + q.id + ' 배점');
      if (q.type === 'mc') {
        ok(Array.isArray(q.choices) && q.choices.length === 5, tag + ' ' + q.id + ' 선택지 5개');
        ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, tag + ' ' + q.id + ' 정답 인덱스 유효');
        ok(new Set(q.choices).size === q.choices.length, tag + ' ' + q.id + ' 선택지 중복 없음');
      } else if (q.type === 'short') {
        ok(typeof q.answer === 'string' && q.answer.trim().length > 0, tag + ' ' + q.id + ' 서술형 정답 존재');
      } else {
        ok(false, tag + ' ' + q.id + ' 알 수 없는 유형: ' + q.type);
      }
      ok(!!q.explain, tag + ' ' + q.id + ' 해설 존재');
    });
  });
});

console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail === 0 ? 0 : 1);
