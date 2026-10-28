# 구조와 구현 원칙

- `src/app/(home)/page.tsx`: 메인 서버 페이지.
- `src/app/(home)/_components/`: 메인 화면과 조건 UI.
- `src/app/(home)/_store/lotto-store.ts`: 클라이언트 상태.
- `src/app/(home)/_lib/lotto-conditions.ts`: 번호 후보 및 생성 규칙.
- `src/lib/lotto-dhlottery.ts`: 외부 당첨 데이터 조회.
- `src/app/api/lotto/`: 회차 API.
- `src/components/ui/`: 공통 UI 기본 요소.
- `src/app/globals.css`: 공통 스타일과 토큰.
- `public/`: 정적 자산.
- `@/*`는 `src/*` 별칭이다. 셸에서 괄호가 포함된 경로는 따옴표로 감싼다.

## 구현 원칙

- 기존 스택과 컴포넌트를 우선 활용한다. 새 라이브러리·서비스·DB는 필요성과 운영 부담을 설명하고 현재 작업 범위에 맞게 결정한다.
- 유료 서비스, 플랜 변경, 결제, 운영 배포, 도메인·DNS·권한 변경은 명시적인 사용자 요청 없이 수행하지 않는다.
- `node_modules`, `.next`, `next-env.d.ts` 등 생성물을 직접 수정하지 않는다. 잠금 파일은 의존성을 변경할 때만 갱신한다.
- 상태와 계산 규칙을 UI에서 분리하고, TypeScript strict를 유지한다. 오류를 숨기기 위한 `any`, 무차별적인 lint 비활성화는 피한다.
- 브라우저 API는 클라이언트에서 사용한다. 외부 데이터 조회와 서버 전용 설정을 클라이언트 번들로 옮기지 않는다.
- 기존 저장 키 `datwe-saved-numbers`와 정상 데이터를 보존한다. 스키마 변경 시 검증과 마이그레이션을 제공한다.
- 서비스가 사용하는 한국어 표현을 유지하고 기능 설명과 실제 동작을 일치시킨다.
