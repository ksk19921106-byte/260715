# ICBANQ OPS 영어이름 로그인 설정

## 적용된 구조

- `demo` 모드: 기존 테스트 계정 선택 기능을 유지합니다.
- `supabase` 모드: 영어이름과 비밀번호로 로그인하며 URL의 `?user=` 값은 사용하지 않습니다.
- 로그인 이름은 대소문자를 구분하지 않습니다. 현재 직원 명단의 규칙대로 `Sally`를 인증 서비스 내부의 `sally@icbanq.com` 계정에 연결합니다. 다른 이메일 규칙을 쓰는 직원이 있으면 배포 전 계정 매핑을 변경해야 합니다.
- ERP 계정과 비밀번호를 공유하거나 ERP에 로그인하는 기능은 아닙니다. ERP SSO는 별도 연동 범위입니다.
- 요청, 월마감, 수금 데이터는 기존 Google Apps Script/Google Sheet 공용 저장소를 계속 사용합니다.
- 로그인 사용자의 조직 권한은 `portal_profiles`와 포털 조직도를 함께 사용합니다.

## 1. Supabase 프로젝트 만들기

1. Supabase에서 새 프로젝트를 만듭니다.
2. `SQL Editor`에서 `supabase/portal-auth.sql`을 실행합니다.
3. `Authentication > Providers > Email`을 활성화합니다.
4. 임의 회원가입을 막기 위해 공개 Sign up은 비활성화합니다.

## 2. 직원 등록

1. `Authentication > Users`에서 `Add user`로 직원을 등록하고 직원별로 서로 다른 임시 비밀번호를 설정합니다. 비밀번호는 개인별 안전한 경로로 전달하고 저장소·문서·공용시트에 기록하지 않습니다.
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
SUPABASE_SERVICE_ROLE_KEY=서버전용_service_role_키
```

기존 Google Sheet 저장 환경변수도 그대로 유지합니다.

```text
OPS_SHARED_STORAGE_URL=https://script.google.com/macros/s/.../exec
OPS_SHARED_STORAGE_SECRET=기존_공용저장소_비밀값
OPS_RECEIVABLES_WEBAPP_URL=https://script.google.com/macros/s/.../exec
```

Supabase 비밀키나 Google 저장소 비밀값을 GitHub에 올리지 않습니다.

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이며 `NEXT_PUBLIC_` 접두사를 절대 붙이지 않습니다. 비밀번호 변경 서버가 본인 인증 후 초기 변경 완료 표식을 갱신할 때 사용합니다. 없는 경우 변경 요청은 503으로 거절됩니다.

## 초기 비밀번호와 이후 변경

- 로그인 후 서버 관리 메타데이터 `portal_password_initialized=true`가 없으면 `/account/password`로 이동합니다. 기존 계정도 이 표식이 없다면 한 번 변경해야 합니다.
- 변경 전에는 업무 페이지와 업무 API 접근을 서버에서 거절합니다. 사용자가 수정할 수 있는 `user_metadata`는 이 판정에 사용하지 않습니다.
- 현재 비밀번호를 재확인하고 새 비밀번호와 초기 변경 완료 표식을 서버에서 함께 갱신합니다. 새 비밀번호는 영문·숫자를 포함한 12~128자이며 기존과 달라야 합니다. Supabase 비밀번호 정책도 이와 같거나 더 강하게 설정합니다.
- 변경 후에는 다시 로그인합니다. 이후 좌측 메뉴의 `비밀번호 변경`에서 같은 방식으로 변경할 수 있습니다.
- 분실 시 관리자가 본인 확인 후 재설정합니다. 직원용 임의 가입·이메일 링크 로그인 버튼은 제공하지 않습니다.
- 관리자의 비밀번호 초기화는 새 임시 비밀번호 설정과 `app_metadata.portal_password_reset_required=true` 설정을 함께 수행해야 합니다. 서버용 Supabase Admin 기능을 사용하며, 기존 역할 메타데이터는 보존합니다. 포털 내부의 관리자 계정 발급/초기화 화면은 이번 범위에 포함하지 않았습니다.
- 인증 서비스의 로그인 시도 제한을 설정하고 배포 환경에서 반복 로그인 실패를 검증해야 합니다. 실제 계정 생성, 외부 서비스 설정, 운영 배포는 자동 수행하지 않았습니다.

공식 연동 근거: [Supabase 비밀번호 로그인](https://supabase.com/docs/guides/auth/passwords), [서버 관리자 사용자 갱신](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

## 배포 전 인증 검증

1. 관리자가 새 직원 한 명을 등록하고 영어이름/임시 비밀번호로 로그인합니다.
2. 비밀번호 변경 전 직접 HOME 주소나 업무 API를 호출해도 접근이 거절되는지 확인합니다.
3. 잘못된 현재 비밀번호, 짧은 새 비밀번호, 같은 비밀번호가 거절되는지 확인합니다.
4. 변경 후 새 비밀번호만 유효하고 사용자 역할·팀 범위가 유지되는지 확인합니다.
5. 비활성 프로필, 미등록 계정, 타 사이트에서 보낸 비밀번호 변경 요청이 거절되는지 확인합니다.
6. 관리자 초기화 후 다시 비밀번호 변경이 강제되는지 확인합니다.
7. 현재 로컬 검증은 모의 인증 테스트입니다. 실제 Supabase 설정이 없는 상태의 `/login`은 시연 표시와 비활성 로그인 버튼을 보여줍니다.

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
