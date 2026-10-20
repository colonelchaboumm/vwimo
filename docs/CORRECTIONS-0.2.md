# Version 0.2 — 19 octobre 2026

## Interface

Nouvelle palette blanc perle/gris/bleu, barre latérale translucide, typographie système, cartes et formulaires arrondis, thèmes clair et sombre. Navigation recentrée sur les modules disponibles, liste séparée des fonctionnalités futures. Paramètres et déconnexion restent accessibles sur petit écran. Les fiches en lecture seule utilisent des libellés lisibles au lieu d’un bloc JSON.

## Fiabilité

- Confirmation avant abandon d’une saisie ; protection au rechargement ; conservation des critères lorsque le profil change ; contrôles désactivés pendant l’enregistrement et protection contre les doubles soumissions.
- Versions des contacts et mandats : une édition obsolète reçoit un conflit 409, sans écraser le dossier ni ses critères ou son bien. Version absente : 428. Migration des dossiers existants vers la version initiale 1.
- Sessions : rejet des réponses tardives d’une ancienne connexion, nettoyage de l’écran à l’expiration, déconnexion locale possible hors ligne, nettoyage des jetons expirés et blocage des comptes désactivés.
- Recherche sans accents incluant les téléphones ; tri des contacts/mandats ; filtres propres à chaque page conservés pendant la session ; échappement des formules CSV précédées d’espaces.
- Statistiques : exclusion des brouillons et signatures futures du graphique, urgences triées en premier, statuts expiré/retiré inclus. Montants décimaux sérialisés sans conversion flottante et horodatages normalisés en UTC.
- Documents : limite de requête avant parsing, y compris sans Content-Length ; contrôle du volume côté client ; conservation de l’extension des noms longs ; téléchargement bloqué si l’empreinte ne correspond plus.
- Erreurs : état de santé lié à une requête réelle à la base ; message 503 en cas d’indisponibilité ; distinction entre écriture confirmée et rafraîchissement échoué ; délai réseau couvrant la lecture du corps de réponse.
- Windows : lancement du serveur avec une boucle Selector pour éviter l’erreur Proactor WinError 10022 observée sous Python 3.14.
- Tests PostgreSQL : correction du code de sortie masqué par le hook d’arrêt de la dépendance. Un échec volontaire de collecte a confirmé un retour non nul après correction.

## Mise à jour d’une installation existante

Arrêter le backend. Sauvegarder avant la migration. Pour la démonstration SQLite, depuis la racine :

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m app.backup create .local/backups/avant-0.2.zip
# Continuer uniquement si la sauvegarde a réussi.
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\scripts\start.ps1
```

Sur cette machine, sauvegarde créée dans `.local/backups/avant-0.2-20261019.zip`, puis migration appliquée. Les données utilisateur n’ont pas été remplacées par les données des tests. Pour PostgreSQL, suivre d’abord la procédure de sauvegarde dédiée de `OPERATIONS.md`.

Le client et le backend 0.2 doivent être mis à jour ensemble : un ancien client ne transmet pas les versions de dossiers. L’installateur Windows contient seulement le client, sans service Python embarqué. Les intégrations IA/Outlook, l’installateur signé et l’utilisation réelle à grande échelle restent hors de cette livraison.
