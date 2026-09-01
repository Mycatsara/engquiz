/* 프로필 목록. 새 프로필·단원을 추가하면 여기에 등록한다.
 * 단원 데이터 파일은 data/<프로필id>/<파일>.js 에 둔다. */
window.QREG = {
  profiles: [
    {
      id: 'nunggok-hs1',
      label: '능곡고 1학년 — 학교 학습지',
      publisher: '능곡고등학교',
      grade: '고1',
      units: [
        { id: 'l01', label: 'L1 Connecting Amy\'s Dots', file: 'l01.js' },
      ],
    },
    {
      id: 'miraen-eng2',
      label: '미래엔 고등 영어Ⅱ (김성연 외)',
      publisher: '미래엔',
      grade: '고2·고3',
      units: [
        { id: 'u05', label: '5과 Inspiring Words for Moving Forward', file: 'u05.js' },
      ],
    },
    {
      id: 'sample-high',
      label: '샘플 교과서 (고1·고2) — 자작 지문 데모',
      publisher: '샘플',
      grade: '고1·고2',
      units: [
        { id: 'u01', label: '1강 The Spotlight Effect', file: 'u01.js' },
      ],
    },
    {
      id: 'sample-mid2',
      label: '샘플 교과서 (중2) — 자작 지문 데모',
      publisher: '샘플',
      grade: '중2',
      units: [
        { id: 'u01', label: '1단원 The Power of Small Habits', file: 'u01.js' },
      ],
    },
  ],
};
