# État de livraison

## Phase 1 — première livraison fonctionnelle

Architecture, schéma et migrations, API, interface, authentification locale, contacts et critères acquéreurs, vendeurs, mandats, gestion documentaire initiale, journal d’actions, démonstration isolée, scripts de lancement, tests et documentation sont livrés.

La version 0.3 embarque le backend Python, conserve les données dans le profil Windows et intègre les mises à jour signées depuis GitHub. Ses parcours natifs ont été vérifiés le 20 octobre 2026. La signature Authenticode et les vérifications d’installation sur d’autres machines restent à réaliser. La version 0.4 ajoute un espace personnel SQLite : compte propriétaire créé dans l’interface, sans hébergement, données persistantes et démonstration conservée séparément. La version 0.11 permet de changer le mot de passe et de fermer toutes les sessions personnelles depuis les paramètres, avec confirmation du secret actuel et reconnexion obligatoire. Les anciennes générations de connexion sont invalidées, même si un login était déjà commencé. La récupération d’un mot de passe oublié et le changement d’adresse de connexion restent à prévoir.

Avant une utilisation réelle : finaliser la chaîne native, durcir le déploiement, exécuter la politique de conservation/effacement, ajouter le scan documentaire, valider les sauvegardes PostgreSQL et organiser les mises à jour signées. Les API de listes chargent actuellement le portefeuille complet : pagination et recherche serveur globale seront nécessaires pour de gros volumes.

La version 0.2 apporte le nouveau design, le tri des contacts/mandats, la conservation des filtres pendant la session, la protection des saisies et les versions de dossiers pour éviter les écrasements concurrents. Restent à prévoir : import CSV, tri documentaire, filtres persistants entre connexions, autosauvegarde des brouillons, actions groupées et interface de gestion des utilisateurs. Les écritures restent explicites.

## Phase 2 — intelligence commerciale

Livré en 0.5 : rapprochements explicables, agenda local jour/semaine/mois avec export ICS, dossiers d’estimation avec références déclarées et rapports PDF locaux. Les suggestions de fourchette utilisent les prix au m² minimum, médian et maximum d’un seul type de référence ; les montants finaux restent manuels. Les comparables ne sont pas vérifiés automatiquement.

Livré en 0.6 : Charlie en lecture seule, contexte de dossier affiché, conversations privées, préparation locale par règles et génération OpenAI facultative avec confirmation par demande. Aucun historique de conversation n’est transmis au fournisseur.

À poursuivre : outils d’action de Charlie avec permissions et confirmations ; import et analyse de fiches/documents ; brouillons et envois Outlook confirmés ; OAuth/MSAL avec stockage sécurisé des tokens ; synchronisation d’agenda, récurrences et notifications Windows ; connecteurs DVF, corrections et analyse assistée des estimations.

La version 0.7 ajoute la préparation Outlook dans les paramètres : guide de création Entra et stockage local du client ID/locataire. Elle ne connecte pas le compte Microsoft ; OAuth, consentement Graph et synchronisation restent à implémenter et tester avec une inscription réelle.

## Phase 3 — prospection et carte

Livré en 0.7 : radar par saisie et CSV, import prévisualisé et confirmé, URL répétées ignorées sans écrasement, observations de prix, baisses depuis le prix initial, ancienneté déclarée et rapprochement de doublons possibles. Ces données restent séparées des mandats.

Suivi local de prospects particuliers actifs, justificatifs d’autorisation déclarés, oppositions et journal d’actions effectuées hors outil. Échéance de relance calculée après 7 jours, au maximum une relance dans la séquence ; arrêt des suggestions après réponse, résultat ou opposition. Compteurs déclaratifs en Europe/Paris. Le repère quotidien de 17 ne constitue pas un quota d’envoi appliqué : aucun canal d’envoi n’est encore intégré.

Carte MapLibre des coordonnées saisies/importées dans les annonces actives, sans géocodage. Fond OpenStreetMap activé uniquement à la demande, avec attribution ; liste de repli et fond neutre sans appel externe. La carte ne couvre pas encore les mandats, estimations et ventes.

À poursuivre : connecteurs sous droits vérifiés, collecte/détection périodique, qualification IA explicitement distinguée des règles, comparaisons de marché sourcées, géocodage, carte transversale et moteur de campagnes. Ce moteur devra réserver atomiquement le quota quotidien de 17 en Europe/Paris, vérifier les conditions du canal avant chaque envoi, gérer l’idempotence et enregistrer une confirmation technique.

Le drapeau général de prospection est enregistré dès la phase 1, mais aucun connecteur ne dispose de permission d’envoi. Il faudra vérifier les droits, le canal et la base légale avant chaque exécution, y compris les relances.

## Phase 4 — finance et pilotage

Livré en 0.8 : dossiers de transaction associés aux mandats, étapes, acquéreur, notaire, dates, financement, conditions, checklist et consultation des documents liés. Les changements restent déclaratifs et indépendants du statut du mandat.

Commissions et revenus par origine : vente, entrée de mandat, courtage, déménagement, recommandation et autre. Montant fixe ou barème contractuel figé, taux configurables, tranches marginales ou taux global avec rattrapage, cumul par mois/année civile et reprise antérieure explicite. Prévisions enregistrées, recalcul confirmé avant validation, historique financier conservé, encaissements partiels déclarés, reste dû et export CSV. Aucun taux utilisateur fictif prérempli.

Livré en 0.9 : annuaire des partenaires, archivage conservant les relations, dossiers de courtage/recommandation/service, contact et transaction liés, autorisation client déclarée, date de mise en relation, financement, résultat, prochaine action et historique. La première transmission exige une autorisation datée et justifiée ; sa trace est conservée après retrait. Aucune donnée n’est envoyée au partenaire. Les revenus sont liés explicitement et consultables dans le dossier sans duplication.

Pilotage annuel : ventes déclarées signées par date d’acte, volume des prix de vente distinct du revenu, délai compromis-acte avec taille de l’échantillon, journal de prospection et rendez-vous planifiés selon Europe/Paris. Répartition mensuelle et par origine des prévisions, revenus validés et encaissements, séparée par base HT/TTC/contractuelle. Stocks actuels affichés à part. Il ne s’agit pas d’une mesure exhaustive du marché ou de taux de conversion causaux.

Livré en 0.10 : préparation locale de newsletters. Brouillons incomplets enregistrables, duplication/archivage, segments acquéreurs/vendeurs/professionnels/tous les contacts actifs, personnalisation `{nom}`, prévisualisation et fichiers EML individuels après confirmation. Préférences newsletter indépendantes des autorisations de prospection ou de mise en relation. Une opposition bloque les doublons d’adresse ; un changement d’e-mail impose de revérifier l’accord. La levée d’une exclusion nécessite un administrateur et une confirmation explicite, sans créer d’accord individuel. Les exports sont revérifiés et conservés dans un historique de préparations, sans envoi ni suivi d’ouverture.

À poursuivre : facturation adaptée au régime de TVA et aux mentions professionnelles réelles, corrections/avoirs sur revenus validés, rapprochement bancaire et suivi des remboursements, connexion Outlook, envois/campagnes et désinscriptions connectés, segmentation avancée, retouche photo avec conservation des originaux, automatisations et statistiques de cohortes/attribution. Le statut de micro-entrepreneur ne suffit pas à déduire un régime de TVA ou une exonération générale ; la version 0.10 ne calcule ni impôt ni cotisations. Le quota de prospection de 17 n’est pas appliqué aux fichiers locaux ; aucun transport d’envoi n’est intégré.

Aucune règle fiscale ou rémunération fictive n’est prise pour une condition réelle de l’utilisateur. Les dates réglementaires et contraintes de services externes devront être vérifiées au moment de l’implémentation.
