# 블로그 방문 통계

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
