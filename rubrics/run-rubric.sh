#!/usr/bin/env bash
set -euo pipefail

# run-rubric.sh — isolated runner for rubrics/*
# Stops a model from reading sibling model folders.
#
# Two modes:
#   tmp  (default)  — copy test+single model into a mktemp dir with no siblings, run your agent there, rsync back
#   msb  (--msb)    — same staging but wrapped in a microsandbox microVM (hardware isolation, ~100ms boot)
#                    requires `msb` CLI: curl -fsSL https://install.microsandbox.dev | sh
#
# Usage:
#   rubrics/run-rubric.sh <test-slug> <model-name> [--msb|--tmp] [--force] [--interactive|--headless] -- <agent command>
#   rubrics/run-rubric.sh minecraft-clone my-model -- opencode run "Build from ../prompt.md"
#   rubrics/run-rubric.sh minecraft-clone my-model -- pi --approve "Build per ../prompt.md"
#   rubrics/run-rubric.sh minecraft-clone my-model --harness pi          # interactive (default)
#   rubrics/run-rubric.sh minecraft-clone my-model --harness pi --headless  # non-interactive -p
#   rubrics/run-rubric.sh minecraft-clone my-model --harness opencode     # interactive
#   (shim also at scripts/run-rubric.sh)
#
#   rubrics/run-rubric.sh <test-slug>               # enumerate models for that test
#   rubrics/run-rubric.sh --list                    # list all tests + models
#   rubrics/run-rubric.sh <test> --all -- <cmd>     # run <cmd> isolated for every model in test
#   rubrics/run-rubric.sh <test> <model> --harness pi|opencode  # interactive session in isolated stage
#
# If no <agent command> and no --harness, the script stages and prints next steps.
#
# See rubrics/README.md#isolation for the full protocol.

usage() {
  cat <<'USAGE'
Usage: rubrics/run-rubric.sh <test-slug> [model-name] [options] [-- <agent command>]
  (or scripts/run-rubric.sh — shim)

Args:
  <test-slug>   e.g. minecraft-clone
  [model-name]  e.g. my-model (lowercase, no spaces)
                If omitted, enumerates models for the test.

Options:
  -l, --list      List tests / models and exit (also default when no model given)
  --all           Run <agent command> for every model in <test> (requires <test> and -- <cmd>)
  --harness NAME  Start an interactive agent session in isolated stage: pi | opencode
                  Optionally with model: pi:provider/model or opencode:provider/model
                  Default is interactive; add --headless for non-interactive -p / run mode.
                  (shorthands: --pi, --opencode)
  --pi            Alias for --harness pi
  --opencode      Alias for --harness opencode
  --interactive   Force interactive session (default when --harness is used)
  --headless      Force headless / non-interactive mode (pi -p / opencode run with prompt injected)
  --msb           Use microsandbox (msb) microVM if available (falls back to tmp with warning if missing)
  --tmp           Force tmpdir isolation even if msb is installed (default when msb missing)
  --force         Overwrite existing model dir if it already has content (otherwise reuses it)
  --image IMG     msb image to use (default: debian:bookworm-slim). Only with --msb
  -h, --help      Show this help

Examples:
  rubrics/run-rubric.sh minecraft-clone                          # enumerate models
  rubrics/run-rubric.sh --list                                   # list all tests
  rubrics/run-rubric.sh minecraft-clone my-model --harness pi    # interactive pi in isolated stage
  rubrics/run-rubric.sh minecraft-clone my-model --harness opencode  # interactive opencode
  rubrics/run-rubric.sh minecraft-clone my-model --harness pi --headless  # headless pi -p
  rubrics/run-rubric.sh minecraft-clone my-model -- pi --approve "Build per ../prompt.md"
  rubrics/run-rubric.sh minecraft-clone --all --harness pi       # interactive for each model (sequential)
  rubrics/run-rubric.sh minecraft-clone --all -- echo "hello"   # run for every model

Isolation guarantee:
  The agent only sees rubrics/<test>/prompt.md, rubrics/<test>/rubric.md, rubrics/<test>/_template/ and rubrics/<test>/<model>/.
  Sibling ../<other-model>/ folders do not exist in the staged view.
USAGE
}

list_tests() {
  local root="$1"
  echo "Available tests:"
  for d in "$root"/rubrics/*/; do
    [[ -d "$d" ]] || continue
    local t
    t="$(basename "$d")"
    echo "  - $t"
  done
}

list_models() {
  local test_dir="$1"
  local test
  test="$(basename "$test_dir")"
  echo "Models in $test:"
  local found=0
  for d in "$test_dir"/*/; do
    [[ -d "$d" ]] || continue
    local m
    m="$(basename "$d")"
    [[ "$m" == "_template" ]] && continue
    echo "  - $m  ($d)"
    found=1
  done
  if [[ "$found" == "0" ]]; then
    echo "  (none — only _template exists)"
    echo "  Create one with: rubrics/run-rubric.sh $test <model-name> --harness pi"
    echo "               or: rubrics/run-rubric.sh $test <model-name> --harness opencode"
  fi
}

TEST=""
MODEL=""
MODE="auto"
FORCE="0"
MSB_IMAGE="debian:bookworm-slim"
HARNESS=""
HEADLESS="0"
INTERACTIVE_FLAG="0"
LIST="0"
ALL="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -l|--list) LIST="1"; shift ;;
    --all) ALL="1"; shift ;;
    --harness) HARNESS="$2"; shift 2 ;;
    --pi) HARNESS="pi"; shift ;;
    --opencode) HARNESS="opencode"; shift ;;
    --interactive) INTERACTIVE_FLAG="1"; HEADLESS="0"; shift ;;
    --headless) HEADLESS="1"; INTERACTIVE_FLAG="0"; shift ;;
    --msb) MODE="msb"; shift ;;
    --tmp) MODE="tmp"; shift ;;
    --force) FORCE="1"; shift ;;
    --image) MSB_IMAGE="$2"; shift 2 ;;
    --) shift; break ;;
    -*) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
    *)
      if [[ -z "$TEST" ]]; then TEST="$1"
      elif [[ -z "$MODEL" ]]; then MODEL="$1"
      else echo "Unexpected arg: $1" >&2; usage >&2; exit 1
      fi
      shift
      ;;
  esac
done

AGENT_CMD=("$@") # may be empty

# Robust ROOT detection: works whether invoked as rubrics/run-rubric.sh (from repo root),
# ./run-rubric.sh (from rubrics/), or via absolute path / symlink.
SCRIPT_SRC="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SRC")" && pwd)"
# script lives in rubrics/ or scripts/ — ROOT is its parent; if script is at repo root, ROOT is SCRIPT_DIR
if [[ "$(basename "$SCRIPT_DIR")" == "rubrics" || "$(basename "$SCRIPT_DIR")" == "scripts" ]]; then
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  ROOT="$SCRIPT_DIR"
  # fall back to git top-level if we guessed wrong and rubrics/ not found
  if [[ ! -d "$ROOT/rubrics" ]] && git rev-parse --show-toplevel >/dev/null 2>&1; then
    ROOT="$(git rev-parse --show-toplevel)"
  fi
fi

# --list with no test: list all tests + models
if [[ "$LIST" == "1" && -z "$TEST" ]]; then
  list_tests "$ROOT"
  echo ""
  for d in "$ROOT"/rubrics/*/; do
    [[ -d "$d" ]] || continue
    list_models "$d"
    echo ""
  done
  exit 0
fi

# No test at all: enumerate everything (friendly default)
if [[ -z "$TEST" ]]; then
  usage >&2
  echo "" >&2
  list_tests "$ROOT"
  exit 1
fi

TEST_DIR="$ROOT/rubrics/$TEST"
PROMPT_FILE="$TEST_DIR/prompt.md"

if [[ ! -d "$TEST_DIR" ]]; then
  echo "error: test not found: $TEST_DIR" >&2
  list_tests "$ROOT" >&2
  exit 1
fi

# If no model given: enumerate models for this test (or --all loops)
if [[ -z "$MODEL" ]]; then
  if [[ "$ALL" == "1" ]]; then
    if [[ ${#AGENT_CMD[@]} -eq 0 && -z "$HARNESS" ]]; then
      echo "error: --all requires an agent command: -- <cmd> or --harness <name>" >&2
      usage >&2
      exit 1
    fi
    # Expand --all: run for each model
    echo "→ --all: running for every model in $TEST"
    models=()
    for d in "$TEST_DIR"/*/; do
      [[ -d "$d" ]] || continue
      m="$(basename "$d")"
      [[ "$m" == "_template" ]] && continue
      models+=("$m")
    done
    if [[ ${#models[@]} -eq 0 ]]; then
      echo "No models found in $TEST — only _template exists." >&2
      list_models "$TEST_DIR" >&2
      exit 1
    fi
    # Re-invoke self for each model
    failures=0
    for m in "${models[@]}"; do
      echo ""
      echo "═══════════════════════════════════════════"
      echo "→ $TEST / $m"
      echo "═══════════════════════════════════════════"
      extra=()
      [[ "$MODE" != "auto" ]] && extra+=("--$MODE")
      [[ "$FORCE" == "1" ]] && extra+=("--force")
      [[ -n "$HARNESS" ]] && extra+=("--harness" "$HARNESS")
      [[ "$HEADLESS" == "1" ]] && extra+=("--headless")
      [[ "$INTERACTIVE_FLAG" == "1" ]] && extra+=("--interactive")
      [[ "$MSB_IMAGE" != "debian:bookworm-slim" ]] && extra+=("--image" "$MSB_IMAGE")
      if ! "$0" "$TEST" "$m" ${extra[@]:+"${extra[@]}"} -- ${AGENT_CMD[@]:+"${AGENT_CMD[@]}"}; then
        echo "✗ failed: $m" >&2
        failures=$((failures+1))
      fi
    done
    echo ""
    if [[ $failures -gt 0 ]]; then
      echo "$failures model(s) failed" >&2
      exit 1
    fi
    echo "All $TEST models done."
    exit 0
  fi
  # Default no-model behavior: list and exit
  list_models "$TEST_DIR"
  if [[ "$LIST" == "1" ]]; then exit 0; fi
  echo ""
  echo "Tip: run a model isolated: rubrics/run-rubric.sh $TEST <model> -- <agent command>"
  echo "     interactive: rubrics/run-rubric.sh $TEST <model> --harness pi"
  echo "     headless:    rubrics/run-rubric.sh $TEST <model> --harness pi --headless"
  echo "     or stage without running: rubrics/run-rubric.sh $TEST <model>"
  echo "     or run for all: rubrics/run-rubric.sh $TEST --all -- <agent command>"
  exit 0
fi

# At this point TEST and MODEL are set
# Handle --list after model given: just list and exit
if [[ "$LIST" == "1" ]]; then
  list_models "$TEST_DIR"
  exit 0
fi

# Validate no path traversal
if [[ "$TEST" == *"/"* || "$MODEL" == *"/"* || "$TEST" == *".."* || "$MODEL" == *".."* ]]; then
  echo "error: test/model must be single path components, no slashes" >&2
  exit 1
fi

MODEL_DIR="$TEST_DIR/$MODEL"
TEMPLATE_DIR="$TEST_DIR/_template"
RUBRIC_FILE="$TEST_DIR/rubric.md"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "error: prompt.md missing at $PROMPT_FILE" >&2
  exit 1
fi
if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "warn: _template not found at $TEMPLATE_DIR — continuing without template" >&2
fi

# If harness requested and no explicit command, build one
# Supports harness:model — e.g. pi:provider/model  or  opencode:provider/model
# Default is interactive (headless only with --headless).
if [[ -n "$HARNESS" && ${#AGENT_CMD[@]} -eq 0 ]]; then
  harness_name="${HARNESS%%:*}"
  harness_model="${HARNESS#*:}"
  if [[ "$harness_model" == "$HARNESS" ]]; then harness_model=""; fi
  case "$harness_name" in
    pi)
      if [[ "$HEADLESS" == "1" ]]; then
        if [[ -n "$harness_model" ]]; then
          AGENT_CMD=(pi --approve --model "$harness_model" -p "$(cat "$PROMPT_FILE")")
        else
          AGENT_CMD=(pi --approve -p "$(cat "$PROMPT_FILE")")
        fi
        echo "→ harness=pi${harness_model:+:$harness_model} (headless): ${AGENT_CMD[*]:0:120}..." >&2
      else
        # Interactive: launch pi with prompt as initial message (no -p), stays in TUI
        if [[ -n "$harness_model" ]]; then
          AGENT_CMD=(pi --approve --model "$harness_model" "$(cat "$PROMPT_FILE")")
        else
          AGENT_CMD=(pi --approve "$(cat "$PROMPT_FILE")")
        fi
        echo "→ harness=pi${harness_model:+:$harness_model} (interactive): ${AGENT_CMD[*]:0:120}..." >&2
      fi
      ;;
    opencode)
      if [[ "$HEADLESS" == "1" ]]; then
        if [[ -n "$harness_model" ]]; then
          AGENT_CMD=(opencode --auto -m "$harness_model" run "$(cat "$PROMPT_FILE")")
        else
          AGENT_CMD=(opencode --auto run "$(cat "$PROMPT_FILE")")
        fi
        echo "→ harness=opencode${harness_model:+:$harness_model} (headless): ${AGENT_CMD[*]:0:120}..." >&2
      else
        # Interactive opencode: TUI in the staged model dir. Prompt is on disk at ./prompt.md; also passed as initial message via --prompt if supported.
        # We use `opencode --prompt` when model is specified, otherwise plain `opencode` — both keep TUI interactive.
        # Fallback: if --prompt not supported, the agent will read ./prompt.md per AGENTS.md.
        if [[ -n "$harness_model" ]]; then
          AGENT_CMD=(opencode -m "$harness_model" --prompt "$(cat "$PROMPT_FILE")")
        else
          AGENT_CMD=(opencode --prompt "$(cat "$PROMPT_FILE")")
        fi
        # If --prompt fails (older opencode), it will error; user can retry with `opencode` + manual paste.
        echo "→ harness=opencode${harness_model:+:$harness_model} (interactive): ${AGENT_CMD[*]:0:120}..." >&2
        echo "  (if --prompt unsupported, run 'opencode' and paste prompt.md manually)" >&2
      fi
      ;;
    *)
      echo "error: unknown harness: $HARNESS (expected pi|opencode[:model])" >&2
      exit 1
      ;;
  esac
fi

# Decide mode — interactive sessions should not use msb (no TTY in VM); force tmp
if [[ -n "$HARNESS" && "$HEADLESS" == "0" && "$MODE" == "msb" ]]; then
  echo "warn: interactive harness with --msb is not TTY-capable; falling back to --tmp" >&2
  MODE="tmp"
fi

HAS_MSB="0"
if command -v msb >/dev/null 2>&1; then HAS_MSB="1"; fi

if [[ "$MODE" == "auto" ]]; then
  if [[ "$HAS_MSB" == "1" ]]; then MODE="msb"; else MODE="tmp"; fi
fi
if [[ "$MODE" == "msb" && "$HAS_MSB" == "0" ]]; then
  echo "warn: --msb requested but 'msb' not found. Install: curl -fsSL https://install.microsandbox.dev | sh  (or: brew install superradcompany/tap/microsandbox)" >&2
  echo "warn: falling back to tmp isolation" >&2
  MODE="tmp"
fi

# Ensure model dir exists (populate from template if empty)
if [[ ! -d "$MODEL_DIR" ]]; then
  echo "→ creating $MODEL_DIR from _template"
  mkdir -p "$MODEL_DIR"
  if [[ -d "$TEMPLATE_DIR" ]]; then
    cp -R "$TEMPLATE_DIR/." "$MODEL_DIR/"
  fi
else
  if [[ "$FORCE" == "1" && -d "$TEMPLATE_DIR" ]]; then
    echo "→ --force: resetting $MODEL_DIR from _template"
    rm -rf "$MODEL_DIR"
    mkdir -p "$MODEL_DIR"
    cp -R "$TEMPLATE_DIR/." "$MODEL_DIR/"
  else
    echo "→ using existing $MODEL_DIR (use --force to reset from _template)"
  fi
  # Ensure AGENTS.md exists even for pre-existing models
  if [[ -f "$TEMPLATE_DIR/AGENTS.md" && ! -f "$MODEL_DIR/AGENTS.md" ]]; then
    cp "$TEMPLATE_DIR/AGENTS.md" "$MODEL_DIR/AGENTS.md"
  fi
fi

# Build isolated stage — mirrors repo subtree but only one model
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/rubric-${TEST}-XXXX")"
# shellcheck disable=SC2064
trap "echo '→ stage at $STAGE (will be synced back on success)'; " EXIT
cleanup_stage() { :; }
mkdir -p "$STAGE/rubrics/$TEST/$MODEL"

echo "→ staging isolated view at $STAGE"
cp "$PROMPT_FILE" "$STAGE/rubrics/$TEST/prompt.md"
if [[ -f "$RUBRIC_FILE" ]]; then cp "$RUBRIC_FILE" "$STAGE/rubrics/$TEST/rubric.md"; fi
if [[ -d "$TEMPLATE_DIR" ]]; then
  mkdir -p "$STAGE/rubrics/$TEST/_template"
  cp -R "$TEMPLATE_DIR/." "$STAGE/rubrics/$TEST/_template/"
fi
# Copy current model content into stage (this is the only sibling visible)
cp -R "$MODEL_DIR/." "$STAGE/rubrics/$TEST/$MODEL/"
# Also make prompt/rubric available *inside* the model dir so the agent
# doesn't need external_directory permission to read ../prompt.md.
cp "$PROMPT_FILE" "$STAGE/rubrics/$TEST/$MODEL/prompt.md"
cp "$PROMPT_FILE" "$STAGE/rubrics/$TEST/$MODEL/PROMPT.md"
if [[ -f "$RUBRIC_FILE" ]]; then
  cp "$RUBRIC_FILE" "$STAGE/rubrics/$TEST/$MODEL/rubric.md"
fi

# Common: show what the agent will see
echo "→ isolated view contains:"
# shellcheck disable=SC2012
ls -R "$STAGE/rubrics/$TEST" 2>/dev/null | head -n 80 || find "$STAGE" -type f | head -n 80

# If no agent command, just stage and exit with instructions
if [[ ${#AGENT_CMD[@]} -eq 0 ]]; then
  cat <<MSG

Staged. No agent command given — nothing executed yet.

Next steps (pick one — interactive is recommended; headless often hangs):

  # Interactive pi (staged, isolated):
  (cd "$STAGE/rubrics/$TEST/$MODEL" && pi --approve "\$(cat prompt.md)")

  # Interactive opencode:
  (cd "$STAGE/rubrics/$TEST/$MODEL" && opencode)

  # Or re-run via harness flag (auto-reads prompt.md):
  rubrics/run-rubric.sh $TEST $MODEL --harness pi              # interactive
  rubrics/run-rubric.sh $TEST $MODEL --harness pi --headless   # headless (pi -p)
  rubrics/run-rubric.sh $TEST $MODEL --harness opencode        # interactive
  rubrics/run-rubric.sh $TEST $MODEL --harness opencode --headless

  # Explicit headless:
  (cd "$STAGE/rubrics/$TEST/$MODEL" && pi --approve -p "\$(cat prompt.md)")
  (cd "$STAGE/rubrics/$TEST/$MODEL" && opencode --auto run "\$(cat prompt.md)")

Then sync back:
  rsync -a --delete --exclude='prompt.md' --exclude='PROMPT.md' --exclude='rubric.md' "$STAGE/rubrics/$TEST/$MODEL/" "$MODEL_DIR/"

Or re-run this script with -- <agent command> to do it in one step.

Stage kept at: $STAGE
To clean up: rm -rf "$STAGE"
MSG
  trap - EXIT
  exit 0
fi

echo "→ agent command: ${AGENT_CMD[*]}"
echo "→ mode: $MODE (harness=${HARNESS:-none} headless=$HEADLESS)"

run_in_tmp() {
  echo "→ running in tmp isolation (no siblings mounted)"
  ( cd "$STAGE/rubrics/$TEST/$MODEL" && "${AGENT_CMD[@]}" )
}

run_in_msb() {
  local workdir="/workspace/rubrics/$TEST/$MODEL"
  echo "→ running in microsandbox (image: $MSB_IMAGE, workdir: $workdir)"
  local vol_args=(--volume "$STAGE:/workspace:rw" --workdir "$workdir")
  local oc_bin pi_bin
  oc_bin="$(command -v opencode 2>/dev/null || true)"
  pi_bin="$(command -v pi 2>/dev/null || true)"
  if [[ -n "${oc_bin:-}" && -f "$oc_bin" ]]; then
    vol_args+=(--volume "$oc_bin:/usr/local/bin/opencode:ro")
    echo "→ mounting host opencode: $oc_bin"
  fi
  if [[ -n "${pi_bin:-}" && -f "$pi_bin" ]]; then
    vol_args+=(--volume "$pi_bin:/usr/local/bin/pi:ro")
    echo "→ mounting host pi: $pi_bin"
  fi
  if [[ -d "$HOME/.config/opencode" ]]; then
    vol_args+=(--volume "$HOME/.config/opencode:/root/.config/opencode:ro")
  fi
  # shellcheck disable=SC2145
  echo "→ msb run ${vol_args[*]} $MSB_IMAGE -- bash -lc \"${AGENT_CMD[*]}\""
  msb run "${vol_args[@]}" "$MSB_IMAGE" -- bash -lc "${AGENT_CMD[*]}"
}

# Execute
set +e
if [[ "$MODE" == "msb" ]]; then
  run_in_msb
  RC=$?
  if [[ $RC -ne 0 ]]; then
    echo "warn: msb run failed (rc=$RC). Try: msb pull $MSB_IMAGE, or use --tmp" >&2
    echo "warn: retrying in tmp isolation" >&2
    run_in_tmp
    RC=$?
  fi
else
  run_in_tmp
  RC=$?
fi
set -e

if [[ $RC -ne 0 ]]; then
  echo "error: agent command failed (rc=$RC). Stage preserved at $STAGE for inspection." >&2
  trap - EXIT
  exit $RC
fi

echo "→ agent finished. Syncing back to $MODEL_DIR"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude='prompt.md' --exclude='PROMPT.md' --exclude='rubric.md' "$STAGE/rubrics/$TEST/$MODEL/" "$MODEL_DIR/"
else
  rm -rf "$MODEL_DIR"
  mkdir -p "$MODEL_DIR"
  cp -R "$STAGE/rubrics/$TEST/$MODEL/." "$MODEL_DIR/"
  rm -f "$MODEL_DIR/prompt.md" "$MODEL_DIR/PROMPT.md" "$MODEL_DIR/rubric.md"
fi

echo "→ verifying file:// safety (no type=module / importmap in html/js)"
if grep -R -n 'type="module"' --include="*.html" --include="*.js" --include="*.htm" "$MODEL_DIR" 2>/dev/null; then
  echo "warn: found type=\"module\" — this breaks file:// per prompt.md sec.2" >&2
fi
if grep -R -n 'importmap' --include="*.html" --include="*.js" --include="*.htm" "$MODEL_DIR" 2>/dev/null; then
  echo "warn: found importmap — this breaks file:// per prompt.md sec.2" >&2
fi

echo "→ done. Preview: open $MODEL_DIR/index.html (double-click, no server)"
echo "→ to grade: open rubrics/$TEST/rubric.md and play the demo 2 min"
echo "→ stage can be removed: rm -rf $STAGE"
trap - EXIT
rm -rf "$STAGE"
