# ICBANQ OPS 직원 체험판 로그인 설정

## 적용된 구조

- `demo` 모드: 기존 테스트 계정 선택 기능을 유지합니다.
- `supabase` 모드: 회사 이메일로 로그인하며 URL의 `?user=` 값은 사용하지 않습니다.
- 요청, 월마감, 수금 데이터는 기존 Google Apps Script/Google Sheet 공용 저장소를 계속 사용합니다.
- 로그인 사용자의 조직 권한은 `portal_profiles`와 포털 조직도를 함께 사용합니다.

## 1. Supabase 프로젝트 만들기

1. Supabase에서 새 프로젝트를 만듭니다.
2. `SQL Editor`에서 `supabase/portal-auth.sql`을 실행합니다.
3. `Authentication > Providers > Email`을 활성화합니다.
4. 임의 회원가입을 막기 위해 공개 Sign up은 비활성화합니다.

## 2. 직원 등록

1. `Authentication > Users`에서 `Add user` 또는 `Invite user`로 직원을 등록합니다.
2. 같은 이메일을 `portal_profiles`에도 등록합니다.
3. 이메일, 영문 Sales명, 팀, 권한이 정확히 일치해야 합니다.

직원 목록과 회사 이메일은 `data/portal-users-template.csv`에 등록되어 있습니다. 이메일 규칙은 `영문 이름 소문자@icbanq.com`이며, 같은 명단이 `supabase/portal-auth.sql`에도 포함되어 있습니다.

권한값:

- VIPS: `role=VIPS`, `access_role=admin`
- Sales 팀장/셀장: `role=SALES`, `access_role=manager`
- 일반 Sales: `role=SALES`, `access_role=sales`

조직 범위는 포털의 `app/services/organization.ts` 기준으로 계산됩니다.

## 3. Vercel 환경변수

Supabase의 `Project URL`과 `Publishable key`를 Vercel 프로젝트 환경변수에 등록합니다.

```text
NEXT_PUBLIC_OPS_AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

기존 Google Sheet 저장 환경변수도 그대로 유지합니다.

```text
OPS_SHARED_STORAGE_URL=https://script.google.com/macros/s/.../exec
OPS_SHARED_STORAGE_SECRET=기존_공용저장소_비밀값
OPS_RECEIVABLES_WEBAPP_URL=https://script.google.com/macros/s/.../exec
```

Supabase 비밀키나 Google 저장소 비밀값을 GitHub에 올리지 않습니다.

## 4. 로그인 주소 설정

Supabase `Authentication > URL Configuration`에서 다음 주소를 등록합니다.

- Site URL: 실제 Vercel 주소
- Redirect URL: `https://실제주소/auth/callback`
- 로컬 확인용: `http://localhost:3001/auth/callback`

## 5. 체험판 권장 순서

1. Sally, 팀장 1명, 셀장 1명, 일반 Sales 2명만 먼저 등록합니다.
2. 각 계정으로 로그인해 조회 범위를 확인합니다.
3. Sally가 월마감 데이터를 올리고 일반 Sales가 본인 데이터만 보는지 확인합니다.
4. 요청 등록과 VIPS 처리 결과가 다른 PC에서도 동일하게 보이는지 확인합니다.
5. 확인 후 전체 직원 계정을 추가합니다.

## Google Sheet 저장 관련

이메일 로그인으로 바뀌어도 Google Sheet 저장은 없어지지 않습니다. 인증은 사용자를 확인하고, Google Sheet는 업무 데이터를 보관합니다. 두 기능은 독립적으로 동작합니다.

현재 공용 저장 대상:

- VIPS 요청
- 월마감 최신 데이터와 월별 이력
- 수금/AR 업로드 데이터
- 요청 차단 상태

브라우저 `localStorage`에만 남아 있는 일부 개인 메모와 UI 상태는 다음 단계에서 공용 저장 대상으로 전환할 수 있습니다.
