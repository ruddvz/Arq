# Scripts

## Validate the pack

```bash
python scripts/validate_pack.py
```

## Generate GitHub CLI issue commands

```bash
python scripts/generate_github_issue_commands.py > create-issues.sh
```

Review the generated script before running it.

## Generate GitHub label commands

```bash
python scripts/generate_label_commands.py > create-labels.sh
```

These scripts do not create or modify a repository by themselves.
