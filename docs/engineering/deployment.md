# 실행 환경과 배포

- 기존 구성: Next.js App Router 16, React 19, TypeScript strict, Tailwind CSS 4, Zustand, Radix UI.
- 정확한 버전은 `package.json`과 `package-lock.json`을 기준으로 한다. 문서의 버전 설명만 보고 업그레이드하지 않는다.
- 패키지 관리자는 npm을 사용한다. 다른 패키지 관리자의 잠금 파일을 추가하지 않는다.
- Node 버전 고정 파일과 `engines`는 현재 없다. 작업 전 `node --version`, `npm --version`으로 실제 런타임을 확인한다. `@types/node` 버전을 런타임 버전으로 해석하지 않는다.
- `node_modules`가 정상적으로 있으면 설치부터 반복하지 않는다. 재현 설치가 필요할 때 `npm ci`를 사용한다.
- 네트워크, 파일 쓰기, 브라우저, Git 권한은 세션마다 다르다. 실제 허용 범위를 확인하고, 제한을 임의로 우회하지 않는다.
- 허용된 작업 디렉터리와 임시 디렉터리 안에서 작업한다. 사용자 홈의 전역 설정이나 다른 프로젝트를 임의 수정하지 않는다.
- GitHub CLI 사용 전 `command -v gh`와 인증 상태를 확인한다.
- GitHub 작업은 사용 가능한 커넥터, 인증된 CLI 또는 브라우저를 사용한다. 인증을 가장하거나 쿠키·토큰을 추출해서 대체하지 않는다.
- Vercel 계정은 사용자가 이전을 완료했다고 알렸다. 실제 프로젝트 ID, 운영 주소, 로그인 계정과 권한은 별도 확인 없이 단정하지 않는다.
- 로컬 `.vercel` 연결 정보는 현재 없다. 임의로 운영 프로젝트에 연결하거나 새 프로젝트를 생성하지 않는다.

운영 배포·도메인·DNS·플랜 변경은 명시적인 요청 범위에서만 수행한다. 실제 운영 주소와 대상 프로젝트를 확인한 뒤 실행하고 결과를 검증한다.

## 당첨 데이터 캐시

- 별도 DB·유료 인프라 없이 Next Data Cache(`unstable_cache`)를 사용한다. 재검증 주기는300초, 개별 외부 요청 제한은5초다. 최신 조회 후 이전4회 병렬 조회이므로 첫 채움은 최악 약10초가 걸릴 수 있다.
- 캐시 키는 `lotto-recent-five-v1`, 태그는 `lotto-draws`다. 응답 계약을 바꾸면 키 버전도 변경한다.
- 정상인 연속5회만 캐시 콜백에서 반환한다. 부분 실패나 전체 실패는 throw하여 기존 정상 스냅샷을 덮어쓰지 않는다. Next의 백그라운드 재검증이 실패하면 기존 캐시를 유지한다.
- 반환 시 확인 시각을 비교해 오래된 데이터는 `stale`로 표시한다. 캐시 재검증 중에도 이전 기록이 보일 수 있으며 이것을 최신 확인으로 표현하지 않는다.
- 프로세스 메모리나 로컬 파일을 운영 영속 저장소로 사용하지 않는다. Vercel Data Cache의 보존 범위에 의존하므로 캐시 삭제·키 변경·첫 배포에서 이전 정상 기록이 없을 수 있다. 이때는 `partial` 또는 `unavailable`로 동작한다. 영구 아카이브를 보장하는 기능이 아니다.
- 요청 시각 상태 계산을 위해 `connection()`은 캐시 콜백 밖에서 호출한다. 외부 응답은 캐시 내부에서 조회 후 검증하며 실패 응답 자체를 캐시하지 않는다.
- 참고: https://nextjs.org/docs/app/api-reference/functions/unstable_cache

## GA 활성화 조건

향상된 측정의 원문 URL·검색어·폼·히스토리 자동 수집을 막기 위해 운영 데이터 스트림에서 향상된 측정 전체를 끈 것을 확인한 경우에만 `NEXT_PUBLIC_GA_ENHANCED_MEASUREMENT_DISABLED=true`로 빌드한다. 설정이 없거나 false면 GA 스크립트를 로드하지 않는다. 이 공개 환경변수는 계정 설정을 자동 변경하지 않으며 중지 여부를 검증하는 API도 아니다. 설정 변경 후 재확인 책임이 운영에 있다. 로컬·미리보기 origin은 활성화되지 않는다.

`send_page_view:false`는 초기 자동 page_view만 제어하므로 향상된 측정 중지 확인을 대신하지 못한다. 수동 이벤트에는 정규화한 page_path/page_location/page_title 및 빈 page_referrer만 넣는다. 운영 수신·계정 측 설정은 로컬 테스트로 통과 처리하지 않는다.

## DB 아카이브 관리 설정과 격리 검증

운영 DDL·실제 데이터 적재·Cron 활성화·배포는 별도 승인 대상이다. 저장소의 코드는 기본적으로 실행을 거부하며, 환경변수를 자동 생성하거나 기존 연결 값을 추출하지 않는다.

| 서버 전용 변수             | 용도                                                            |
| -------------------------- | --------------------------------------------------------------- |
| `DATABASE_READ_URL`        | `lotto_reader`만 상속하는 별도 로그인 역할                      |
| `DATABASE_WRITE_URL`       | `lotto_writer`만 상속하는 별도 로그인 역할, Production에만 주입 |
| `DATABASE_MIGRATION_URL`   | 스키마/역할 관리 명령 전용. 웹 런타임에 주입 금지               |
| `DATABASE_PRODUCTION_HOST` | 운영 Neon endpoint 호스트. 비밀번호/URL이 아닌 대상 식별자      |
| `DATABASE_ISOLATED_HOST`   | 해당 Preview/개발 브랜치의 별도 endpoint 호스트                 |
| `CRON_SECRET`              | 32자 이상 서버 비밀값. Production에만 주입                      |
| `LOTTO_ARCHIVE_ENABLED`    | 승인된 Production에서만 `true`                                  |

접속 URL은 TLS(`sslmode=require`)를 요구한다. pooler 접미사를 정규화한 호스트를 대조하고, 개발/Preview의 운영 호스트 연결을 거부한다. 로그인 역할은 일반 SQL로 별도 생성해 필요한 비로그인 그룹만 부여하고 비밀번호는 승인된 비밀 관리 수단으로 설정한다. 런타임은 owner/DDL/역할 생성/Neon 관리자 권한을 가진 자격을 거부한다. reader는 관리 테이블 접근 및 쓰기 권한도 거부한다. 기존 Marketplace owner URL을 런타임 변수에 그대로 재사용하지 않는다. Preview마다 **서로 다른 실제 Neon 브랜치 endpoint**와 격리 자격을 주입해야 하며, 환경변수명만으로 연결 검증 완료라고 간주하지 않는다. Preview의 수집 웹 요청은 격리 DB 여부와 관계없이 거부한다.

격리 마이그레이션은 `DATABASE_MIGRATION_URL`, `DATABASE_ISOLATED_HOST`, `DATABASE_PRODUCTION_HOST`를 비밀 관리 경로로 주입한 후 실행한다.

```sh
npm run archive:migrate
npm run archive:migrate -- --apply
```

첫 명령은 대상 검증만 수행하는 dry-run이다. 두 번째는 격리 대상에만 SQL을 적용하고 테이블/인덱스 baseline을 출력한다. 적용은 Neon 드라이버의 실제 트랜잭션으로 실행한다. 트랜잭션 advisory lock과 버전/checksum으로 중복 적용·수정된 과거 마이그레이션을 막는다. DDL 오류는 버전 기록과 함께 롤백한다. 운영 URL을 이 명령에 넣지 않는다. down/DROP은 제공하지 않으며 운영 적용 전 export·검토가 필요하다.

Neon의 용량·월 CU·전송량과 Vercel 함수 자원 사용률은 승인된 관리자가 확인하고, 그중 최댓값을 관리 자격으로 `lotto.sync_state.usage_percent`, 확인시각을 `usage_checked_at`에 기록한다. 공급자 API 자격을 런타임에 추가하지 않는다. 기록은 24시간 이내만 유효하다. 70%부터 응답/실행 요약의 `usage-warning`을 운영 경고로 확인하고 GitHub 이슈로 관리한다. 85%부터 과거/정정 재조회, 95%부터 모든 원천 요청과 회차 저장을 멈춘다. 사용량 미확인은 `usage-unknown`으로 경고하고 과거 적재를 멈추며 최신 확인만 허용한다. 이는 공급자 한도가 아닌 내부 상한이다.

관리 GET/POST에는 `Authorization: Bearer <CRON_SECRET>`이 필요하다. POST 본문은 `{}` 또는 `{"rounds":[1,600]}`처럼 최대2회차만 받는다. 최신 확인도 1요청으로 계산하므로 한 실행 최대3요청을 유지한다. 수동 요청 역시 백오프·일일 예산을 공유한다. 운영 자격을 셸 히스토리·로그·URL 쿼리에 넣지 않는다. 실행 요약에는 허용된 상태/오류코드와 건수만 남긴다. DB에는 완료 실행 이력30일·예산90일을 보존하며 다음 lease 획득 때 정리한다. 미해결 실패는 자동 삭제하지 않는다.

`config/vercel.cron-disabled.json`은 **비활성 예약 템플릿**이다. 루트 `vercel.json`에 연결하지 않았으므로 배포만으로 Cron이 활성화되지 않는다. 별도 운영 승인 후 기존 Vercel 설정과 병합하고 단일 `0 13 * * *` 예약을 활성화한다. KST 22시대 실행 목표이며 정각 실행·성공 보장은 없다. 실제 Vercel→공식 원천 접근, Preview 브랜치 연결과 Neon 로그인 자격 분리는 승인된 환경에서 추가 확인해야 한다.
