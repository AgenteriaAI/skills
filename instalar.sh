#!/bin/sh
# Copia las skills de este repositorio a ~/.claude/skills, donde Claude Code las encuentra.
set -e
cd "$(dirname "$0")"
mkdir -p "$HOME/.claude/skills"
for s in skills/*/; do
  n=$(basename "$s")
  rm -rf "$HOME/.claude/skills/$n"
  cp -R "$s" "$HOME/.claude/skills/$n"
  echo "Instalada: $n"
done
echo "Listo. Abre Claude Code y pídele: «Hazme un Short sobre …»"
