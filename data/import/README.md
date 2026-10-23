# Import du Drive

Données tirées du dossier Google Drive partagé des costumes (octobre 2026).

- `drive-inventory.json` / `.csv` — une ligne par modèle (et par variante quand une photo en regroupe
  plusieurs) : catégorie, nom, quantité, couleurs, note, fichier Drive et son identifiant.
- `listes-manuscrites.md` — transcription des photos de listes manuscrites.
- `photos/<driveId>.jpg` — photos téléchargées et réduites (1600 px max).
- `tags.json` — mots-clés descriptifs par nom de pièce (thème, époque, style, matière, porteur),
  appliqués par `npx tsx scripts/enrich-tags.ts`. Ils alimentent la recherche ; complétez-les ici
  ou directement dans l'application.

Import dans l'application : `npx tsx scripts/import-drive.ts` (`--reset` pour remplacer un import
précédent). Chaque pièce comptée reçoit son propre code QR ; les pièces identiques partagent la photo.
