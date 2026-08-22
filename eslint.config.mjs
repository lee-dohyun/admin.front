import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import sonarjs from "eslint-plugin-sonarjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// SonarQube 룰셋의 코드스멜 탐지만 ESLint 플러그인으로 가져온 것이다(#28).
// SonarQube 서버 자체는 도입하지 않았다 — Postgres 백엔드를 요구하는 상시 서비스를
// 단일 HDD 서버에 하나 더 얹는 비용이 이득보다 크다고 판단했다.
// store.front#46 이 파일럿이고 이 저장소는 그 전파다.
//
// recommended(217개 활성)를 그대로 error 로 둔다. 도입 시점에 기존 코드 위반이
// 0건임을 실측했으므로 error 가 당장 막는 것은 없고, 앞으로 들어오는 위반만 걸린다.
// warn 으로 두면 `next lint` 가 경고에 exit 0 이라 push 게이트를 그냥 통과해
// 사실상 아무 효과가 없다.
//
// 아래 예외는 "정상적인 개발 행위를 막는" 룰만 추린 것이고, 4개 프론트 저장소가
// 같은 목록을 공유한다(store.front#46 / customer.front#32 / product.front#25 /
// admin.front#28). 기본 전제는 여전히 "룰이 아니라 코드가 틀렸다" 이다 —
// 막힌다고 여기에 추가하지 말고, 추가한다면 그 판단 근거를 주석으로 남길 것.
const SONARJS_OVERRIDES = {
  // TODO/FIXME 주석을 쓰는 순간 push 가 막힌다. 이 저장소는 실제로 쓰고 있다.
  "sonarjs/todo-tag": "off",
  "sonarjs/fixme-tag": "off",
  // 임계값(기본 15) 초과를 리팩터링 강제 사유로 삼을 만큼 신뢰도가 높지 않다. 신호만 남긴다.
  "sonarjs/cognitive-complexity": "warn",
  // 아래 둘은 JSX 다중 상태 렌더링의 표준 관용구를 그대로 걸어 버린다.
  //   {loading ? <A/> : error ? <B/> : <C/>}
  //   `/api/products${qs ? `?${qs}` : ""}`
  // 실측(customer.front 3건 / product.front 6건)에서 걸린 코드가 전부 이 형태였고,
  // 지적대로 고치면 JSX 가 더 읽기 어려워진다 — 룰이 코드보다 틀린 경우로 판단했다.
  "sonarjs/no-nested-conditional": "warn",
  "sonarjs/no-nested-template-literals": "warn",
  // `export type Role = string` 같은 도메인 별칭을 걸러낸다. 타입 안전성은 못 주지만
  // 문서 가치가 있어 의도적으로 쓰는 패턴이다. 다만 지적 자체는 타당하므로 신호는 남긴다.
  "sonarjs/redundant-type-aliases": "warn",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // 소스 코드만 대상. 설정 파일(*.mjs/*.config.ts)까지 걸면 노이즈만 는다.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    plugins: sonarjs.configs.recommended.plugins,
    rules: {
      ...sonarjs.configs.recommended.rules,
      ...SONARJS_OVERRIDES,
    },
  },
];

export default eslintConfig;
