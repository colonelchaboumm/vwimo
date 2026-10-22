# Livraison 0.9 — 22 octobre 2026

- Backend : 129 tests réussis sur SQLite. La suite PostgreSQL initiale compte 127 réussis et 1 ignoré ; les neuf cas partenaires/pilotage sont revérifiés après le dernier correctif et le test SQLite supplémentaire de migration financière depuis 0.8 passe également. Les dix nouveaux cas couvrent annuaire, recherche littérale, archivage, autorisation avant mise en relation, snapshot conservé après retrait, suivi historique avec contact archivé, types de dossiers, dates/clôture, historique concurrent, droits lecteur, revenus liés, devis périmés, dates annuelles et passage de schéma avec revenus/versements existants.
- Interface : 29 parcours réussis. Nouveau parcours complet partenaire → transmission refusée sans autorisation → autorisation déclarée → retrait conservant la trace initiale → revenu lié → pilotage sans duplication. Consultation lecteur et navigation des tableaux à 390 pixels vérifiées. Captures partenaires, historique et pilotage contrôlées visuellement.
- Périmètres des chiffres : portefeuille actuel indépendant du filtre annuel ; ventes par date d’acte, moyenne sur les seules dates disponibles ; agenda au passage d’année Europe/Paris ; versement d’une année associé à un revenu validé l’année précédente ; bases HT/TTC/contractuelles séparées.
- Conservation : la migration `20261022_partners` ajoute le lien des revenus sans modifier montants, versements ou références ; contrôle des clés étrangères et sauvegarde avant migration. L’aperçu local répond en version 0.9 après mise à niveau.
- Windows/WebView2 : suite native réussie, avec création d’un partenaire et d’un dossier, historique consultable et pilotage alimenté par le backend embarqué. Compilation TypeScript/Vite, exécutable Tauri, installateur NSIS et signature updater générés.

Les autorisations, transmissions, financements et résultats sont déclaratifs. Aucun envoi partenaire, agrément, droit à rémunération, facture, banque ou régime fiscal n’est vérifié automatiquement. L’installation sur machine vierge, le remplacement effectif par l’updater, les volumes importants et la politique d’effacement restent à vérifier ou compléter.

---

# Livraison 0.8 — 22 octobre 2026

- Backend : 119 tests réussis sur SQLite ; 118 réussis et 1 ignoré sur PostgreSQL. Les 22 nouveaux cas couvrent calculs par tranche/global, franchissement de seuil, arrondis au centime, reprise et remise à zéro mensuelle/annuelle, dates, unicité du dossier par mandat, versions, preuve déclarée, confirmation liée au calcul, validations concurrentes, encaissements partiels/idempotents et dépassement concurrent refusé, export CSV sûr et droits lecteur.
- Concurrence : une course entre relecture du barème et calcul a été reproduite puis corrigée en conservant le même objet versionné jusqu’à l’écriture. Le test impose deux calculs simultanés avant toute validation et exige un conflit pour le second. Les doublons de versement réessayés ne sont pas ajoutés ; un versement qui dépasse le reste est refusé.
- Interface : 27 parcours navigateur réussis, dont création transaction → barème → revenu prévisionnel au centime → recalcul → confirmation explicite → deux encaissements → réouverture persistante → export CSV. Contrôle supplémentaire à 390 pixels sans débordement horizontal. Captures transactions et finance vérifiées visuellement.
- Windows/WebView2 : suite native complète réussie avec compte local, documents/PDF, agenda, Charlie, clé fictive DPAPI, radar, carte, revenu courtier fixe, validation et encaissement partiel. Backend embarqué et données isolées, sans fermer l’application personnelle.
- TypeScript/Vite, compilation Tauri, installateur NSIS 0.8.0 et signature updater générés. L’aperçu local répond en version 0.8.0 après sauvegarde automatique et migration `20261022_finance`.
- Le délai d’arrêt du PostgreSQL de test passe de 10 à 30 secondes après un dépassement sous charge ; une erreur de démarrage, de test ou d’arrêt conserve un code de sortie non nul. Nouvelle exécution complète réussie avec arrêt confirmé.

Les montants sont déclaratifs et les conditions contractuelles restent saisies par l’utilisateur. Aucun régime fiscal, seuil ou taux de rémunération réel n’est inventé. Aucune facture, déclaration fiscale, banque, correction/avoir sur revenu validé ou connexion Microsoft réelle n’est livrée ici. L’installation sur machine vierge et le remplacement effectif d’une installation par l’updater restent à vérifier.

---

# Livraison 0.7 — 22 octobre 2026

- Backend : suite de 97 tests sur SQLite ; 96 réussis et 1 ignoré sur PostgreSQL. Les 16 nouveaux tests couvrent radar/imports, URL canoniques, transactions sans écriture partielle, historique des prix, conflits concurrents, rôles, séquences de prospection, arrêt, compteurs Europe/Paris et préparation Outlook.
- Interface : 26 parcours navigateur. Nouveaux parcours : prix et historique, import prévisualisé avec confirmation des droits, URL répétées sans écrasement, autorisations/journal/opposition, coordonnées cartographiques et préparation Outlook persistante sans état de connexion fictif.
- MapLibre : module JS chargé à la demande, worker ESM inclus dans le build. Aucune tuile externe avant activation du fond ; les tests interceptent les requêtes après activation, sans solliciter OSM. Les réponses de tuiles sont simulées, le service public réel n’a pas été testé automatiquement. Captures radar et carte vérifiées visuellement ; absence de débordement mobile vérifiée sur la prospection.
- Windows/WebView2 : compte local, documents, agenda, rapport PDF, Charlie, clé fictive DPAPI, annonce radar, création du suivi de prospect et carte locale réussis. Une instance de test isolée peut coexister avec l’application installée, sans fermer celle-ci ni toucher à ses données.
- Préparation Outlook : champs client ID/locataire validés et enregistrés localement, propriétaires uniquement, conflits de versions détectés, secrets clients et autorités arbitraires refusés. Aucun OAuth, consentement, accès Graph ou envoi réalisé.
- TypeScript/Vite et compilation Tauri réussis, installateur NSIS et signature produits. Migration `20261022_radar` et sauvegarde avant migration locale conservées.

Le radar ne collecte pas de portail ; les prix sont déclarés. Le journal n’est pas une preuve technique d’envoi et le repère quotidien de 17 n’est pas un quota d’envoi effectivement réservé. Connecteurs, campagnes, géocodage, carte transversale, connexion Microsoft réelle et finance restent à poursuivre. Installation sur machine vierge et remplacement effectif d’une ancienne installation par l’updater restent à vérifier.

---

# Livraison 0.6 — 22 octobre 2026

- Backend : 81 tests réussis sur SQLite ; 80 réussis et 1 ignoré sur PostgreSQL. Contrôles de propriété des conversations, rôles, consentement externe, contexte périmé, idempotence, réservation concurrente avant appel facturable et conservation des erreurs.
- Fournisseur OpenAI : contrat HTTP, `store: false`, absence d’outils, message courant et contexte uniquement, absence d’historique transmis, erreurs sans fuite de clé. Réponses et erreurs simulées ; aucun appel réel avec une clé utilisateur n’a été effectué.
- Interface : suite de 21 parcours navigateur, dont trois pour Charlie (briefing et annonce locale, persistance, mobile, consentement et reprise après erreur réseau, rendu texte sûr, protection de configuration). Les captures Charlie à 1440 et 390 pixels ont été vérifiées visuellement.
- Windows/WebView2 : compte, contacts, documents, agenda, PDF et Charlie local réussis. Enregistrement d’une clé fictive avec DPAPI dans le backend embarqué, sans activation ni appel externe. Le test a permis de corriger l’aperçu périmé après navigation et la disparition de confirmation lors du rafraîchissement de configuration.
- TypeScript/Vite, compilation Tauri et génération de l’installateur NSIS signé réussies. Migration `20261021_charlie` ajoutant configuration et conversations ; sauvegarde avant migration conservée.

La connexion OpenAI réelle nécessite la clé et l’accès API de l’utilisateur, à vérifier avec le bouton dédié. Charlie reste en lecture seule ; Outlook, OCR/analyse de documents, radar, prospection et finance restent à venir. Le remplacement effectif d’une ancienne installation par l’updater et l’installation sur une machine vierge restent à vérifier.

---

# Livraison 0.5 — 21 octobre 2026

- Backend : 65 tests réussis sur SQLite ; 64 réussis et 1 ignoré avec le lanceur PostgreSQL. Les tests ajoutés couvrent les liens et rôles, les conflits de modification, la persistance, les contrôles de rapprochement, les références d’estimation et la génération PDF.
- Agenda : conservation d’un intervalle à travers le changement d’heure d’hiver, filtrage des rendez-vous chevauchant une période, refus des dates sans fuseau ou incohérentes, export ICS en UTC, échappement des textes et pliage UTF-8 à 75 octets.
- Estimations : valeurs ordonnées, sources datées, références de ventes séparées des prix affichés, absence de références non présentée comme une analyse de marché. Rapport fictif généré et rendu avec Poppler ; mise en page A4 et polices françaises vérifiées visuellement.
- Interface : 18 parcours navigateur réussis, dont création/modification/suppression d’un rendez-vous, refus d’une heure ambiguë, export ICS, estimation avec comparables de natures différentes, suggestion ne mélangeant pas ces natures, rapport PDF, reconnexion et navigation des rapprochements vers les mandats.
- Windows/WebView2 : compte personnel, documents, déconnexion/reconnexion, agenda, création d’estimation et téléchargement d’un rapport généré par le backend embarqué réussis. Les polices nécessaires sont incluses dans le paquet.
- Migration `20261021_commercial` : tables, index de clés étrangères, contraintes et versionnement. Le démarrage conserve la sauvegarde avant migration ; les bases SQLite et PostgreSQL sont testées séparément.

Cette livraison ne fournit pas encore Charlie/OpenAI, la synchronisation Microsoft, les récurrences ou notifications Windows, DVF, le radar, les campagnes de prospection et la finance. Aucun envoi ou import externe n’est simulé comme un succès réel.

---

# Livraison 0.4 — 21 octobre 2026

- Backend : 47 scénarios validés (suite de 46 puis test supplémentaire de migration locale). Avec le lanceur PostgreSQL : 46 réussis, 1 ignoré ; les tests propres au mode local utilisent SQLite.
- Compte local : validation des champs et de la confirmation, empreinte Argon2id, mot de passe avec espaces préservés, e-mail insensible à la casse, refus d’un second propriétaire, deux inscriptions simultanées, refus de la connexion de démonstration et des requêtes hors boucle locale/origine autorisée.
- Persistance : compte et dossiers conservés après réinitialisation du backend, sauvegarde/restauration du compte, invalidation des sessions restaurées, conservation de l’ancienne base de démonstration et sauvegarde avant migration locale.
- Navigateur : 15 parcours de régression réussis. Formulaire local vérifié visuellement à 1440 px et 390 px, sans débordement horizontal et sans créer le compte de l’utilisateur.
- Application Windows compilée : création du compte, erreur de confirmation, création d’un contact, import/téléchargement PDF, déconnexion et reconnexion avec dossiers conservés. L’API embarquée refuse une requête sans clé de processus.
- TypeScript/Vite et compilation Tauri réussis. Installateur NSIS 0.4.0 et signature de mise à jour produits. Les identifiants, bases locales et clés privées sont exclus du dépôt.

Le compte local ne chiffre pas les fichiers sur le disque et ne propose pas de récupération par e-mail. L’installation sur une machine vierge et le remplacement effectif par l’updater restent à vérifier. Les vérifications des versions précédentes ci-dessous constituent un historique.

---

# Livraison 0.3 — 20 octobre 2026

- Backend : 35 tests réussis, dont démarrage autonome, conservation des dossiers et sauvegarde avant migration.
- PostgreSQL local : 34 tests réussis, 1 ignoré (sauvegarde SQLite). Un conflit de port provoqué confirme le code de sortie 1 ; un arrêt prématuré de la bibliothèque ne doit plus produire un faux succès.
- Le lanceur PostgreSQL utilise désormais `pg_ctl` sous Windows et accorde au compte courant les droits sur sa seule base de test. Le démarrage direct échouait avec le compte administrateur GitHub ; le hook d'arrêt de la bibliothèque masquait cet échec. Les premières validations CI ne prouvaient donc pas l'exécution des tests PostgreSQL.
- Interface : 15 parcours réussis ; les scénarios de mise à jour vérifient la détection, le clic explicite avant installation, le refus simulé d’une signature, l’état hors ligne, l’état à jour et l’absence du bouton dans le navigateur.
- Windows autonome : démarrage du backend embarqué, connexion, création de contact, import/téléchargement PDF et déconnexion réussis dans WebView2. Une requête sans clé du processus parent est refusée.
- Installateur NSIS 0.3.0 et signature Tauri générés. Backend et runtime Python inclus (~27 Mo compressés).
- Publication : code source, workflow de vérification, workflow de release, manifeste latest.json et empreinte SHA-256. La clé privée est exclue de Git et enregistrée comme secret Actions avec autorisation explicite du propriétaire.
- Les fichiers publiés utilisent un nom sans espaces, pour garder les liens du manifeste identiques aux noms conservés par GitHub.
- Moteur de mise à jour natif : avant la première publication GitHub, l'absence de release affiche bien une erreur de vérification, sans état « à jour » ni bouton d'installation.
- GitHub Actions : [vérification Windows réussie](https://github.com/colonelchaboumm/vwimo/actions/runs/39372038726) et [publication signée réussie](https://github.com/colonelchaboumm/vwimo/actions/runs/39372038385). Le test WebView2 fonctionne sur Windows Server 2022 ; le premier essai Server 2025 ne permettait pas la connexion au port de débogage.
- Release publique 0.3.0 : un client natif de test 0.3.0-rc.1 détecte la version, affiche son icône et ses notes, télécharge les 28 231 023 octets depuis GitHub et valide la signature avec le moteur Tauri réel. Aucune commande d'installation n'est appelée durant ce contrôle. Le binaire de production 0.3.0, restauré ensuite, répond bien « à jour » sur le même endpoint public.

Les tests d’interface des mises à jour utilisent un pont natif simulé ; le contrôle supplémentaire ci-dessus vérifie le téléchargement et la signature réels. Le remplacement d’une ancienne installation et l’installation sur une machine vierge restent à vérifier. La distribution autonome est actuellement en mode démonstration SQLite. Les données du mode navigateur de développement sont distinctes ; voir MISES-A-JOUR.md.

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
