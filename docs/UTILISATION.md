# Prise en main

## Connexion

Ouvrir l’application Windows, puis choisir votre nom, votre adresse e-mail, un mot de passe de 12 caractères minimum et sa confirmation. Cliquer sur **Créer mon compte local**. L’adresse e-mail sert uniquement d’identifiant : aucun message ni lien de validation n’est envoyé. L’espace démarre sans dossiers fictifs.

Aux lancements suivants, utiliser **Se connecter** avec le même e-mail et mot de passe. Un seul compte propriétaire peut être créé dans cet espace. La session expire après huit heures et se ferme avec l’interface ; les dossiers et le compte sont conservés. Le mot de passe n’est jamais stocké en clair : seule son empreinte Argon2id est conservée.

Conserver votre mot de passe dans un gestionnaire : cette version ne propose pas de récupération par e-mail. La connexion protège l’accès dans l’application ; elle ne chiffre pas la base et les documents sur le disque. Protéger également votre session Windows et vos sauvegardes.

En développement, `scripts/start.ps1` ouvre un espace local distinct dans `.local/private`. `scripts/start.ps1 -Demo` ouvre l’ancienne démonstration. La mise à jour 0.4 préserve les anciennes bases de démonstration séparément ; elle ne les importe pas dans l’espace personnel.

## Contacts

Ouvrir **Acquéreurs** ou **Vendeurs**, puis **Nouveau contact**. Indiquer le nom et le profil. Un contact peut être vendeur et acquéreur. Les coordonnées restent facultatives afin de ne pas encourager l’invention d’informations.

Les acquéreurs disposent de budgets, de secteurs, d’une surface minimum, de chambres, d’un état de financement et de critères impératifs. La cohérence des budgets est contrôlée par le serveur. Le bouton **Ouvrir** permet de modifier la fiche. **Archiver** demande un second clic ; un vendeur lié à un mandat en cours ne peut pas être archivé.

L’onglet **Tous les contacts** comprend aussi les professionnels. Le filtre recherche les noms, e-mails, téléphones et communes, sans tenir compte des accents. Le tri propose le nom ou le budget décroissant. **Exporter CSV** exporte la liste actuellement filtrée. L’import CSV n’est pas livré dans cette version.

## Mandats

Créer d’abord une fiche vendeur. Dans **Mandats**, sélectionner **Nouveau mandat**, puis renseigner la référence, le vendeur, les caractéristiques du bien, le prix, les dates et le statut.

Pour un mandat intercabinets, renseigner l’agence partenaire et les conditions de partage. Cocher l’autorisation obtenue avant de passer le mandat à un statut commercial actif. Cette déclaration ne remplace pas la pièce justificative, qui peut être associée dans **Documents**.

Une référence ne peut pas être utilisée deux fois. Les honoraires ne peuvent pas dépasser le prix. Toute modification du prix ou du statut est enregistrée dans le journal. Il appartient au conseiller de recueillir l’autorisation du vendeur avant de modifier le prix ; aucune baisse automatique n’est effectuée.

## Tableau de bord

Les compteurs sont calculés depuis les fiches enregistrées. « En portefeuille » regroupe les statuts actif, sous offre et sous compromis. Le graphique utilise les dates de signature déclarées, en excluant les dossiers en préparation et les signatures futures. Il ne mesure pas les ventes réalisées.

Les rappels signalent les mandats anciens de 45 jours ou plus et les échéances dans 15 jours ou dépassées. Cliquer sur une action ouvre le mandat concerné. Les honoraires potentiels sont avant partage et ne représentent ni une commission acquise ni un encaissement.

## Rapprochements

Dans **Rapprochements**, sélectionner un acquéreur ou un mandat, ou analyser le portefeuille. Les mandats actifs et sous offre sont inclus seulement si leur échéance n’est pas dépassée et leur commercialisation est autorisée. Le prix est comparé à la fourchette de budget, la surface au minimum demandé et la commune aux secteurs séparés par une virgule, un point-virgule ou un retour à la ligne.

Le score correspond à trois contrôles structurés : un contrôle satisfait représente un tiers du score. Il ne mesure pas une probabilité de vente. Le nombre de chambres, le financement et les critères libres restent à vérifier manuellement. Cocher **Afficher aussi les écarts** pour voir les incompatibilités. Les boutons ouvrent les dossiers concernés. Aucun e-mail n’est envoyé.

## Agenda local

Ouvrir **Agenda local**, choisir la vue jour, semaine ou mois, puis **Nouveau rendez-vous**. Associer si utile un contact et un mandat. Les horaires sont saisis et affichés en Europe/Paris ; un horaire inexistant ou ambigu au changement d’heure est refusé. Cliquer sur un événement pour le modifier. La suppression exige une confirmation et refuse une version devenue obsolète.

**Exporter ICS** télécharge les rendez-vous de la période affichée (la grille mensuelle inclut les jours adjacents). Le fichier peut être importé dans Outlook. Cela ne crée pas de synchronisation : récurrences, notifications Windows et connexion Microsoft ne sont pas encore disponibles. Les événements restent consultables et exportables en lecture seule.

## Estimations et rapport PDF

Dans **Estimations**, créer un dossier avec l’adresse, la commune, la surface et les caractéristiques utiles. Ajouter vos comparables avec désignation, source, date, prix, surface et, si disponible, URL. Choisir **vente constatée (source déclarée)** ou **prix affiché d’une annonce** pour chaque référence.

La suggestion de fourchette utilise uniquement le type choisi dans **Base de référence** : prix au m² minimum, médian et maximum multipliés par la surface du bien. Elle ne corrige pas les différences de localisation, d’état, de date ou de prestations. Vérifier et modifier les trois valeurs avant d’enregistrer. Sans références, choisir **Évaluation manuelle**. Aucun prix n’est collecté ni vérifié automatiquement.

Rédiger l’analyse et la stratégie, puis enregistrer. Le dossier peut passer de brouillon à présentée, acceptée ou archivée. **Rapport PDF** génère localement un document avec la fourchette finale, les caractéristiques, les comparables et sources déclarées, l’analyse et les limites de méthode. Les données restent disponibles après reconnexion et dans les sauvegardes SQLite. La génération ne dépend ni d’OpenAI ni d’un service hébergé.

## Charlie

Ouvrir **Charlie**, puis **Nouvelle conversation**. Choisir un briefing, un contact, un mandat, une estimation ou les rapprochements d’un acquéreur. **Voir le contexte utilisé** affiche les champs utilisés ; vérifier aussi les notes libres, qui peuvent contenir des informations personnelles. Les coordonnées e-mail/téléphone des contacts et le contenu des documents ne sont pas inclus. Le contexte est actualisé au retour sur cette page.

Le moteur **Local · règles métier** fonctionne sans connexion externe et sans modèle d’IA : il prépare des synthèses et des modèles de brouillons à partir des champs enregistrés. Il ne répond pas librement comme un modèle génératif. Les conversations sont conservées dans la base, accessibles seulement à leur utilisateur ; leur suppression demande une confirmation. Un brouillon non envoyé reste disponible pendant la navigation, mais pas après fermeture ou rechargement.

Pour une génération par OpenAI, ouvrir **Configurer OpenAI**, saisir votre clé API, choisir le modèle, activer la connexion puis enregistrer. Sous Windows, la clé enregistrée est chiffrée avec DPAPI pour votre profil Windows. **Tester la connexion (appel API)** effectue une véritable requête facturable sans données de dossier ; une configuration enregistrée seule ne prouve pas que la connexion fonctionne. L’accès à l’API dépend de votre propre projet OpenAI.

Choisir ensuite le moteur OpenAI et confirmer la transmission avant chaque demande. Seuls le message courant et le contexte affiché sont transmis ; les échanges précédents restent locaux et ne sont pas envoyés. Les requêtes utilisent `store: false`, sans garantie de suppression de tous les journaux du fournisseur : consulter [sa politique de conservation](https://developers.openai.com/api/docs/guides/your-data). Une erreur ne déclenche aucun remplacement silencieux par le moteur local.

Charlie reste en lecture seule : aucun dossier n’est modifié, aucun e-mail envoyé, aucune annonce publiée. Relire et compléter chaque brouillon avant utilisation. Les tests de livraison simulent les réponses OpenAI ; la connexion avec votre propre clé reste à vérifier dans l’application.

## Radar immobilier

**Ajouter une annonce** permet d’enregistrer une source, son URL si disponible, une commune, les caractéristiques connues et le prix affiché. Choisir le type de vendeur explicitement ; une annonce à vérifier n’est pas considérée comme un particulier. Renseigner publication et observation seulement si connues. La date d’observation ne peut pas précéder la dernière observation enregistrée. Aucune source n’est consultée automatiquement et aucune fiche n’entre dans les mandats.

Modifier le prix ajoute une observation ; **Voir les observations** conserve les prix précédents et leurs justifications. La baisse affichée compare le prix actuel au premier prix enregistré, sans vérification de marché. Les doublons possibles reposent sur même commune/type et surface à ±5 % : vérifier les annonces, aucune fusion n’est effectuée. La recherche couvre titre, source, commune, quartier et adresse, sans accents ; les listes sont paginées.

**Importer CSV** fournit un modèle UTF-8 à compléter (séparateur point-virgule ou virgule, 200 annonces maximum, fichier de 250 Ko maximum). `title`, `source_name`, `source_url`, `city`, `price`, `surface` sont obligatoires. Les valeurs de `seller_type` sont `private`, `professional`, `unknown` ; celles de `status` sont `active`, `removed`, `sold`. Les dates utilisent AAAA-MM-JJ. Les décimales acceptent le point ou la virgule ; avec un CSV séparé par virgule, entourer les nombres décimaux français de guillemets. Ne pas ajouter de devise au prix.

Prévisualiser, corriger toutes les erreurs puis confirmer les droits d’importation. Tant qu’une erreur demeure, rien n’est enregistré. Une URL déjà présente, ou répétée dans le fichier, est ignorée sans écrasement du prix ; les paramètres `utm_` et fragments n’interviennent pas dans cette comparaison. Pour actualiser un prix existant, modifier explicitement l’annonce. Les autres champs de la ligne ignorée ne sont pas fusionnés.

## Prospection et journal local

Dans le radar, **Ajouter en prospection** est réservé aux annonces actives de particuliers. Un seul suivi est créé par annonce. Aucun contact CRM, mandat ni envoi n’est créé par cette action. Ouvrir **Prospection**, puis le suivi : renseigner la justification d’autorisation par canal et les notes, ou déclarer une opposition. Une justification saisie ne vaut pas vérification automatique de sa conformité.

Le journal décrit les actions déjà effectuées hors outil, avec date Europe/Paris, canal, compte rendu et preuve/référence. Il ne déclenche pas l’action décrite. Le premier contact et la relance exigent une annonce active de particulier, une justification d’autorisation, aucune opposition et une référence d’action. Après une réponse, un refus ou un résultat, utiliser les notes de suivi : la séquence de premier contact/relance est arrêtée. Un refus enregistre l’opposition.

Une échéance à examiner est calculée 7 jours après le premier contact déclaré, pour une seule relance. L’arrêt général de prospection masque ces suggestions ; aucun envoi n’est planifié. Les compteurs quotidiens se fondent sur les dates déclarées en Europe/Paris. Le repère de 17 n’empêche pas de consigner des actions historiques réellement effectuées au-delà : ce n’est pas une preuve d’application d’un quota d’envoi. Les rendez-vous sont comptés par prospect distinct ayant une déclaration de rendez-vous, même si le suivi a progressé ensuite.

Les 200 dernières activités d’un suivi sont affichées ; les plus anciennes restent dans la base et les contrôles. Les déclarations de résultat n’ajoutent pas automatiquement de rendez-vous, estimation ou mandat dans les autres modules.

## Carte des pistes

La carte affiche uniquement les annonces actives du radar dont latitude et longitude ont été saisies/importées ensemble. Aucune adresse n’est géocodée automatiquement. Filtrer par texte pour réduire les points (1 000 maximum). Les annonces sans coordonnées sont comptées mais non placées ; la liste conserve les positions déclarées.

Par défaut, MapLibre montre les points sur un fond neutre local. **Afficher le fond OpenStreetMap** charge les tuiles en ligne et transmet l’adresse IP et les zones consultées au service cartographique ; les titres, coordonnées de contacts et dossiers ne lui sont pas envoyés. Le fond n’est pas téléchargé pour un usage hors ligne. Sans réseau ou sans WebGL, consulter la liste. Voir [la politique du service de tuiles](https://operations.osmfoundation.org/policies/tiles/).

## Fichiers documentaires

Choisir **Ajouter un document**, puis un fichier et sa catégorie. Associer éventuellement un contact et/ou un mandat. Les formats pris en charge sont PDF, DOCX, XLSX, PNG et JPEG, dans la limite de 15 Mo.

Le téléchargement nécessite une session valide. Une empreinte d’intégrité est enregistrée et vérifiée avant téléchargement : un fichier altéré est bloqué. L’analyse IA, l’OCR, l’édition et la suppression documentaire ne sont pas encore disponibles.

## Recherche et préférences

### Préparer Outlook

Dans **Paramètres → Préparer Outlook**, suivre le guide Microsoft Entra intégré. Aucun identifiant n’est nécessaire pour consulter les étapes. Quand l’application Entra est créée, enregistrer son client ID et le locataire correspondant aux types de comptes choisis (`common`, `organizations`, `consumers` ou UUID d’une organisation). Ces identifiants ne sont pas des secrets ; aucun mot de passe Microsoft ni secret client n’est demandé.

L’enregistrement est réservé au propriétaire/administrateur. Il ne déclenche ni authentification Microsoft, ni demande de consentement Graph, ni synchronisation ou envoi. L’état reste **Non connecté à Microsoft**. La connexion interactive et le stockage sécurisé des jetons seront ajoutés dans une prochaine livraison. La création des inscriptions et les accès disponibles dépendent de votre organisation Microsoft.

`Ctrl+K` place le curseur dans la recherche globale. Elle recherche les contacts, les mandats, les adresses saisies et les noms de fichiers déjà chargés. L’icône lune/soleil change le thème, conservé sur cet appareil.

Les notifications reflètent les rappels métier, avec les échéances urgentes en premier. Les modules à venir sont regroupés dans **Prochaines fonctionnalités**. Les filtres et tris propres à chaque liste sont conservés pendant la connexion.

Dans **Paramètres**, le bouton d’arrêt enregistre la désactivation de la préférence générale de prospection. **Cette version n’a aucun moteur d’envoi : même avec la préférence activée, aucun message ne peut partir.**

## Transactions et commissions (0.8)

Dans **Transactions**, créez un dossier depuis un mandat existant, renseignez acquéreur, prix retenu, notaire, dates et étapes. Un seul dossier non annulé est accepté par mandat. Pour déclarer une vente signée, renseignez l’acte effectué, à une date non future. Les pièces cochées et le financement sont vos déclarations ; aucun contenu documentaire n’est contrôlé automatiquement. Le bouton documents retrouve les fichiers du mandat, du vendeur et de l’acquéreur. Le statut du mandat n’est pas modifié automatiquement.

Dans **Commissions & revenus**, enregistrez séparément chaque part vente, entrée de mandat, courtage, déménagement, recommandation ou autre rémunération. Vous pouvez lier plusieurs revenus distincts au même dossier. Aucun pourcentage n’est supposé : saisissez un montant fixe ou créez un **barème contractuel** depuis vos conditions réelles (propriétaire/administrateur uniquement).

Le barème précise l’assiette contractuelle, la présentation du montant (HT, TTC ou contractuel sans TVA déterminée), les dates d’application et la période du cumul. En méthode **par tranche**, chaque part reçoit son taux. En méthode **globale avec rattrapage**, le revenu correspond aux droits arrondis sur le cumul après opération moins ceux avant opération ; le franchissement d’un seuil peut donc produire une rémunération supérieure à l’assiette de la nouvelle opération. Le cumul concerne les assiettes des revenus validés avec ce barème, jamais vos seuils fiscaux. Une reprise antérieure chiffrée s’applique seulement à la période de sa date. Un nouveau barème ne reprend aucun cumul implicitement.

Le calcul prévisionnel est conservé à l’enregistrement ; les autres prévisions ne sont pas empilées automatiquement et les validations ultérieures peuvent changer le cumul. Pour valider, ouvrez **Calcul et encaissements**, indiquez la date réelle, recalculez puis confirmez le montant et votre droit à rémunération. Les validations d’un barème doivent respecter l’ordre des dates dans chaque période. Si le cumul change entre calcul et confirmation, recalculez. Après validation, le calcul et les données financières sont figés : les corrections/avoirs seront ajoutés dans une prochaine livraison. Une prévision peut être modifiée ou annulée explicitement.

Déclarez ensuite les encaissements reçus, partiels ou complets, avec date et référence. Le total ne peut pas dépasser le revenu validé ; un même enregistrement réessayé après perte de réponse n’ajoute pas un second versement. Aucun mouvement bancaire n’est déclenché. Le tableau distingue prévisions de l’année, revenus validés de l’année, encaissements de l’année et reste dû toutes années. Les bases HT, TTC et contractuelles ne sont pas additionnées. L’export CSV contient tous les statuts et toutes les années (2 000 lignes maximum).

Le statut de micro-entrepreneur ne détermine pas à lui seul la TVA, l’impôt ou les cotisations. Aucun de ces montants ni seuils n’est calculé ici ; aucune facture ni déclaration officielle n’est émise. Ce suivi déclaratif ne remplace pas vos justificatifs et obligations comptables.

## Erreurs et données

Une erreur de validation conserve le formulaire ouvert avec son message. Les écritures sont enregistrées au clic sur **Enregistrer**, pas à chaque frappe. Fermer un formulaire modifié demande de confirmer l’abandon. Changer de profil conserve temporairement les critères saisis. En cas de conflit, un dossier modifié ailleurs ne peut pas être écrasé : copiez vos notes utiles, fermez le formulaire, actualisez et rouvrez-le. Si la confirmation du serveur est perdue, vérifiez la liste avant de recommencer pour éviter un doublon.

La déconnexion révoque la session lorsque le serveur répond ; sinon, l’accès local est fermé et un message signale la révocation distante non confirmée. Fermer ou recharger l’interface efface le jeton local ; une reconnexion est requise mais les dossiers restent dans la base. Voir le guide d’exploitation pour les sauvegardes.
