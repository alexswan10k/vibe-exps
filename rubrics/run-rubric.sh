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
                If omitted, enumerates existing submissions AND lists every
                model the installed harnesses (opencode/pi) can execute,
                marked ✔ done / ○ not run for this test.

Options:
  -l, --list      List tests / models and exit (non-interactive; bypasses the menu)
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
  rubrics/run-rubric.sh                                              # interactive menu (TTY): pick test → model → run
  rubrics/run-rubric.sh minecraft-clone                              # ditto, straight to the model menu
  rubrics/run-rubric.sh minecraft-clone --list                       # non-interactive listing (also default when piped)
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

# harness model-id -> submission dir slug, e.g. opencode + opencode/muse-spark-1.2-x -> opencode-opencode-muse-spark-1-2-x
model_slug() {
  printf '%s-%s' "$1" "$(printf '%s' "$2" | tr '/.' '--')"
}

# ---- model catalog from installed harnesses ---------------------------------
AV_IDS=(); AV_H=(); AV_DONE=(); AV_SLUG=(); SUBS=()

collect_models() { # $1=test_dir — fills AV_* + SUBS arrays (deduped across harnesses)
  local test_dir="$1" pairs="" ids="" id h csv slug hs i m d done_flag done_slug
  if command -v opencode >/dev/null 2>&1; then
    while IFS= read -r id; do [[ -n "$id" ]] && pairs+="opencode|$id"$'\n'; done < <(opencode models 2>/dev/null)
  fi
  if command -v pi >/dev/null 2>&1; then
    if command -v jq >/dev/null 2>&1; then
      ids="$( { [[ -f "$HOME/.pi/agent/models.json" ]] && jq -r '.providers // {} | to_entries[] | .key as $p | .value.models[]? | $p + "/" + .id' "$HOME/.pi/agent/models.json" 2>/dev/null
                [[ -f "$HOME/.pi/agent/models-store.json" ]] && jq -r 'to_entries[] | .key as $p | .value.models[]? | $p + "/" + .id' "$HOME/.pi/agent/models-store.json" 2>/dev/null; } | sort -u )"
    fi
    while IFS= read -r id; do [[ -n "$id" ]] && pairs+="pi|$id"$'\n'; done <<<"$ids"
  fi

  SUBS=()
  for d in "$test_dir"/*/; do
    [[ -d "$d" ]] || continue
    m="$(basename "$d")"
    [[ "$m" == "_template" ]] && continue
    SUBS+=("$m")
  done

  AV_IDS=(); AV_H=(); AV_DONE=(); AV_SLUG=()
  while IFS= read -r id; do [[ -n "$id" ]] && AV_IDS+=("$id"); done < <(printf '%s' "$pairs" | cut -d'|' -f2- | sort -u)
  for i in "${!AV_IDS[@]}"; do
    id="${AV_IDS[$i]}"
    csv="$(printf '%s\n' "$pairs" | awk -F'|' -v want="$id" '$2==want{print $1}' | sort -u | paste -sd, -)"
    AV_H+=("$csv")
    IFS=',' read -ra hs <<<"$csv"
    done_flag=0; done_slug=""
    for h in "${hs[@]}"; do
      slug="$(model_slug "$h" "$id")"
      if [[ -d "$test_dir/$slug" ]]; then done_flag=1; done_slug="$slug"; break; fi
    done
    AV_DONE+=("$done_flag"); AV_SLUG+=("$done_slug")
  done
}

show_av_models() { # numbered list of runnable models (no submissions header)
  local i mark
  if [[ ${#AV_IDS[@]} -eq 0 ]]; then
    echo "  (no harness CLI found — install opencode or pi, or pass -- <agent command>)"
    return
  fi
  echo "Available to execute:"
  for i in "${!AV_IDS[@]}"; do
    if [[ "${AV_DONE[$i]}" == "1" ]]; then mark="✔ done (${AV_SLUG[$i]})"; else mark="○ not run"; fi
    printf '  %2d) %-45s [%s]  %s\n' "$((i+1))" "${AV_IDS[$i]}" "${AV_H[$i]}" "$mark"
  done
}

show_subs() { # numbered rerun list of existing submissions
  local i
  if [[ ${#SUBS[@]} -eq 0 ]]; then echo "Existing submissions: (none)"; return; fi
  echo "Existing submissions (rerun with r<N>):"
  for i in "${!SUBS[@]}"; do printf '  R%d) %s\n' "$((i+1))" "${SUBS[$i]}"; done
}

pick_test_interactive() { # sets TEST from menu
  local tests=() d i ans
  for d in "$ROOT"/rubrics/*/; do [[ -d "$d" ]] || continue; tests+=("$(basename "$d")"); done
  if [[ ${#tests[@]} -eq 0 ]]; then echo "no tests found under $ROOT/rubrics" >&2; exit 1; fi
  echo "Rubric runner — pick a test:"
  for i in "${!tests[@]}"; do printf '  %d) %s\n' "$((i+1))" "${tests[$i]}"; done
  while :; do
    read -rp "test [1-${#tests[@]}, q=quit]: " ans || exit 0
    [[ -z "$ans" ]] && continue
    [[ "$ans" == "q" ]] && exit 0
    if [[ "$ans" =~ ^[0-9]+$ ]] && (( ans >= 1 && ans <= ${#tests[@]} )); then TEST="${tests[$((ans-1))]}"; return; fi
    echo "invalid choice: $ans" >&2
  done
}

ask_mode_and_run() { # $1=model-slug $2=harness[:id] — confirm and exec self
  local slug="$1" harness="$2" mm yn
  read -rp "mode: [1] interactive (default) or [2] headless: " mm || exit 0
  local cmd=("$SCRIPT_DIR/$RUNNER_NAME" "$TEST" "$slug" --harness "$harness")
  [[ "$mm" == "2" ]] && cmd+=(--headless)
  echo ""
  echo "→ ${cmd[*]}"
  read -rp "run it? [Y/n]: " yn || exit 0
  case "$yn" in n|N) return ;; esac
  exec "${cmd[@]}"
}

pick_model_interactive() { # $1=test_dir — menu loop; execs self or exits
  local test_dir="$1" ans i h csv hs first pick id slug j hits mark
  collect_models "$test_dir"
  echo ""
  show_subs
  show_av_models
  while :; do
    echo ""
    read -rp "run # | r# rerun | text=filter | l=list | q=quit: " ans || exit 0
    case "$ans" in
      "") continue ;;
      q|Q) exit 0 ;;
      l|L) show_subs; show_av_models; continue ;;
    esac
    if [[ "$ans" =~ ^[0-9]+$ ]] && (( ans >= 1 && ans <= ${#AV_IDS[@]} )); then
      i=$((ans-1)); id="${AV_IDS[$i]}"
      csv="${AV_H[$i]}"; IFS=',' read -ra hs <<<"$csv"
      if [[ ${#hs[@]} -gt 1 ]]; then
        first="${hs[0]}"
        read -rp "harness [${hs[*]}] (default $first): " h || exit 0
        [[ -z "$h" ]] && h="$first"
        case ",$csv," in *",$h,"*) ;; *) echo "unknown harness: $h" >&2; continue ;; esac
      else
        h="${hs[0]}"
      fi
      ask_mode_and_run "$(model_slug "$h" "$id")" "$h:$id"
      continue
    fi
    if [[ "$ans" =~ ^r([0-9]+)$ ]] && (( BASH_REMATCH[1] >= 1 && BASH_REMATCH[1] <= ${#SUBS[@]} )); then
      pick="${SUBS[$((BASH_REMATCH[1]-1))]}"
      h="opencode"; [[ "$pick" == pi-* ]] && h="pi"
      read -rp "model id for rerun (Enter = harness default, provider/id): " id || exit 0
      if [[ -n "$id" ]]; then ask_mode_and_run "$pick" "$h:$id"; else ask_mode_and_run "$pick" "$h"; fi
      continue
    fi
    hits=0
    for j in "${!AV_IDS[@]}"; do
      if printf '%s' "${AV_IDS[$j]}" | grep -qi -- "$ans"; then
        [[ $hits == 0 ]] && { echo "matches:"; hits=1; }
        if [[ "${AV_DONE[$j]}" == "1" ]]; then mark="✔ done (${AV_SLUG[$j]})"; else mark="○ not run"; fi
        printf '  %2d) %-45s [%s]  %s\n' "$((j+1))" "${AV_IDS[$j]}" "${AV_H[$j]}" "$mark"
      fi
    done
    [[ $hits == 0 ]] && echo "no match: $ans (l = full list)" >&2
  done
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

RUNNER_NAME="$(basename "$SCRIPT_SRC")"

# Interactive wizard when run bare in a terminal (no flags/command given).
WIZARD="0"
if [[ -t 0 && -t 1 && "$LIST" == "0" && "$ALL" == "0" && -z "$HARNESS" && ${#AGENT_CMD[@]} -eq 0 ]]; then
  WIZARD="1"
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

# No test at all: interactive menu in a terminal, otherwise enumerate + usage
if [[ -z "$TEST" ]]; then
  if [[ "$WIZARD" == "1" ]]; then
    pick_test_interactive
  else
    usage >&2
    echo "" >&2
    list_tests "$ROOT"
    exit 1
  fi
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
  # Default no-model behavior: interactive menu in a terminal, else list + exit
  if [[ "$WIZARD" == "1" ]]; then
    pick_model_interactive "$TEST_DIR"
  fi
  list_models "$TEST_DIR"
  echo ""
  collect_models "$TEST_DIR"
  show_av_models
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
