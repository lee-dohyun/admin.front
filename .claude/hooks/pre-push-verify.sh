#!/usr/bin/env bash
# PreToolUse(Bash) hook — `git push` 직전에 타입체크/린트를 강제한다.
#
# 왜: 이 저장소들의 CI는 Docker 빌드 성공만을 게이트로 삼고 lint/typecheck를 돌리지 않는다.
# main push는 self-hosted runner를 통해 즉시 프로덕션에 반영된다.
# exit 2 = 도구 호출 차단, exit 0 = 통과.
set -uo pipefail

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

case "$CMD" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

if [ "${CLAUDE_SKIP_PUSH_VERIFY:-}" = "1" ]; then
  echo "pre-push-verify: CLAUDE_SKIP_PUSH_VERIFY=1 이므로 건너뜀" >&2
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
[ -f package.json ] || exit 0

# 훅은 로그인 셸이 아니라 PATH에 nvm의 node가 없다. 여기서 직접 찾아 붙인다.
# 이걸 안 하면 npm이 127로 죽고, 아래 로직이 그걸 "typecheck 실패"로 오인해
# 멀쩡한 push를 막는다 → 사용자는 CLAUDE_SKIP_PUSH_VERIFY=1을 습관적으로 켜게 되고
# 게이트 자체가 무력화된다.
if ! command -v npm >/dev/null 2>&1; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 || true
  fi
fi
if ! command -v npm >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [ -x "$d/npm" ] && { PATH="$d:$PATH"; export PATH; break; }
  done
fi
if ! command -v npm >/dev/null 2>&1; then
  cat >&2 <<'NPMMSG'
push를 차단했습니다: npm 을 찾을 수 없어 검증을 수행하지 못했습니다.

이건 "검사 실패"가 아니라 "검사 불가"입니다. 훅이 nvm 경로를 못 찾은 것이니
NVM_DIR 을 설정하거나 npm 을 PATH 에 올린 뒤 다시 시도하세요.
NPMMSG
  exit 2
fi

FAILED=""
if jq -e '.scripts.typecheck' package.json >/dev/null 2>&1; then
  echo "pre-push-verify: npm run typecheck 실행 중" >&2
  npm run typecheck --silent || FAILED="typecheck"
fi
if [ -z "$FAILED" ] && jq -e '.scripts.lint' package.json >/dev/null 2>&1; then
  echo "pre-push-verify: npm run lint 실행 중" >&2
  npm run lint --silent || FAILED="lint"
fi
if [ -z "$FAILED" ] && jq -e '.scripts.test' package.json >/dev/null 2>&1; then
  echo "pre-push-verify: npm test 실행 중" >&2
  npm test --silent || FAILED="test"
fi

[ -z "$FAILED" ] && { echo "pre-push-verify: 통과" >&2; exit 0; }

cat >&2 <<MSG
push를 차단했습니다: npm run $FAILED 가 실패했습니다.

이 저장소는 main push가 곧 프로덕션 배포이며 CI는 Docker 빌드 성공만 확인합니다.
즉 지금 push하면 이 실패는 아무 데서도 걸러지지 않고 운영에 반영됩니다.

검증 없이 진행해야 할 정당한 사유가 있다면 CLAUDE_SKIP_PUSH_VERIFY=1 을 설정하세요.
MSG
exit 2
