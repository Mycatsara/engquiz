/* 영어문제 도구 — 순수 로직 모듈 (브라우저·node 공용)
 * 화면과 무관한 계산만 담당한다. node test.js 로 자동 테스트한다. */
(function (global) {
  'use strict';

  /* 시드 난수 생성기 (같은 시드 → 같은 결과, 테스트 가능) */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Fisher-Yates 섞기 — 원본을 바꾸지 않고 새 배열 반환 */
  function shuffle(arr, rng) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /* n개 무작위 추출 (중복 없음) */
  function pickN(arr, n, rng) {
    return shuffle(arr, rng).slice(0, Math.min(n, arr.length));
  }

  /* 빈칸 후보가 되기 어려운 기능어 */
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'of', 'to', 'and', 'or', 'but',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'i', 'you', 'he',
    'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our',
    'their', 'me', 'him', 'us', 'them', 'that', 'this', 'do', 'did',
    'not', 'so', 'for', 'with', 'by', 'as', 'if',
  ]);

  /* 문장을 토큰으로 분해. 각 토큰: {text, core, isWord}
   * core = 앞뒤 문장부호를 뗀 알맹이 (빈칸 판단·정답 표기용) */
  function tokenize(sentence) {
    return sentence.split(/\s+/).filter(Boolean).map(function (text) {
      const m = text.match(/^([^A-Za-z']*)([A-Za-z][A-Za-z']*)?(.*)$/);
      const core = m && m[2] ? m[2] : '';
      return { text: text, core: core, isWord: core.length > 0 };
    });
  }

  /* 빈칸 암기지: 내용어 중에서 rate 비율만큼 빈칸 지정
   * 반환: [{text, core, blank}] — blank=true 인 토큰을 화면에서 가린다 */
  function makeCloze(sentence, rate, rng) {
    const tokens = tokenize(sentence);
    const candidates = [];
    tokens.forEach(function (t, i) {
      if (t.isWord && t.core.length >= 3 && !STOPWORDS.has(t.core.toLowerCase())) {
        candidates.push(i);
      }
    });
    let count = Math.round(candidates.length * rate);
    if (candidates.length > 0 && count < 1) count = 1;
    const blankIdx = new Set(pickN(candidates, count, rng));
    return tokens.map(function (t, i) {
      return { text: t.text, core: t.core, blank: blankIdx.has(i) };
    });
  }

  /* 객관식 선택지 섞기: answer 인덱스를 새 위치로 재계산 */
  function shuffleChoices(question, rng) {
    const order = shuffle(question.choices.map(function (_, i) { return i; }), rng);
    const choices = order.map(function (i) { return question.choices[i]; });
    const answer = order.indexOf(question.answer);
    return Object.assign({}, question, { choices: choices, answer: answer });
  }

  /* 문제은행에서 유형별로 n개씩 무작위 선택 */
  function selectFromBank(bank, mcCount, shortCount, rng) {
    const mc = pickN(bank.filter(function (q) { return q.type === 'mc'; }), mcCount, rng);
    const sh = pickN(bank.filter(function (q) { return q.type === 'short'; }), shortCount, rng);
    return mc.concat(sh);
  }

  /* 단어시험 문항 생성: dir = 'e2k' | 'k2e' | 'mix' */
  function makeWordTest(words, n, dir, rng) {
    return pickN(words, n, rng).map(function (w, i) {
      let d = dir;
      if (dir === 'mix') d = rng() < 0.5 ? 'e2k' : 'k2e';
      return d === 'e2k'
        ? { prompt: w.en, answer: w.ko, dir: 'e2k' }
        : { prompt: w.ko, answer: w.en, dir: 'k2e' };
    });
  }

  const QLogic = {
    mulberry32: mulberry32,
    shuffle: shuffle,
    pickN: pickN,
    tokenize: tokenize,
    makeCloze: makeCloze,
    shuffleChoices: shuffleChoices,
    selectFromBank: selectFromBank,
    makeWordTest: makeWordTest,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = QLogic;
  else global.QLogic = QLogic;
})(typeof window !== 'undefined' ? window : globalThis);
