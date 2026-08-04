# CLAUDE.md — instructions projet

## 🔴 Règle n°1 — la mémoire technique

**[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) est la mémoire technique de ce projet.**

1. **Avant de modifier du code**, lis la ou les sections concernées (table de routage
   ci-dessous). Ce document contient des invariants qui ne se déduisent pas du code et dont
   la violation casse des choses silencieusement.
2. **Après avoir modifié du code**, mets-le à jour **dans le même commit**.

> **Une fonctionnalité n'est pas terminée tant que `docs/ARCHITECTURE.md` n'est pas à jour.**
> Ce n'est pas de la documentation optionnelle : c'est le seul endroit où survivent les
> décisions, les pièges et les raisons. Un correctif livré sans mise à jour de ce fichier
> est un correctif à moitié fait, et il sera à re-découvrir de zéro à la session suivante.

Le protocole exact (quelle section pour quel type de changement, règles d'écriture,
*definition of done*) est en **§0** du document.

## Table de routage — quoi lire avant quoi

| Tu vas toucher à… | Lis d'abord |
|---|---|
| N'importe quoi, la première fois | §1 §2 |
| `cards.json`, le matching de noms, les images | §3 |
| La forme d'un deck, `localStorage`, `normalizeDeck` | §4 |
| L'état de `App.jsx`, les mutations, les props | §5 |
| `web/src/lib/rules/**` — **toujours** | §6 |
| `web/src/lib/export/**`, les dimensions d'impression | §7 |
| Le tampon proxy, `scripts/make_proxy_patches.py` | §8 |
| Les traductions, une nouvelle langue, du texte FR | §9 |
| Les composants, le CSS, le mobile, l'a11y | §10 |
| Ajouter des tests | §11 |
| Comprendre pourquoi c'est fait comme ça | §12 |
| Savoir ce qui existe déjà | §13 |
| Savoir ce qui est cassé ou différé | §14 |

## Le projet en dix lignes

SPA **100 % statique** (Vite + React 18, JSX, pas de TypeScript) pour construire des decks
**MECCG** et exporter des fichiers prêts à imprimer chez **MPC** ou en planches PDF.

- **Aucun backend.** Pas de route API, pas de secret, pas de SSR.
- **Les images viennent d'un CDN** (jsDelivr) ; le dépôt n'héberge que les dos et les patchs proxy.
- **Les decks vivent dans `localStorage`.** Pas de compte, pas de base, pas de synchro.
- **Les exports tournent dans le navigateur** : `canvas`, `pdf-lib`, `jszip`. Aucune
  dépendance native.
- **Le moteur de règles avertit, il ne bloque pas** (sauf les caps marqués `hard: true`).

```bash
npm run dev     # Vite HMR → http://localhost:5173
npm test        # Vitest — 33 fichiers, 594 tests
npm run build   # → web/dist
```

Déploiement : Cloudflare Pages, projet **`meccg-deckprint`** (≠ nom du dépôt).
Preview par branche : `https://<branche>.meccg-deckprint.pages.dev` — utile pour montrer
un travail sur téléphone. Détails et pièges de vérification en §2.

## Conventions non négociables

- **Français pour la prose** (docs, README, messages destinés au propriétaire),
  **anglais pour le code** (identifiants, commentaires, ids de règles, messages de commit).
- **Vocabulaire FR imposé et gardé par un test** : pioche / talon / réserve / péril /
  séide / progression. Trois de ces mots ont **changé de référent** — voir §9 avant
  d'écrire du texte français.
- **« Faction » ne désigne jamais un camp.** En MECCG c'est une catégorie de carte. Le mot
  est **camp** (`side`). Un test le vérifie.
- **Les ids de règles restent en anglais** (`AVATAR-SIDEBOARD`) : les joueurs les citent.
- **Pas de nouvelle dépendance runtime** sans raison forte. Il y en a deux : `jszip` et
  `pdf-lib`.
- **Une source unique de vérité par domaine.** `zones.js`, `copies.js`, `roles.js`,
  `deckSections.js`, `proxy.js` sont autoritaires. Réimplémenter leur logique ailleurs est
  une régression, pas une optimisation.
- Écris du code qui ressemble au code voisin : les commentaires de ce dépôt expliquent le
  *pourquoi* et les pièges, pas le *quoi*. Tiens ce niveau.

## Avant de dire « c'est fini »

- [ ] `npm test` passe — **0 échec**, y compris les erreurs de transformation esbuild
      (une erreur de syntaxe JSX fait échouer un fichier de test **à la compilation**,
      pas à l'assertion : lis le compte de *fichiers*, pas seulement celui des tests).
- [ ] `docs/ARCHITECTURE.md` à jour : sections concernées + §15 (journal daté) + la date
      en tête du fichier.
- [ ] `README.md` à jour si le changement est visible par l'utilisateur.
</content>
</invoke>
