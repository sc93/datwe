export const getStrokeCount = (name: string) => {
  // 1. 자음/모음별 획수 데이터 (일반적인 인쇄체 기준)
  const strokes = {
    // 초성/종성 자음
    ㄱ: 2,
    ㄲ: 4,
    ㄴ: 2,
    ㄷ: 3,
    ㄸ: 6,
    ㄹ: 5,
    ㅁ: 4,
    ㅂ: 4,
    ㅃ: 8,
    ㅅ: 2,
    ㅆ: 4,
    ㅇ: 1,
    ㅈ: 3,
    ㅉ: 6,
    ㅊ: 4,
    ㅋ: 3,
    ㅌ: 4,
    ㅍ: 4,
    ㅎ: 3,
    // 중성 모음
    ㅏ: 2,
    ㅐ: 3,
    ㅑ: 3,
    ㅒ: 4,
    ㅓ: 2,
    ㅔ: 3,
    ㅕ: 3,
    ㅖ: 4,
    ㅗ: 2,
    ㅘ: 4,
    ㅙ: 5,
    ㅚ: 3,
    ㅛ: 3,
    ㅜ: 2,
    ㅝ: 4,
    ㅞ: 5,
    ㅟ: 3,
    ㅠ: 3,
    ㅡ: 1,
    ㅢ: 2,
    ㅣ: 1,
  };

  const CHOSUNG = [
    "ㄱ",
    "ㄲ",
    "ㄴ",
    "ㄷ",
    "ㄸ",
    "ㄹ",
    "ㅁ",
    "ㅂ",
    "ㅃ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅉ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
  ];
  const JUNGSUNG = [
    "ㅏ",
    "ㅐ",
    "ㅑ",
    "ㅒ",
    "ㅓ",
    "ㅔ",
    "ㅕ",
    "ㅖ",
    "ㅗ",
    "ㅘ",
    "ㅙ",
    "ㅚ",
    "ㅛ",
    "ㅜ",
    "ㅝ",
    "ㅞ",
    "ㅟ",
    "ㅠ",
    "ㅡ",
    "ㅢ",
    "ㅣ",
  ];
  const JONGSUNG = [
    "",
    "ㄱ",
    "ㄲ",
    "ㄳ",
    "ㄴ",
    "ㄵ",
    "ㄶ",
    "ㄷ",
    "ㄹ",
    "ㄺ",
    "ㄻ",
    "ㄼ",
    "ㄽ",
    "ㄾ",
    "ㄿ",
    "ㅀ",
    "ㅁ",
    "ㅂ",
    "ㅄ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
  ];

  // 복합 종성 처리 (예: ㄳ -> ㄱ+ㅅ)
  const complexJongsung = {
    ㄳ: ["ㄱ", "ㅅ"],
    ㄵ: ["ㄴ", "ㅈ"],
    ㄶ: ["ㄴ", "ㅎ"],
    ㄺ: ["ㄹ", "ㄱ"],
    ㄻ: ["ㄹ", "ㅁ"],
    ㄼ: ["ㄹ", "ㅂ"],
    ㄽ: ["ㄹ", "ㅅ"],
    ㄾ: ["ㄹ", "ㅌ"],
    ㄿ: ["ㄹ", "ㅍ"],
    ㅀ: ["ㄹ", "ㅎ"],
    ㅄ: ["ㅂ", "ㅅ"],
  };

  let totalStrokes = 0;

  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i) - 0xac00;
    if (code < 0 || code > 11171) continue; // 한글이 아니면 스킵

    const cho = Math.floor(code / 588);
    const jung = Math.floor((code - cho * 588) / 28);
    const jong = code % 28;

    // 초성 획수 추가
    totalStrokes += strokes[CHOSUNG[cho] as keyof typeof strokes] || 0;
    // 중성 획수 추가
    totalStrokes += strokes[JUNGSUNG[jung] as keyof typeof strokes] || 0;
    // 종성 획수 추가
    if (jong > 0) {
      const jongChar = JONGSUNG[jong];
      if (complexJongsung[jongChar as keyof typeof complexJongsung]) {
        totalStrokes += complexJongsung[
          jongChar as keyof typeof complexJongsung
        ].reduce(
          (acc, char) => acc + (strokes[char as keyof typeof strokes] || 0),
          0,
        );
      } else {
        totalStrokes += strokes[jongChar as keyof typeof strokes] || 0;
      }
    }
  }

  return totalStrokes;
};
