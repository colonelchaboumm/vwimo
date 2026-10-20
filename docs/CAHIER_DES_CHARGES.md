# IMMO PILOT AI

## Cahier des charges complet — Application Windows intelligente pour conseiller immobilier indépendant

# 1. MISSION GÉNÉRALE

Tu es une équipe de développement logiciel composée de :

* Un architecte logiciel senior.
* Un développeur full-stack.
* Un expert Python et automatisation.
* Un spécialiste des intégrations API.
* Un développeur d'applications Windows.
* Un expert UX/UI.
* Un spécialiste de l'intelligence artificielle.
* Un expert en sécurité informatique et protection des données.

Ta mission est de concevoir, développer, tester et documenter une application Windows professionnelle nommée **IMMO PILOT AI**.

Cette application est destinée à un conseiller immobilier indépendant exerçant principalement à Annecy et dans le Grand Annecy, en Haute-Savoie.

Elle doit devenir son outil de travail quotidien, centralisant toute son activité immobilière.

L'objectif n'est pas de créer une démonstration, une maquette ou un simple CRM.

**L'objectif est de développer un véritable logiciel métier intelligent, utilisable quotidiennement, capable d'automatiser une grande partie des tâches commerciales et administratives.**

Le logiciel doit intégrer un assistant IA nommé **Charlie**, basé sur l'API OpenAI.

Charlie doit être capable d'analyser les informations disponibles, de conseiller l'utilisateur, de préparer des actions et d'exécuter certaines opérations autorisées.

Le logiciel doit être évolutif, sécurisé, ergonomique et conçu pour fonctionner sur Windows 10 et Windows 11.

---

# 2. PHILOSOPHIE DU LOGICIEL

IMMO PILOT AI repose sur cinq principes fondamentaux.

### 2.1 Centralisation

Toutes les informations commerciales doivent être regroupées :

* Contacts.
* Vendeurs.
* Acquéreurs.
* Mandats.
* Estimations.
* Prospection.
* Annonces immobilières.
* Rendez-vous.
* Visites.
* Offres.
* Compromis.
* Transactions.
* Factures.
* Commissions.
* Recommandations.
* Courtage.
* Documents.
* Communications.

### 2.2 Intelligence artificielle transversale

Charlie doit pouvoir intervenir dans chaque module.

Il ne doit pas être limité à une simple fenêtre de conversation.

Il doit comprendre les données de l'application et proposer des actions pertinentes.

### 2.3 Automatisation

Automatiser autant que possible les tâches répétitives :

* Surveillance des annonces.
* Qualification des prospects.
* Préparation des messages.
* Envois autorisés.
* Relances.
* Matching acquéreurs.
* Suivi des mandats.
* Préparation des comptes rendus.
* Calculs financiers.
* Préparation des newsletters.
* Alertes commerciales.

### 2.4 Contrôle

L'utilisateur doit pouvoir :

* Activer ou désactiver les automatisations.
* Modifier leurs paramètres.
* Consulter les actions réalisées.
* Corriger les données.
* Définir des exclusions.
* Interrompre immédiatement une campagne.
* Reprendre manuellement une opération.

### 2.5 Fiabilité

Ne jamais inventer de données immobilières, de coordonnées, de transactions, de statistiques ou d'autorisations.

Distinguer systématiquement :

* Données vérifiées.
* Données importées.
* Données estimées.
* Hypothèses de l'IA.
* Recommandations commerciales.

---

# 3. ARCHITECTURE TECHNIQUE

Utiliser prioritairement :

| Élément                    | Technologie          |
| -------------------------- | -------------------- |
| Application Windows        | Tauri 2              |
| Frontend                   | React                |
| Langage frontend           | TypeScript           |
| Design                     | Tailwind CSS         |
| Composants                 | shadcn/ui            |
| Backend                    | Python FastAPI       |
| Base de données            | PostgreSQL           |
| ORM et migrations          | SQLAlchemy + Alembic |
| IA                         | API OpenAI           |
| Outlook                    | Microsoft Graph      |
| Cartographie               | MapLibre GL          |
| Données cartographiques    | OpenStreetMap        |
| Graphiques                 | Recharts             |
| Automatisation             | Workers Python       |
| Documents PDF              | ReportLab            |
| Documents Word             | python-docx          |
| Authentification Microsoft | OAuth 2.0 / MSAL     |

L'architecture doit permettre de conserver un client Windows tout en hébergeant les services et la base de données dans un environnement sécurisé.

Prévoir un fonctionnement dégradé lorsque certains services externes sont indisponibles.

Prévoir des sauvegardes, une restauration et un mécanisme de mise à jour.

Ne jamais exposer les clés API ou les secrets d'authentification dans le frontend.

Les autorisations doivent être limitées au strict nécessaire.

---

# 4. INTERFACE GÉNÉRALE

Créer une interface professionnelle inspirée des meilleurs logiciels SaaS et CRM.

Design :

* Moderne.
* Élégant.
* Sobre.
* Rapide.
* Lisible.
* Adapté aux grands écrans.
* Compatible avec les résolutions courantes des ordinateurs portables.
* Mode sombre et mode clair.

## Menu latéral

Prévoir les rubriques suivantes :

1. Tableau de bord.
2. Charlie IA.
3. Prospection.
4. Radar immobilier.
5. Acquéreurs.
6. Vendeurs.
7. Mandats.
8. Estimations.
9. Carte immobilière.
10. Outlook et agenda.
11. Transactions.
12. Commissions et facturation.
13. Courtage et recommandations.
14. Marketing et newsletters.
15. Statistiques.
16. Documents.
17. Paramètres.

Prévoir une recherche globale permettant de retrouver rapidement un client, un bien, une adresse, un mandat, un document ou une conversation.

Ajouter un centre de notifications et une barre d'actions rapides.

---

# 5. TABLEAU DE BORD PRINCIPAL

Le tableau de bord constitue l'écran d'accueil.

Il doit présenter une vision complète de l'activité immobilière.

## Indicateurs

Afficher notamment :

* Mandats actifs.
* Mandats exclusifs.
* Mandats simples.
* Mandats intercabinets.
* Nouveaux prospects.
* Estimations en cours.
* Visites programmées.
* Offres reçues.
* Compromis signés.
* Ventes réalisées.
* Chiffre d'affaires réalisé.
* Chiffre d'affaires prévisionnel.
* Commissions attendues.
* Objectifs mensuels.
* Taux de transformation.
* Délai moyen de commercialisation.

## Graphiques

Prévoir :

* Évolution du chiffre d'affaires.
* Mandats obtenus par mois.
* Prospection et transformation.
* Origine des mandats.
* Répartition géographique des ventes.
* Performance par type de bien.
* Évolution des prix.
* Comparaison entre objectifs et résultats.

## Actions prioritaires

Charlie doit afficher les actions recommandées :

* Clients à relancer.
* Mandats nécessitant une actualisation.
* Acquéreurs compatibles avec de nouveaux biens.
* Estimations à terminer.
* Rendez-vous à préparer.
* Dossiers incomplets.
* Factures à établir.
* Commissions en attente.

Chaque recommandation doit être accompagnée d'un bouton permettant d'accéder directement au dossier concerné.

---

# 6. CHARLIE — ASSISTANT IMMOBILIER IA

Charlie constitue le cœur intelligent du logiciel.

Il doit être accessible depuis toutes les pages.

Prévoir une fenêtre latérale de conversation et une page dédiée.

## Capacités

Charlie doit pouvoir :

* Consulter les données internes selon les autorisations.
* Rechercher un client.
* Retrouver un mandat.
* Analyser un bien.
* Préparer une estimation.
* Comparer plusieurs biens.
* Rédiger une annonce.
* Préparer un e-mail.
* Analyser un document.
* Résumer une conversation.
* Préparer un rendez-vous.
* Proposer une relance.
* Identifier les opportunités commerciales.
* Calculer une commission.
* Analyser les performances.
* Préparer un compte rendu vendeur.

## Exemples de commandes

« Charlie, quels sont mes rendez-vous aujourd'hui ? »

« Quels vendeurs dois-je relancer cette semaine ? »

« Trouve les acquéreurs compatibles avec ce T3. »

« Prépare une estimation de cet appartement. »

« Analyse les baisses de prix dans le secteur de Cran-Gevrier. »

« Quels mandats sont commercialisés depuis plus de 45 jours ? »

« Prépare un e-mail pour présenter ce bien à Julie. »

« Combien vais-je gagner si je vends cet appartement à 420 000 € ? »

« Prépare un compte rendu pour ce propriétaire. »

« Quelles sont mes meilleures opportunités de prospection ? »

## Architecture IA

Créer un système d'outils internes permettant à Charlie d'effectuer des recherches structurées dans la base.

Les outils doivent être limités par des permissions.

Prévoir :

* Historique des conversations.
* Contexte des dossiers.
* Recherche documentaire.
* Appels d'outils.
* Journal des actions.
* Confirmation pour les actions sensibles.
* Protection contre les instructions malveillantes contenues dans les annonces, e-mails et documents importés.

Charlie doit pouvoir proposer une action sans nécessairement l'exécuter.

Les actions automatiques explicitement autorisées dans les paramètres pourront être exécutées sans validation individuelle, après passage des contrôles de sécurité et de conformité.

---

# 7. INTÉGRATION OUTLOOK

Intégrer Microsoft Outlook avec Microsoft Graph.

## Messagerie

Fonctionnalités :

* Consultation des e-mails.
* Recherche.
* Lecture des conversations.
* Création de brouillons.
* Envoi d'e-mails.
* Réponses.
* Classement des échanges.
* Association des messages aux fiches clients.
* Historique des communications.

Charlie doit pouvoir analyser les messages et proposer :

* Une réponse.
* Une relance.
* Un rendez-vous.
* Une création de contact.
* Une mise à jour de dossier.

Les messages envoyés depuis IMMO PILOT doivent apparaître dans l'historique de communication.

## Agenda

Prévoir :

* Synchronisation des rendez-vous.
* Création de visites.
* Rendez-vous d'estimation.
* Rendez-vous vendeurs.
* Rendez-vous acquéreurs.
* Compromis.
* Signatures.
* Rappels.
* Notifications Windows.

Afficher les événements dans une vue jour, semaine et mois.

Permettre d'ouvrir directement une fiche client ou un bien depuis un événement.

Gérer correctement les fuseaux horaires et les événements récurrents.

---

# 8. RADAR IMMOBILIER

Créer un système de surveillance des annonces immobilières.

## Sources envisagées

* Leboncoin.
* PAP.
* SeLoger.
* Bien'ici.
* Orpi.
* Laforêt.
* Century 21.
* Autres agences et portails.
* Immo Data.
* Sources de données immobilières ouvertes ou sous licence.

Prévoir une architecture de connecteurs extensible.

Chaque connecteur doit vérifier et documenter les conditions d'accès, les droits d'utilisation et les fonctionnalités disponibles.

Ne pas supposer qu'une plateforme dispose d'une API publique.

Ne pas contourner les systèmes de protection ou les restrictions d'automatisation.

## Informations collectées

Selon les données accessibles légalement :

* Source.
* URL.
* Date de publication.
* Date de détection.
* Type de vendeur.
* Type de bien.
* Commune.
* Quartier.
* Adresse lorsqu'elle est disponible.
* Prix.
* Surface.
* Prix au m².
* Nombre de pièces.
* Nombre de chambres.
* Étage.
* Extérieurs.
* Stationnement.
* DPE.
* Description.
* Historique des prix.
* État de l'annonce.

## Intelligence commerciale

Charlie doit détecter :

* Nouvelles annonces.
* Baisses de prix.
* Annonces anciennes.
* Remises en vente.
* Annonces similaires.
* Doublons.
* Biens potentiellement surévalués.
* Opportunités de prospection.

La comparaison doit être fondée sur des données disponibles et identifiables.

---

# 9. PROSPECTION AUTOMATIQUE DES VENDEURS PARTICULIERS

## Objectif

Obtenir de nouveaux mandats de vente auprès des particuliers.

Ce module est exclusivement consacré à la conquête de mandats.

Les annonces externes ne doivent pas alimenter automatiquement le portefeuille des biens proposés aux acquéreurs.

## Configuration initiale obligatoire

* Prospection automatique : ACTIVÉE.
* Plafond quotidien : 17 messages.
* Secteur : Annecy et Grand Annecy.
* Fuseau horaire : Europe/Paris.
* Relances automatiques : ACTIVÉES.
* Cible : particuliers vendeurs.
* Exclusion des annonces professionnelles pour les campagnes de prospection vendeurs.

Le quota de 17 messages comprend les premiers contacts et les relances.

## Détection

Le logiciel doit identifier les nouvelles annonces de particuliers provenant des sources autorisées.

Il doit :

1. Détecter une annonce.
2. Vérifier sa localisation.
3. Identifier son caractère particulier ou professionnel.
4. Rechercher les doublons.
5. Vérifier les précédentes sollicitations.
6. Calculer un score d'opportunité.
7. Vérifier la possibilité légale et technique de contacter le vendeur.
8. Préparer un message personnalisé.
9. Envoyer automatiquement si toutes les conditions sont satisfaites.
10. Enregistrer l'opération.

## Messages personnalisés

Charlie doit adapter le message :

* Au type de bien.
* À la commune.
* Aux caractéristiques connues.
* À l'ancienneté de l'annonce.
* Aux éventuelles baisses de prix.
* Au contexte commercial.

L'objectif est de proposer un accompagnement immobilier et d'obtenir un rendez-vous d'estimation.

Ne jamais inventer de clients acquéreurs, de références commerciales ou de transactions.

## Envois automatiques

L'automatisation doit fonctionner sans validation individuelle uniquement pour les contacts et canaux dont l'utilisation est autorisée.

Avant chaque envoi, vérifier :

* La conformité du canal.
* La base légale applicable.
* Les conditions de la plateforme.
* Les oppositions.
* Les exclusions.
* L'historique des sollicitations.
* Les règles de fréquence.
* Le quota journalier.

Une annonce publique ne constitue pas automatiquement une autorisation de démarchage électronique.

Ne jamais utiliser de mécanismes destinés à contourner les restrictions de messagerie des plateformes.

## Relances automatiques

Paramètres initiaux :

* Première relance proposée après 7 jours.
* Une relance automatique maximum par séquence.
* Arrêt en cas de réponse, refus ou opposition.
* Respect du plafond quotidien.
* Relance uniquement si elle est autorisée.

Les délais doivent être modifiables.

## Journal de prospection

Enregistrer :

* Prospect.
* Bien.
* Source.
* Date.
* Canal.
* Message.
* Statut.
* Réponse.
* Relance.
* Motif de blocage.
* Justification de l'autorisation d'envoi.
* Version du modèle IA.
* Historique des actions.

Prévoir un interrupteur d'arrêt immédiat.

## Statistiques

Afficher :

* Annonces détectées.
* Prospects qualifiés.
* Messages envoyés.
* Quota restant.
* Réponses.
* Rendez-vous obtenus.
* Estimations réalisées.
* Mandats signés.
* Taux de conversion.
* Performance par commune.
* Performance par source.

---

# 10. PORTEFEUILLE ACQUÉREURS

Créer un CRM acquéreurs complet.

## Fiche acquéreur

Informations :

* Identité.
* Coordonnées.
* Situation du projet.
* Budget minimum.
* Budget maximum.
* Financement.
* Accord bancaire.
* Secteurs recherchés.
* Type de bien.
* Surface.
* Nombre de pièces.
* Nombre de chambres.
* Extérieurs.
* Stationnement.
* Ascenseur.
* Étage.
* Travaux acceptés.
* Critères impératifs.
* Critères secondaires.
* Date souhaitée d'acquisition.
* Historique des échanges.
* Historique des visites.
* Biens proposés.
* Biens refusés.
* Offres réalisées.

## Matching intelligent

Charlie doit comparer les critères de chaque acquéreur avec les mandats disponibles.

Créer un score de compatibilité sur 100.

Le score doit être explicable.

Les critères impératifs doivent être traités séparément des préférences.

Exemple :

* Budget compatible : 25 points.
* Localisation : 25 points.
* Surface : 15 points.
* Chambres : 15 points.
* Prestations : 10 points.
* Autres critères : 10 points.

Ces pondérations doivent être configurables.

## Envoi d'un bien à un acquéreur

L'utilisateur doit pouvoir :

1. Ajouter un mandat manuellement.
2. Coller une annonce autorisée.
3. Importer une fiche PDF.
4. Laisser Charlie analyser les caractéristiques.
5. Identifier les acquéreurs compatibles.
6. Générer une présentation personnalisée.
7. Préparer un e-mail Outlook.
8. Envoyer le message après validation.
9. Enregistrer l'envoi dans le dossier.

Prévoir également la sélection de plusieurs acquéreurs compatibles.

Les e-mails doivent être personnalisés individuellement.

Éviter de proposer plusieurs fois le même bien au même acquéreur sans raison.

---

# 11. PORTEFEUILLE VENDEURS

Créer une fiche complète pour chaque vendeur.

Informations :

* Identité.
* Coordonnées.
* Adresse du bien.
* Origine du contact.
* Date du premier contact.
* Estimation.
* Prix souhaité.
* Prix conseillé.
* Date de signature du mandat.
* Type de mandat.
* Durée du mandat.
* Date d'échéance.
* Historique des échanges.
* Historique des visites.
* Offres.
* Documents.
* Actions commerciales.

## Suivi commercial

Charlie doit analyser régulièrement les mandats actifs.

Détecter :

* Absence de visites.
* Faible activité commerciale.
* Ancienneté importante.
* Retours négatifs récurrents.
* Écart avec le marché.
* Évolution des prix concurrents.

## Actualisation des annonces

Prévoir des analyses à :

* 15 jours.
* 30 jours.
* 45 jours.
* 60 jours.

Ces seuils doivent être configurables.

Charlie peut proposer :

* Une nouvelle accroche.
* Une description améliorée.
* Une réorganisation des photos.
* Une nouvelle présentation.
* Une adaptation des arguments commerciaux.
* Une discussion sur le positionnement du prix.

Aucune baisse de prix ne doit être appliquée sans validation et autorisation du vendeur.

---

# 12. GESTION DES MANDATS

Distinguer obligatoirement :

### Mandats personnels

Biens commercialisés directement par l'utilisateur.

### Mandats intercabinets

Biens transmis par une agence partenaire et pour lesquels l'utilisateur dispose d'une autorisation de commercialisation.

## Informations

* Référence du mandat.
* Origine.
* Type.
* Propriétaire.
* Agence partenaire.
* Date de signature.
* Date de fin.
* Prix de vente.
* Honoraires.
* Répartition des honoraires.
* Conditions particulières.
* Statut.
* Documents.
* Photos.
* Historique des prix.

Prévoir des statuts :

* Préparation.
* Actif.
* Sous offre.
* Sous compromis.
* Vendu.
* Expiré.
* Retiré.

Les mandats intercabinets doivent intégrer les règles de partage des honoraires.

---

# 13. MODULE D'ESTIMATION IMMOBILIÈRE

Créer un outil d'estimation professionnelle.

## Informations

* Adresse.
* Commune.
* Quartier.
* Type de bien.
* Surface habitable.
* Surface Carrez.
* Surface au sol.
* Terrain.
* Nombre de pièces.
* Étage.
* Ascenseur.
* Année de construction.
* État général.
* Travaux.
* DPE.
* Charges.
* Taxe foncière.
* Cave.
* Garage.
* Parking.
* Balcon.
* Terrasse.
* Jardin.
* Vue.
* Exposition.

## Sources de comparaison

Prévoir des connecteurs compatibles avec :

* DVF.
* Données cadastrales.
* Immo Data.
* Annonces immobilières accessibles.
* Historique interne des estimations.
* Transactions internes.

Ne pas confondre prix affichés et prix de vente constatés.

## Analyse IA

Charlie doit proposer :

* Une fourchette basse.
* Une valeur centrale.
* Une fourchette haute.
* Une analyse du prix au m².
* Les points valorisants.
* Les points pénalisants.
* Les travaux à considérer.
* Une stratégie de commercialisation.

Afficher les comparables utilisés et leurs sources.

## Documents

Générer :

* Rapport PDF professionnel.
* Synthèse vendeur.
* Tableau des comparables.
* Carte des références.
* Argumentaire de prix.
* Présentation commerciale.

Les estimations doivent rester modifiables manuellement.

---

# 14. CARTE IMMOBILIÈRE INTELLIGENTE

Créer une carte interactive.

## Éléments affichés

* Mandats personnels.
* Mandats intercabinets.
* Estimations.
* Transactions.
* Prospects particuliers.
* Annonces concurrentes.
* Rendez-vous.
* Zones prospectées.
* Actions commerciales.

## Filtres

* Commune.
* Quartier.
* Type de bien.
* Prix.
* Prix au m².
* Surface.
* Statut.
* Date.
* Origine.
* Type de vendeur.

## Fonctionnalités

* Regroupement des marqueurs.
* Fiches accessibles depuis la carte.
* Historique des actions par secteur.
* Visualisation des zones peu prospectées.
* Analyse de la répartition des mandats.
* Comparaison des prix.
* Identification des secteurs prioritaires.

Ne pas afficher publiquement les adresses confidentielles des prospects.

---

# 15. COMMISSIONS ET FACTURATION

Créer un module financier complet.

## Calcul des honoraires

Permettre plusieurs méthodes :

* Pourcentage du prix de vente.
* Montant fixe.
* Barème par tranche.
* Barème selon le type de bien.
* Honoraires TTC et HT.

## Rétrocession d'agence

L'utilisateur travaille avec une agence partenaire.

Sa rémunération peut évoluer selon son chiffre d'affaires.

Créer un système de paliers entièrement configurable.

Exemple fictif :

| Chiffre d'affaires cumulé | Rétrocession |
| ------------------------- | ------------ |
| 0 à 50 000 €              | 40 %         |
| 50 001 à 100 000 €        | 45 %         |
| Au-delà de 100 000 €      | 50 %         |

Ces valeurs sont uniquement des exemples.

Ne pas les considérer comme les conditions réelles de l'utilisateur.

Prévoir :

* Paliers annuels.
* Paliers mensuels.
* Calcul marginal ou global selon le contrat.
* Dates d'application.
* Réinitialisation des compteurs.
* Ajustements manuels.
* Historique des changements.

## Facturation

Fonctionnalités :

* Création de factures.
* Numérotation.
* Coordonnées de facturation.
* TVA paramétrable.
* Échéances.
* Paiements.
* Retards.
* Avoirs.
* Exports PDF.
* Historique comptable.

Prévoir les mentions légales applicables et une architecture compatible avec les obligations françaises de facturation électronique, selon le statut et le calendrier réglementaire de l'utilisateur.

Ne pas présumer du régime fiscal ou du taux de TVA.

## Prévisions

Afficher :

* Honoraires prévisionnels.
* Rétrocession estimée.
* Commissions acquises.
* Commissions encaissées.
* Factures impayées.
* Revenus mensuels.
* Objectifs annuels.

---

# 16. COURTAGE ET RECOMMANDATIONS

Créer un module consacré aux apporteurs d'affaires et aux relations avec les courtiers.

## Courtage

Suivre :

* Acquéreur concerné.
* Courtier partenaire.
* Date de transmission.
* Autorisation du client.
* Statut du financement.
* Résultat.
* Rémunération éventuelle.
* Facture.
* Paiement.

## Recommandations

Suivre :

* Origine de la recommandation.
* Contact recommandé.
* Type de projet.
* Date.
* Statut.
* Transaction éventuelle.
* Rémunération prévue.
* Rémunération versée.

Les rémunérations doivent être configurables et soumises aux vérifications réglementaires applicables, notamment concernant les activités réglementées et les apporteurs d'affaires.

---

# 17. TRANSACTIONS IMMOBILIÈRES

Créer un suivi complet du cycle de vente.

Étapes :

1. Mandat signé.
2. Commercialisation.
3. Visites.
4. Offre.
5. Offre acceptée.
6. Constitution du dossier.
7. Compromis.
8. Conditions suspensives.
9. Financement.
10. Acte authentique.
11. Facturation.
12. Encaissement.

Prévoir :

* Dates importantes.
* Documents.
* Notaire.
* Acquéreur.
* Vendeur.
* Prix.
* Honoraires.
* Conditions suspensives.
* Échéances.
* Notifications.
* Historique.

Charlie doit signaler les échéances importantes et les documents manquants.

---

# 18. RETOUCHE ET VALORISATION DES PHOTOS

Intégrer un module de traitement des photographies immobilières.

Fonctionnalités :

* Correction de luminosité.
* Contraste.
* Balance des blancs.
* Redressement des perspectives.
* Recadrage.
* Réduction du bruit.
* Amélioration de la netteté.
* Export haute qualité.
* Comparaison avant/après.

Prévoir des fonctions IA de valorisation visuelle lorsque les services nécessaires sont disponibles.

Conserver systématiquement les photographies originales.

Identifier les images modifiées.

Ne jamais masquer des défauts matériels, supprimer des éléments importants ou créer une représentation trompeuse du bien.

---

# 19. NEWSLETTERS ET MARKETING

Créer un outil de communication commerciale.

## Segments

* Acquéreurs actifs.
* Vendeurs.
* Anciens clients.
* Prospects.
* Apporteurs d'affaires.
* Contacts professionnels.

## Campagnes

* Nouveaux mandats.
* Actualité immobilière.
* Évolution du marché annécien.
* Conseils vendeurs.
* Conseils acquéreurs.
* Présentation de services.
* Informations commerciales.

## IA

Charlie doit pouvoir :

* Proposer des sujets.
* Rédiger les newsletters.
* Personnaliser les contenus.
* Sélectionner les segments.
* Préparer les campagnes.
* Analyser les résultats.

Prévoir :

* Consentements et bases légales.
* Désinscription.
* Listes d'exclusion.
* Historique des campagnes.
* Statistiques disponibles.
* Gestion des erreurs d'envoi.

---

# 20. GESTION DOCUMENTAIRE

Créer une bibliothèque documentaire.

Formats :

* PDF.
* DOCX.
* XLSX.
* Images.
* Documents numérisés.

Types de documents :

* Mandats.
* Diagnostics.
* DPE.
* Actes.
* Plans.
* PV d'assemblées générales.
* Charges.
* Taxes foncières.
* Offres.
* Compromis.
* Documents acquéreurs.
* Documents vendeurs.

## Analyse IA

Charlie doit pouvoir extraire les informations utiles.

Exemples :

* Travaux votés.
* Travaux refusés.
* Procédures de copropriété.
* Charges importantes.
* Informations sur le DPE.
* Caractéristiques du bien.
* Éléments nécessitant une vérification.

Les résultats doivent indiquer le document source et, lorsque possible, la page concernée.

Ne jamais présenter une interprétation juridique comme une certitude.

---

# 21. STATISTIQUES COMMERCIALES

Créer une page de pilotage détaillée.

## Prospection

* Nombre d'annonces détectées.
* Nombre de particuliers qualifiés.
* Messages envoyés.
* Réponses.
* Rendez-vous.
* Estimations.
* Mandats obtenus.

## Commercialisation

* Mandats actifs.
* Visites.
* Offres.
* Compromis.
* Ventes.
* Délais moyens.
* Baisses de prix.

## Performance financière

* Chiffre d'affaires.
* Commissions.
* Prévisionnel.
* Facturation.
* Encaissements.
* Recommandations.
* Courtage.

## Concurrence

Suivre les données publiques accessibles concernant :

* Orpi.
* Laforêt.
* Century 21.
* Autres agences.

Afficher notamment les nouvelles annonces observées, les niveaux de prix, les évolutions et les volumes accessibles.

Ne pas présenter les annonces détectées comme une mesure exhaustive de l'activité réelle d'une agence.

---

# 22. AUTOMATISATIONS TRANSVERSALES

Créer un moteur central d'automatisation.

Chaque automatisation doit disposer :

* D'un nom.
* D'un déclencheur.
* De conditions.
* D'une fréquence.
* D'un statut.
* D'un historique.
* D'une gestion des erreurs.
* D'un bouton d'activation.
* D'un bouton de désactivation.

## Automatisations prioritaires

### Briefing du matin

À l'ouverture de l'application :

* Rendez-vous du jour.
* Relances.
* Nouveaux prospects.
* Mandats à suivre.
* Acquéreurs à contacter.
* Échéances.
* Objectifs.

### Surveillance des annonces

Détecter les nouveautés via les connecteurs autorisés.

### Prospection automatique

Envoyer les messages autorisés dans la limite de 17 par jour.

### Matching acquéreurs

Déclencher une analyse lors de l'ajout ou de la modification d'un mandat.

### Suivi des mandats

Signaler les annonces nécessitant une actualisation.

### Suivi financier

Actualiser les prévisions lors d'un changement de statut de transaction.

### Relances commerciales

Préparer ou envoyer les relances selon les permissions définies pour chaque canal et campagne.

---

# 23. BASE DE DONNÉES

Créer un modèle relationnel robuste.

Entités principales :

* users
* contacts
* buyers
* buyer_criteria
* sellers
* properties
* mandates
* mandate_partners
* listings
* listing_sources
* listing_price_history
* prospect_listings
* prospect_contacts
* prospecting_campaigns
* prospecting_messages
* prospecting_exclusions
* prospecting_consents
* buyer_matches
* visits
* offers
* transactions
* estimates
* estimate_comparables
* documents
* media_assets
* messages
* email_threads
* calendar_events
* tasks
* commission_rules
* commission_tiers
* invoices
* invoice_payments
* broker_referrals
* recommendations
* marketing_campaigns
* contact_preferences
* automation_rules
* automation_executions
* source_connectors
* connector_permissions
* ai_conversations
* ai_actions
* audit_logs

Prévoir les clés étrangères, index, contraintes d'unicité, migrations et règles de suppression.

Les données personnelles doivent faire l'objet de règles de conservation adaptées.

---

# 24. SÉCURITÉ ET CONFORMITÉ

Le logiciel doit intégrer dès sa conception :

* Authentification sécurisée.
* Gestion des permissions.
* Chiffrement des données sensibles.
* Stockage sécurisé des tokens.
* Journalisation.
* Sauvegardes.
* Restauration.
* Protection contre les injections.
* Protection contre les accès non autorisés.
* Limitation des appels API.
* Contrôle des automatisations.
* Gestion des oppositions à la prospection.
* Gestion des consentements.
* Export des données personnelles.
* Suppression et anonymisation lorsque nécessaire.

Respecter les principes du RGPD.

Prévoir une configuration des durées de conservation et des informations de confidentialité.

Les envois automatiques doivent être désactivés pour tout connecteur ne disposant pas des permissions nécessaires, même lorsque le mode général de prospection est activé.

---

# 25. EXPÉRIENCE UTILISATEUR

Le logiciel doit être agréable à utiliser plusieurs heures par jour.

Prévoir :

* Chargement rapide.
* Navigation fluide.
* Recherche instantanée.
* Filtres persistants.
* Tableaux triables.
* Vues personnalisables.
* Notifications.
* Raccourcis clavier.
* Actions groupées.
* Import CSV.
* Export CSV.
* Import PDF.
* Export PDF.
* Gestion du glisser-déposer.
* Historique des modifications.
* Sauvegarde automatique des formulaires.

Ne jamais afficher des statistiques fictives sans les identifier explicitement comme données de démonstration.

Ne jamais créer des boutons donnant l'impression qu'une fonctionnalité existe alors qu'elle n'est pas implémentée.

---

# 26. STRATÉGIE DE DÉVELOPPEMENT

Ne pas essayer de coder tous les modules simultanément.

Organiser le développement en phases.

## PHASE 1 — Fondations

Construire :

* Architecture du projet.
* Application Windows.
* Interface générale.
* Base PostgreSQL.
* Authentification.
* Tableau de bord.
* Gestion des contacts.
* Gestion des vendeurs.
* Gestion des acquéreurs.
* Gestion des mandats.
* Gestion documentaire initiale.

Cette phase doit produire une application réellement fonctionnelle.

## PHASE 2 — Intelligence commerciale

Ajouter :

* Assistant Charlie.
* API OpenAI.
* Matching acquéreurs.
* Import de fiches immobilières.
* Génération d'e-mails.
* Intégration Outlook.
* Agenda.
* Estimations.
* Génération PDF.

## PHASE 3 — Prospection et cartographie

Ajouter :

* Radar immobilier.
* Connecteurs autorisés.
* Détection des annonces.
* Dédoublonnage.
* Qualification IA.
* Prospection automatique.
* Quota de 17 messages.
* Relances.
* Journal d'envoi.
* Cartographie.
* Statistiques de prospection.

## PHASE 4 — Finance et pilotage avancé

Ajouter :

* Calculs de commissions.
* Paliers de rétrocession.
* Facturation.
* Courtage.
* Recommandations.
* Suivi des transactions.
* Newsletters.
* Retouche photo.
* Automatisations avancées.
* Statistiques complètes.

---

# 27. EXIGENCES DE QUALITÉ

Pour chaque module :

1. Définir les fonctionnalités.
2. Créer les modèles de données.
3. Développer les services backend.
4. Développer les composants frontend.
5. Ajouter les validations.
6. Ajouter les tests.
7. Vérifier les permissions.
8. Tester les erreurs.
9. Documenter le fonctionnement.
10. Vérifier la compatibilité Windows.

Prévoir des tests unitaires et des tests d'intégration.

Tester les cas limites.

Maintenir le projet compilable après chaque étape.

---

# 28. PREMIÈRE EXÉCUTION DEMANDÉE À CODEX

Commence immédiatement par analyser le dépôt de travail.

S'il est vide, initialise une nouvelle application.

Avant de développer les fonctionnalités avancées :

1. Présente l'architecture retenue.
2. Définis la structure des dossiers.
3. Crée le schéma initial de la base.
4. Initialise le backend FastAPI.
5. Initialise le frontend React.
6. Configure Tauri.
7. Installe les composants graphiques.
8. Crée le menu de navigation.
9. Crée un tableau de bord professionnel.
10. Implémente les premiers formulaires de contacts et de mandats.
11. Ajoute un jeu de données de démonstration.
12. Ajoute les tests nécessaires.
13. Fournis les commandes de lancement sous Windows.

Ne bloque pas le développement en attendant des identifiants API.

Utilise des adaptateurs de démonstration clairement identifiés pour les services non encore configurés.

Les données de démonstration doivent être séparées des données réelles.

Documente les variables d'environnement nécessaires.

---

# 29. LIVRABLE FINAL ATTENDU

L'objectif est de disposer progressivement d'une application Windows installable, avec :

* Un exécutable ou installateur Windows.
* Une interface graphique complète.
* Une base de données persistante.
* Un backend fonctionnel.
* Une connexion IA.
* Des intégrations externes configurables.
* Un système de sauvegarde.
* Une documentation utilisateur.
* Une documentation technique.
* Des tests.
* Un mécanisme de mise à jour.

L'application doit pouvoir évoluer vers une version mobile ou web sans reconstruire l'ensemble du système.

---

# 30. INSTRUCTION FINALE

Construis IMMO PILOT AI comme un produit logiciel professionnel destiné à un usage réel.

Privilégie la qualité, la fiabilité, la sécurité et l'ergonomie.

Ne te limite pas à proposer des idées ou des maquettes.

Produis du code fonctionnel, teste-le et améliore-le progressivement.

Lorsqu'une intégration externe nécessite un accès, une licence ou une autorisation, crée une interface de connexion documentée et utilise un mode de simulation tant que les conditions ne sont pas réunies.

Ne prétends jamais qu'un message a été envoyé, qu'une annonce a été collectée ou qu'une synchronisation a réussi sans confirmation technique.

**Commence maintenant par la PHASE 1 : architecture, initialisation du projet, base de données, interface Windows et premiers modules fonctionnels.**
