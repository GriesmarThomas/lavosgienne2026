# La Vosgienne 2026

Application de quiz Angular déployée sur Vercel.

## Banque de questions

Le fichier `src/assets/questions/questions.json` fournit les questions initiales. Au premier appel de l’API, cette banque est copiée dans un stockage privé Vercel Blob ; les changements faits depuis l’administration sont ensuite conservés dans ce stockage.

Les routes `/api/questions` et `/api/admin/*` sont des Vercel Functions. Pour lancer l’application en local avec ces routes, relier le projet Vercel puis utiliser `vercel dev` (avec le Vercel CLI installé).

Les photos intégrées aux questions historiques sont servies depuis `src/assets/questions/photos`. L’administration permet d’ajouter jusqu’à 8 photos JPG, PNG ou WebP (3 Mo au total) lors de la création d’une question. Elles sont stockées dans le Blob privé et servies par `/api/question-images` pour le quiz ; les photos existantes sont conservées lors d’une modification.

## Administration

Ouvrir `/admin` et se connecter avec le compte configuré dans les variables d’environnement Vercel :

- `ADMIN_USERNAME` : identifiant (par défaut recommandé : `admin`)
- `ADMIN_PASSWORD` : mot de passe fort, défini comme secret Vercel
- `ADMIN_SESSION_SECRET` : clé aléatoire dédiée à la signature de session
- `BLOB_READ_WRITE_TOKEN` : ajouté automatiquement lorsque le Blob privé est relié au projet

Ne pas enregistrer de mot de passe dans le code ou dans le dépôt. Les sessions utilisent un cookie `HttpOnly` limité à 8 heures ; l’API vérifie l’authentification avant toute lecture ou modification réservée à l’admin.

## Développement et déploiement

- `npm start` démarre le serveur Angular seul.
- `vercel dev` démarre le projet avec ses Vercel Functions et les variables locales.
- `npm run build` compile l’application Angular.
- Les déploiements Vercel utilisent `npm run build` et le répertoire Angular `dist/la-vosgienne/browser`.