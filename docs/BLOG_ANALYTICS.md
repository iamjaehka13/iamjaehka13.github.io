# 블로그 방문 통계

## 공개 방문자 표시

블로그 메뉴의 **방문자**(`/visitors/`)와 페이지 하단에서 누구나 합계를 확인한다.
공개 집계는 GA4와 독립적이며 2026-10-20부터 기록한다.

- **지금 방문 중:** 최근 5분 이내에 보이는 탭에서 방문 신호를 보낸 브라우저 수.
- **오늘 / 어제:** 한국 시간 자정 기준 하루 순 브라우저 수. 새로고침·여러 탭은 중복 집계하지 않는다.
- **날짜별:** 최근 28일. 시작 전 날짜는 `집계 전`, 시작 후 신호가 없는 날짜는 `0명`.
- 페이지가 보일 때 1분마다 갱신한다. 오류일 때는 0으로 바꾸지 않고 마지막 갱신 시각과 지연 안내를 표시한다.

`_config.yml`의 `public_visitors.endpoint`는 `https://visitors.iamjaehka13.blog`의
Cloudflare Worker를 가리킨다. 전용 하위 도메인은 Worker Custom Domain으로 연결한다.
서버 코드는 `workers/visitors/`에 있으며 GitHub Pages 산출물에서는 제외한다.
`GET /stats`는 합계만 읽고, `POST /visit`은 허용된 블로그 Origin에서만 받는다.
키나 Google 로그인 정보는 프런트엔드에 필요하지 않다.

브라우저에는 최대 30일간 유지되는 임의 UUID를 저장한다. 서버는 SHA-256 해시와
최근 신호 시각을 오늘·어제 범위에서 유지하며, 시간당 정리 알람으로 삭제한다.
날짜별 숫자만 장기 보관한다. IP는 저장하지 않고 요청 제한의 일시적인 키로만 쓴다.
요청 본문은 256바이트로 제한하고, IP별 분당 60회 제한을 적용한다.
공개 API의 Origin/요청 제한은 완전한 봇·조작 방지 수단은 아니다.
Workers 요청 로그 수집은 꺼져 있다.

로컬 미리보기, 저장소 차단, DNT/GPC 활성화 브라우저는 합계를 읽기만 한다.
운영 사이트에서 확인하는 테스트 방문은 실제 공개 수치에 포함된다.
GA4와 정의·차단 여부가 다르므로 두 숫자가 같을 것으로 가정하지 않는다.

### 서버 검증과 재배포

Node 24와 pnpm을 사용한다. 인증은 저장소 외부의 OS 키체인에 두며,
Cloudflare 공식 `wrangler login --use-keyring` 흐름으로 연결한다.
필요한 범위는 `account:read`, `user:read`, `workers_scripts:write`이다.

```sh
cd workers/visitors
pnpm install --frozen-lockfile
pnpm test
pnpm exec wrangler dev
pnpm exec wrangler deploy --dry-run
pnpm run deploy
```

실제 API 검증은 로컬 Worker에서 반복 방문·다른 브라우저·잘못된 Origin·본문을
확인한다. 운영 API에는 가짜 방문자를 넣지 않는다. 저장소 단위 검증에는
한국 자정, 5분 만료, 식별자 정리 후 합계 보존이 포함된다.
Worker 배포와 GitHub Pages 배포는 별개다. 화면 변경은 기존 Pages 절차를 따른다.
Workers 무료 한도 내에서 운영하며 유료 요금제 전환을 자동화하지 않는다.

관련 문서: [Durable Objects](https://developers.cloudflare.com/durable-objects/get-started/),
[SQLite 저장소](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[요청 제한](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Google Analytics 상세 보고서

Google Analytics 4(GA4)에서 `https://iamjaehka13.blog`의 방문 통계를 확인한다.
통계는 해당 Analytics 속성에 권한이 있는 Google 계정으로 로그인해서 본다.

연결된 계정은 **jaehka13 Blog**, 속성은 **iamjaehka13.blog**,
웹 스트림은 **jaehka13 Blog Web**이다. 측정 ID는 `G-RKPW2P1ZGQ`이며,
보고 시간대는 대한민국(`Asia/Seoul`)이다.

## 연결 설정

1. [Google Analytics](https://analytics.google.com/)에서 블로그용 속성을 선택하거나 만든다.
2. 속성의 보고 시간대를 **대한민국 / Asia/Seoul**로 설정한다.
3. 웹 데이터 스트림의 URL을 `https://iamjaehka13.blog`로 설정한다.
4. 스트림에 표시되는 `G-`로 시작하는 측정 ID를 `_config.yml`의
   `analytics.google.id`에 입력한다.
5. 배포 후 블로그를 열고 Analytics의 **실시간** 보고서에서 수집을 확인한다.

`_includes/head.html`은 운영용 빌드(`JEKYLL_ENV=production`)에서만
`_includes/analytics/google.html`을 불러온다. 일반 로컬 미리보기는 집계하지 않는다.
태그의 기본 `page_view`를 사용하므로 별도의 페이지 조회 이벤트를 중복 추가하지 않는다.
광고 개인화와 Google signals는 태그에서 비활성화한다.
웹 스트림의 향상된 측정은 Google 기본 설정을 사용한다.
방문자용 안내는 `/privacy/`에 있으며 블로그 하단에서 접근할 수 있다.

측정 ID는 페이지 소스에 공개되는 식별자다. Google 로그인 정보, API 비밀 키,
서비스 계정 키는 이 저장소나 공개 페이지에 넣지 않는다.

## 하루 방문자 수 확인

날짜별 인원은 **총 사용자 수(Total users)**로 확인한다.
기본 보고서의 **활성 사용자(Active users)**와 **조회수(Views)**는 다른 지표다.

**탐색 → 블로그 일별 방문자 → 날짜별 방문자** 보고서가 저장되어 있다.
최근 28일의 날짜별 통계를 최대 50행까지 표시한다. 기본 기간은 어제까지이며,
오늘의 수집 여부는 실시간 보고서에서 확인한다.

보고서를 다시 만들려면 **탐색 → 자유 형식**에서 다음과 같이 구성한다.

| 항목 | 설정 |
| --- | --- |
| 탐색 이름 | 블로그 일별 방문자 |
| 기간 | 최근 28일 또는 원하는 기간 |
| 측정기준 / 행 | 날짜(Date) |
| 측정항목 / 값 | 총 사용자 수(Total users), 조회수(Views), 세션수(Sessions) |
| 정렬 | 날짜 오름차순 |
| 행 표시 | 50 |

하루에 같은 브라우저로 여러 글을 읽으면 일반적으로 사용자 수는 한 명,
조회수는 여러 번으로 집계된다. 서로 다른 기기·브라우저 사용이나 쿠키 삭제로
같은 사람이 나뉘어 집계될 수 있고, 차단 도구 때문에 누락될 수 있다.
날짜별 사용자 수를 더한 값은 전체 기간의 순 사용자 수와 같지 않을 수 있다.

글별 통계는 **페이지 및 화면** 보고서에서 페이지 경로나 제목으로 확인한다.

## 수집 시점과 확인

- 설치 이후의 방문부터 수집하며 설치 전 기록을 소급 생성하지 않는다.
- 실시간 보고서와 일반 보고서의 반영 시점은 다르다. 일반 보고서는 처리 시간을 둔다.
- 방문자가 아직 없거나 처리 중인 상태를 실제 방문자 수 0명으로 단정하지 않는다.
- 배포 확인용 방문도 운영 사이트에서 실행하면 통계에 포함될 수 있다.

## 공식 문서

- [Google Analytics 웹사이트 설정](https://developers.google.com/analytics/devguides/collection/ga4/web)
- [Google 태그 설치](https://developers.google.com/tag-platform/gtagjs)
- [사용자 측정항목의 차이](https://support.google.com/analytics/answer/12253918?hl=ko)
- [태그 설정과 광고 기능](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [수집 확인과 문제 해결](https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot)
