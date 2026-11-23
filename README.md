# Pipeline d'extraction de factures

Lit des factures fournisseurs PDF avec l'API Mistral (OCR puis LLM), valide les données avec Zod, contrôle leur cohérence, puis les affiche sur une page web pour un comptable.

Règle suivie partout : **un champ vide vaut mieux qu'une valeur fausse**. Une valeur incertaine devient `null` avec un avertissement ; un calcul incohérent est signalé avec l'écart ; rien n'est jamais corrigé automatiquement.

Architecture détaillée et justification des choix : [`docs/architecture.pdf`](docs/architecture.pdf).

## Démarrage (moins de 5 minutes)

Prérequis : Node.js 20.12 ou plus récent, une clé API Mistral ([console.mistral.ai](https://console.mistral.ai), plan gratuit « Experiment »).

```bash
npm install
cp .env.example .env        # puis collez votre clé dans MISTRAL_API_KEY
npm start                   # extrait les factures de invoices/, puis ouvre http://localhost:5173
```

Avec Docker (sans installer Node) : `cp .env.example .env`, collez la clé, puis `docker compose up --build` et ouvrez http://localhost:5173. La clé est lue au démarrage du conteneur, jamais copiée dans l'image.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm start` | Pipeline puis interface, en une commande |
| `npm run extract` | Traite `invoices/` et écrit `interface/public/results.json` |
| `npm run extract -- chemin/du/dossier` | Traite un autre dossier |
| `npm run extract -- test-invoices` | Traite la facture de test masquée (voir « Limites connues ») |
| `npm run dev` | Lance l'interface seule |
| `npm test` | Lance les 65 tests (sans clé ni réseau) |
| `npm run typecheck` | Vérifie les types TypeScript |
| `docker compose up --build` | Pipeline puis interface, dans un conteneur |

Configuration (`.env`) :

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `MISTRAL_API_KEY` | Clé API Mistral (obligatoire, jamais commitée) | – |
| `CONCURRENCY` | Nombre de factures traitées en même temps | `2` |

## Architecture

```text
invoices/*.pdf ──► pipeline (npm run extract) ──► interface/public/results.json ──► interface (npm run dev)
```

```text
pipeline/src/
├── index.ts            Point d'entrée : .env, clé, dossier, concurrence, écriture de results.json
├── processInvoice.ts   Pour UN fichier : lecture → OCR → LLM → Zod → normalisation → contrôles
├── mistral.ts          Seul fichier qui parle à Mistral (OCR, LLM, délai, relances, messages d'erreur)
├── prompt.ts           Consignes données au LLM
├── schema.ts           Schémas Zod et types, partagés avec l'interface
├── normalize.ts        Date réelle, quantité « 0 » refusée, avertissement pour chaque champ non lu
├── checks.ts           Contrôles de cohérence (une fonction par contrôle)
└── concurrency.ts      N traitements en parallèle au maximum, ordre conservé
pipeline/test/          Tests vitest (Mistral simulé)
test-invoices/          Facture 4 volontairement masquée, pour tester les valeurs cachées

interface/src/
├── App.tsx             Charge et revalide results.json, états chargement / erreur / prêt
├── status.ts           Statut d'une facture et problème de chaque ligne (écart, valeur non lue)
├── format.ts           Affichage des montants et des dates
└── components/         Summary, InvoiceCard, Alerts, Field, LineItemsTable
```

Le pipeline et l'interface ne communiquent que par `results.json`, et utilisent le même schéma Zod pour l'écrire et le relire.

## Ce que fait le pipeline

1. **Lecture** : un fichier absent ou qui n'est pas un PDF est refusé avant tout appel à l'API.
2. **OCR** (`mistral-ocr-latest`) : lit le PDF comme une image. Indispensable ici : le scan de 2009 n'a aucun texte intégré, et le texte intégré de la facture Hydrofluid est mal encodé (`€` et `É` illisibles).
3. **LLM structured output** (`mistral-small-latest`, `temperature: 0`) : format JSON imposé par un JSON Schema strict, généré depuis le schéma Zod.
4. **Validation Zod** : une réponse au mauvais format donne un échec pour ce PDF, jamais des données douteuses.
5. **Normalisation** : une date mal formée ou impossible (31 février) passe à `null` avec un avertissement ; une quantité lue « 0 » passe à `null` (une ligne facturée n'a jamais 0 article) ; chaque champ `null` reçoit un avertissement.
6. **Contrôles** (comparaison en centimes, tolérance 1 centime) :
   - quantité × prix unitaire = total de la ligne imprimé ;
   - somme des totaux de ligne = total HT ;
   - total HT + TVA = total TTC.

   Chaque contrôle vaut `ok`, `mismatch` (écart chiffré) ou `not_verifiable` (une valeur manque).

## Résultats sur les factures fournies

Exécution réelle avec Mistral, sur les 4 factures de `invoices/` : **4 lues, 0 en échec**.

| Facture | Résultat |
| --- | --- |
| Méca-Précision | Aucun écart détecté |
| Studio Botanica | À vérifier : ligne 2 (4 × 95 € = 380 €, imprimé 285 €) et somme des lignes ≠ total HT |
| Scan 2009 | À vérifier : avertissement sur le nom du fournisseur ; montants cohérents |
| Hydrofluid (texte mal encodé) | Aucun écart détecté : l'OCR lit l'image, pas le texte intégré |

Dans l'interface, la ligne en écart est surlignée en rouge et une ligne avec une valeur non lue est marquée en orange.

## Gestion des erreurs

| Cas | Comportement |
| --- | --- |
| Clé absente, dossier vide ou introuvable | Arrêt immédiat avec la solution |
| Fichier illisible ou pas un PDF | Échec pour ce fichier, sans appel à l'API |
| OCR vide, réponse du LLM non JSON ou hors schéma | Échec pour ce fichier, avec le détail |
| Erreur réseau, délai dépassé (60 s), 429, 5xx | Relances avec attente croissante, puis échec lisible |
| 401 et autres erreurs HTTP | Échec pour ce fichier, sans relance |

Une facture en échec reste visible dans l'interface avec son nom et la cause, et ne bloque jamais les autres.

## Choix techniques

Les principaux, détaillés avec leurs alternatives dans [`docs/architecture.pdf`](docs/architecture.pdf) :

- **Zod, source de vérité unique** : il fournit le JSON Schema imposé au LLM, valide sa réponse et `results.json`, et génère les types TypeScript.
- **Tout est nullable** : le LLM peut dire « je ne sais pas » au lieu d'inventer.
- **Total de ligne imprimé, jamais recalculé** : c'est lui qui révèle l'erreur de la facture Studio Botanica (4 × 95 € = 380 €, imprimé 285 €). La TVA est extraite pour la même raison : vérifier HT + TVA = TTC.
- **Calculs faits par le code, pas par le LLM.**
- **Mistral isolé dans un seul fichier** : le reste du pipeline ne connaît que `runOcr`, `extractInvoice` et `describeError`.
- **Un fichier JSON plutôt qu'un serveur** : suffisant pour une page sans base ni authentification.

## Limites connues

- Une valeur plausible mais mal lue ou mal attribuée peut passer tous les contrôles (échéance prise pour la date d'émission, référence de commande prise pour le numéro, jour/mois inversés). La relecture humaine reste nécessaire.
- Provenance au niveau du fichier, pas de la page ni de la position dans le PDF.
- Euro uniquement ; pas d'avoirs, de remises ni de TVA par ligne. Pas de contrôle « TVA = 20 % » : la facture de 2009 est à 19,6 %, et une facture peut mélanger plusieurs taux.
- Le nom du client (GARNIER Industrie) est écrit dans le prompt.
- **Valeurs masquées** : sur une facture où des cases ont été volontairement noircies ou raturées (`test-invoices/facture_4_masquee.pdf`), l'OCR invente une valeur sous la tache (« 0 », un montant copié de la case voisine, une désignation reconstruite) et le LLM, qui ne reçoit que ce texte, ne peut pas le voir. Ce qui est en place : la quantité « 0 » devient `null`, les écarts de calcul font passer la facture « À vérifier » et surlignent la ligne. Ce qui reste : un montant ou un texte inventé sans écart de calcul n'est pas mis à `null`. Trois solutions sans dépendance ont été testées et écartées (détail dans `docs/architecture.pdf`) ; la correction complète consiste à envoyer aussi l'image des pages au LLM, ce qui demande une bibliothèque de rendu PDF (`mupdf`).
- Testé sur les 4 factures fournies et une facture modifiée.

## De 4 à 4 000 factures par mois

- **File d'attente et workers** (BullMQ/Redis ou SQS) à la place d'un script sur un dossier : chaque facture est un travail indépendant, relancé seul en cas d'échec.
- **Base de données** (PostgreSQL) pour les résultats, statuts et historique ; l'interface lit une petite API.
- **Débit et coût** : concurrence réglée sur le quota Mistral, cache par empreinte SHA-256 pour ne jamais retraiter un doublon, coût suivi par facture.
- **Corrections du comptable enregistrées** (qui, quoi, quand) et réutilisées comme jeu de test pour mesurer la précision à chaque changement de prompt ou de modèle.
- **Contrôles enrichis** : fournisseur reconnu par SIRET ou n° de TVA, détection des doublons (même fournisseur + même numéro).
- **Observabilité** : taux d'échec et de « à vérifier » par fournisseur, temps et coût par facture.

## Temps passé

- Pipeline (B1) : à compléter
- Interface (B2) : à compléter
- Documentation et tests : à compléter
