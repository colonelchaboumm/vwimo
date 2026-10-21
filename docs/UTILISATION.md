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

## Documents

Choisir **Ajouter un document**, puis un fichier et sa catégorie. Associer éventuellement un contact et/ou un mandat. Les formats pris en charge sont PDF, DOCX, XLSX, PNG et JPEG, dans la limite de 15 Mo.

Le téléchargement nécessite une session valide. Une empreinte d’intégrité est enregistrée et vérifiée avant téléchargement : un fichier altéré est bloqué. L’analyse IA, l’OCR, l’édition et la suppression documentaire ne sont pas encore disponibles.

## Recherche et préférences

`Ctrl+K` place le curseur dans la recherche globale. Elle recherche les contacts, les mandats, les adresses saisies et les noms de fichiers déjà chargés. L’icône lune/soleil change le thème, conservé sur cet appareil.

Les notifications reflètent les rappels métier, avec les échéances urgentes en premier. Les modules à venir sont regroupés dans **Prochaines fonctionnalités**. Charlie affiche l’état de l’intégration ; il ne répond pas encore à des questions. Les filtres et tris propres à chaque liste sont conservés pendant la connexion.

Dans **Paramètres**, le bouton d’arrêt enregistre la désactivation de la préférence générale de prospection. **Cette version n’a aucun moteur d’envoi : même avec la préférence activée, aucun message ne peut partir.**

## Erreurs et données

Une erreur de validation conserve le formulaire ouvert avec son message. Les écritures sont enregistrées au clic sur **Enregistrer**, pas à chaque frappe. Fermer un formulaire modifié demande de confirmer l’abandon. Changer de profil conserve temporairement les critères saisis. En cas de conflit, un dossier modifié ailleurs ne peut pas être écrasé : copiez vos notes utiles, fermez le formulaire, actualisez et rouvrez-le. Si la confirmation du serveur est perdue, vérifiez la liste avant de recommencer pour éviter un doublon.

La déconnexion révoque la session lorsque le serveur répond ; sinon, l’accès local est fermé et un message signale la révocation distante non confirmée. Fermer ou recharger l’interface efface le jeton local ; une reconnexion est requise mais les dossiers restent dans la base. Voir le guide d’exploitation pour les sauvegardes.
