Run a full audit and release of this project using a staged, model-routed workflow. Delegate each stage to a subagent with the model specified below. Do not do the stage work yourself in the main session.

STAGE 0 - Baseline (you, no subagent)
- Identify the stack: backend, database (schema/migrations), frontend. Read README and config files only to map the layout.
- Run the existing test, lint, and build commands. Record results in a short table.
- If tests or build fail, stop and report the failures before continuing.

STAGE 1 - Review (subagent, model: sonnet)
Spawn a general-purpose subagent with model "sonnet". Give it this brief:
- Review the entire codebase read-only. Do not edit files.
- Cover: API contracts and input validation; auth and RBAC checks on every route; DB queries (N+1, missing indexes, unsafe string-built SQL); migration safety; secrets or keys committed in code; frontend error and loading states; real-time sync edge cases.
- Output a findings list. Each item: file path and line, severity (critical/high/medium/low), one-sentence description, and a tag "SIMPLE" (mechanical fix) or "HARD" (race conditions, schema changes, auth/RBAC logic, migrations, or anything requiring design judgment).
- Do not report style nits.

STAGE 2 - Fixes
- SIMPLE findings: spawn a subagent with model "sonnet" to apply them. Give it the exact findings list. Run tests after.
- HARD findings: spawn a subagent with model "opus" for each hard finding or tightly related group. Give it the finding, the relevant files, and the acceptance criteria. It must run tests and explain the root cause in its report.
- After each fix subagent finishes, verify with tests. If tests fail, send the failure back to the same subagent; do not patch it yourself.

STAGE 3 - Frontend check
- Start the dev server, then run the frontend tests and any e2e tests that exist.
- If there are no tests for the changed UI, spawn a subagent with model "sonnet" to add minimal tests for the changed components and routes.

STAGE 4 - Git (subagent, model: haiku)
Spawn a subagent with model "haiku" with these rules:
- Create branch review/full-audit-<YYYY-MM-DD>. Never commit to main.
- Before any commit, run git status and git diff --staged. Stop and report if you find .env files, API keys, tokens, node_modules, build output, or other secrets. Check .gitignore first.
- Make separate commits in this order: (1) backend, (2) database/migrations, (3) frontend, (4) tests and docs. Each commit message names the stage and summarizes the change in one line.
- Run the test suite before each push. If it fails, stop.
- Push the branch with -u. Do not open a PR or merge unless I ask.
- Return the branch name, commit hashes, and the push result.

FINAL REPORT (you)
- Stage results, model used per stage, findings fixed vs. deferred, test status, branch name.
- List any findings you deferred and why.
- Do not claim anything passed unless you ran it and saw it pass.