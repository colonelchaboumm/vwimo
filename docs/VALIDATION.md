# Livraison 0.3 — 20 octobre 2026

- Backend : 35 tests réussis, dont démarrage autonome, conservation des dossiers et sauvegarde avant migration.
- Interface : les 10 parcours existants passent ; les scénarios de mise à jour vérifient la détection, le clic explicite avant installation, le refus simulé d’une signature, l’état hors ligne et l’état à jour.
- Windows autonome : démarrage du backend embarqué, connexion, création de contact, import/téléchargement PDF et déconnexion réussis dans WebView2. Une requête sans clé du processus parent est refusée.
- Installateur NSIS 0.3.0 et signature Tauri générés. Backend et runtime Python inclus (~27 Mo compressés).
- Publication : code source, workflow de vérification, workflow de release, manifeste latest.json et empreinte SHA-256. La clé privée est exclue de Git et enregistrée comme secret Actions avec autorisation explicite du propriétaire.

Les tests d’interface des mises à jour utilisent un pont natif simulé ; ils ne valident pas à eux seuls le remplacement d’une ancienne installation. L’installation et une mise à niveau sur une machine vierge restent à vérifier. La distribution autonome est actuellement en mode démonstration SQLite. Les données du mode navigateur de développement sont distinctes ; voir MISES-A-JOUR.md.

Le compte rendu ci-dessous décrit la version 0.2 antérieure, dont le backend était encore séparé.

---

# Vérifications de la livraison 0.2

Effectuées sous Windows le 19 octobre 2026. Les bases de test sont séparées de la démonstration de l’utilisateur.

| Vérification | Résultat |
|---|---|
| TypeScript et Vite, build de production | Réussis |
| Backend et migrations SQLite | 33 tests réussis |
| Backend et migrations PostgreSQL portable | 32 réussis, 1 ignoré (sauvegarde spécifique à SQLite) |
| Parcours Chromium / Playwright | 10 réussis |
| Exécutable Windows / WebView2 | Connexion, création de contact, import/téléchargement PDF, tableau de bord et déconnexion réussis |
| Compilation native Tauri | Réussie avec Rust/Cargo 1.99.1 et MSVC |
| Installateur NSIS x64 | IMMO PILOT AI_0.2.0_x64-setup.exe, environ 2 Mo |
| Audit npm | 0 vulnérabilité signalée |
| Sauvegarde locale puis migration des données existantes | Réussies ; archive avant-0.2-20261019.zip |
| Lanceur PostgreSQL en cas d’échec | Retour non nul confirmé par une collecte volontairement invalide |
| Installation effective NSIS, signature, updater | Non vérifiés / non livrés |
| Workflow GitHub Actions | Fourni, non exécuté à distance |

## Parcours navigateur vérifiés

1. Tableau de bord, recherche globale, modes clair/sombre, absence de débordement à 1024 et 390 pixels.
2. Création vendeur → mandat → modification de prix → rechargement/reconnexion → persistance.
3. Critères acquéreur → document associé → téléchargement → préférence d’automatisation → déconnexion.
4. Conservation des champs après changement de profil et tentative de fermeture, puis abandon explicite.
5. Recherche sans accents, choix du tri, filtres conservés séparément par page.
6. Conflit 409 : message visible, saisie conservée, enregistrement à nouveau disponible.
7. Écriture confirmée suivie d’un rafraîchissement 503 : formulaire fermé, avertissement distinct, une seule fiche après actualisation.
8. Expiration 401 avec réponse de contacts retardée : retour à la connexion, ancienne réponse ignorée, reconnexion fonctionnelle.
9. Présentation en lecture seule : créations désactivées, fiche lisible, accès aux paramètres et à la déconnexion à 390 pixels.
10. Déconnexion locale malgré une erreur réseau, avec signalement de la révocation non confirmée.

Les scénarios d’erreur du navigateur sont simulés par interception ciblée ; les créations et modifications ordinaires utilisent la véritable API. Le rôle lecteur est simulé côté interface pour sa présentation et testé indépendamment côté backend pour le refus des écritures.

## Vérifications backend

Authentification, révocation/expiration, mot de passe avec espaces, limitation des tentatives, compte désactivé, nettoyage des sessions, droits lecteur, budgets/dates/honoraires, références uniques, autorisation intercabinets, archivage contrôlé, écritures obsolètes, rollback du bien en cas de référence dupliquée, précision décimale, UTC sur les deux moteurs, statistiques et ordre des urgences.

Documents invalides, vides ou trop gros, limite des requêtes sans Content-Length, noms longs conservant l’extension, empreinte contrôlée au téléchargement, stockage non exposé. Santé de la base vérifiée et erreur 503 testée. Sauvegarde/restauration SQLite avec documents, rejet de chemins malveillants et invalidation des sessions restaurées.

Les captures dans docs/screenshots montrent les interfaces testées. windows-webview2.png provient de l’exécutable compilé, testé via un port de débogage ouvert uniquement pour ce test. Aucune clé API ni aucun envoi externe n’a été nécessaire.

## Limites

Ces résultats couvrent les scénarios listés, pas l’absence de tout bug. L’installation NSIS sur une machine vierge, les autres versions de Windows/WebView2, les volumes importants, le déploiement réel, les intégrations externes et les sauvegardes PostgreSQL orchestrées restent à vérifier. L’installateur embarque uniquement le client ; le backend doit tourner séparément.

Un avertissement de dépréciation Starlette/httpx subsiste dans l’outil de test ; il ne provoque pas d’échec. Aucun message WinError 10022 n’est réapparu dans les dix parcours après le changement de boucle réseau.
