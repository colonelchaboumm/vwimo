# État de livraison

## Phase 1 — première livraison fonctionnelle

Architecture, schéma et migrations, API, interface, authentification locale, contacts et critères acquéreurs, vendeurs, mandats, gestion documentaire initiale, journal d’actions, démonstration isolée, scripts de lancement, tests et documentation sont livrés.

La version 0.3 embarque le backend Python, conserve les données dans le profil Windows et intègre les mises à jour signées depuis GitHub. Ses parcours natifs ont été vérifiés le 20 octobre 2026. La signature Authenticode et les vérifications d’installation sur d’autres machines restent à réaliser. La version 0.4 ajoute un espace personnel SQLite : compte propriétaire créé dans l’interface, sans hébergement, données persistantes et démonstration conservée séparément. La récupération et le changement du mot de passe depuis l’interface restent à prévoir.

Avant une utilisation réelle : finaliser la chaîne native, durcir le déploiement, exécuter la politique de conservation/effacement, ajouter le scan documentaire, valider les sauvegardes PostgreSQL et organiser les mises à jour signées. Les API de listes chargent actuellement le portefeuille complet : pagination et recherche serveur globale seront nécessaires pour de gros volumes.

La version 0.2 apporte le nouveau design, le tri des contacts/mandats, la conservation des filtres pendant la session, la protection des saisies et les versions de dossiers pour éviter les écrasements concurrents. Restent à prévoir : import CSV, tri documentaire, filtres persistants entre connexions, autosauvegarde des brouillons, actions groupées et interface de gestion des utilisateurs. Les écritures restent explicites.

## Phase 2 — intelligence commerciale

Livré en 0.5 : rapprochements explicables, agenda local jour/semaine/mois avec export ICS, dossiers d’estimation avec références déclarées et rapports PDF locaux. Les suggestions de fourchette utilisent les prix au m² minimum, médian et maximum d’un seul type de référence ; les montants finaux restent manuels. Les comparables ne sont pas vérifiés automatiquement.

À poursuivre : Charlie/OpenAI avec outils autorisés, contexte de dossier, conversations et confirmations ; import de fiches ; brouillons et envois Outlook confirmés ; OAuth/MSAL avec stockage sécurisé des tokens ; synchronisation d’agenda, récurrences et notifications Windows ; connecteurs DVF, corrections et analyse assistée des estimations.

## Phase 3 — prospection et carte

Connecteurs sous droits vérifiés, radar et prix historiques, dédoublonnage, qualification, cartographie. Moteur de campagnes avec consentements/oppositions, réservations atomiques du quota quotidien de 17 en Europe/Paris, idempotence, une relance après 7 jours maximum par défaut, arrêt immédiat et preuve technique d’envoi.

Le drapeau général de prospection est enregistré dès la phase 1, mais aucun connecteur ne dispose de permission d’envoi. Il faudra vérifier les droits, le canal et la base légale avant chaque exécution, y compris les relances.

## Phase 4 — finance et pilotage

Transactions, commissions et contrats de rétrocession configurables, facturation adaptée au statut réel, courtage, recommandations, newsletters, retouche photo avec conservation des originaux, automatisations avancées et statistiques.

Aucune règle fiscale ou rémunération fictive n’est prise pour une condition réelle de l’utilisateur. Les dates réglementaires et contraintes de services externes devront être vérifiées au moment de l’implémentation.
