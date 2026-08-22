#!/usr/bin/env bash
# Symlink this skill into ~/.cursor/skills for global Cursor use.
set -euo pipefail

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_ROOT="${HOME}/.cursor/skills"
LINK_PATH="${TARGET_ROOT}/eng-bee-dee-dee"

mkdir -p "${TARGET_ROOT}"

if [[ -e "${LINK_PATH}" || -L "${LINK_PATH}" ]]; then
  if [[ -L "${LINK_PATH}" ]]; then
    CURRENT="$(readlink "${LINK_PATH}")"
    if [[ "${CURRENT}" == "${SKILL_DIR}" ]]; then
      echo "Already installed: ${LINK_PATH} -> ${SKILL_DIR}"
      exit 0
    fi
    if [[ "${FORCE}" -eq 1 ]]; then
      rm "${LINK_PATH}"
    else
      echo "error: ${LINK_PATH} already exists and points to:" >&2
      echo "  ${CURRENT}" >&2
      echo "Re-run with --force to replace it." >&2
      exit 1
    fi
  else
    if [[ "${FORCE}" -eq 1 ]]; then
      rm -rf "${LINK_PATH}"
    else
      echo "error: ${LINK_PATH} exists and is not a symlink." >&2
      echo "Re-run with --force to replace it." >&2
      exit 1
    fi
  fi
fi

ln -sfn "${SKILL_DIR}" "${LINK_PATH}"
echo "Installed: ${LINK_PATH} -> ${SKILL_DIR}"
