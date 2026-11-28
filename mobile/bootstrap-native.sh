#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ -e native ]; then
  echo "Le dossier mobile/native existe déjà; aucune modification effectuée."
  exit 1
fi
npx --yes @react-native-community/cli@latest init StrasDrive --directory native --package-name fr.strasdrive.app
echo "Projet généré. Vérifier les dépendances, la signature et la compilation avant intégration."
