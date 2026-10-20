# Configuration et exploitation

## Variables

Copier `.env.example` vers `.env` dans la racine. La configuration est lue par FastAPI, Alembic et les commandes d’administration.

| Variable | Valeur initiale / usage |
|---|---|
| `IMMO_MODE` | `demo` ou `real` |
| `IMMO_DATABASE_URL` | `sqlite:///./.local/demo.db` ; mode réel : `postgresql+psycopg://…` |
| `IMMO_STORAGE_DIR` | `.local/demo-documents` ; dossier distinct obligatoire en réel |
| `IMMO_SESSION_HOURS` | `8`, de 1 à 24 |
| `IMMO_CORS_ORIGINS` | Tableau JSON d’origines explicites autorisées |
| `VITE_API_URL` | Adresse publique du backend au build du client, sans secret |
| `IMMO_TEST_POSTGRES_URL` | Réservé aux tests, injecté par le lanceur PostgreSQL portable |

Les clés OpenAI, client IDs Microsoft et tokens OAuth ne sont pas utilisés à ce stade. Ils seront ajoutés au backend au moment de leur intégration. Aucun identifiant n’est nécessaire pour utiliser la démonstration.

## PostgreSQL réel

Provisionner une base dédiée et un stockage documentaire distinct. Utiliser un rôle propriétaire pour les migrations, puis un rôle applicatif sans privilèges superutilisateur ni DDL pour l’API. Ne pas partager la base de démonstration.

Exemple SQL à exécuter par l’administrateur sur **une nouvelle base dédiée uniquement**, après création des rôles par un gestionnaire de secrets et après migrations :

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE immo_real TO immo_app;
GRANT USAGE ON SCHEMA public TO immo_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO immo_app;
GRANT INSERT, UPDATE ON contacts, buyer_criteria, properties, mandates, documents,
  automation_settings TO immo_app;
GRANT DELETE ON buyer_criteria TO immo_app;
GRANT INSERT, DELETE ON sessions TO immo_app;
GRANT INSERT ON audit_logs TO immo_app;
```

Les UUID sont générés dans le backend ; aucune séquence métier n’est nécessaire. Le rôle d’administration conserve la création et la maintenance des comptes. Les droits seront revus à chaque ajout de tables.

Avec l’URL du rôle de migration, configurer `IMMO_MODE=real`, une URL PostgreSQL et un dossier de stockage distinct, puis :

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini upgrade head
.\.venv\Scripts\python.exe -m app.manage init
.\.venv\Scripts\python.exe -m app.manage create-user --email vous@agence.fr --name "Votre nom" --role admin
```

Le mot de passe est demandé dans le terminal sans affichage. Configurer ensuite l’URL avec le rôle applicatif pour lancer l’API. La connexion de démonstration est refusée en mode réel.

L’API fournie écoute uniquement sur `127.0.0.1`. Un hébergement distant nécessite HTTPS, restriction réseau PostgreSQL, `sslmode=verify-full`, certificats, secrets gérés hors dépôt, limite HTTP à 16 Mo, chiffrement du disque et sauvegardes chiffrées. Le contrôle de tentatives de connexion actuel est local au processus : utiliser une protection centralisée pour un déploiement multi-worker.

La version actuelle ne fournit pas la gestion complète des demandes RGPD, les durées de conservation exécutables, l’antivirus documentaire, la MFA ou la récupération de mot de passe. La mise en production de données personnelles doit attendre ces compléments et la validation de l’exploitation.

## Sauvegarde de démonstration

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m app.backup create .local\backups\demo-2026-10-18.zip
.\.venv\Scripts\python.exe -m app.backup restore .local\backups\demo-2026-10-18.zip --destination .local\restauration-2026-10-18
```

La sauvegarde contient un snapshot SQLite cohérent, les fichiers référencés et un manifeste SHA-256. Elle refuse les documents manquants ou altérés. Le fichier ZIP n’est pas chiffré : le conserver sur un volume protégé. Les anciens jetons de session sont exclus.

La restauration exige un **nouveau dossier** ; elle ne remplace jamais la base courante. Après contrôle, arrêter l’API et configurer :

```dotenv
IMMO_MODE=demo
IMMO_DATABASE_URL=sqlite:///./.local/restauration-2026-10-18/database.db
IMMO_STORAGE_DIR=.local/restauration-2026-10-18/documents
```

La restauration valide les chemins, les empreintes et l’intégrité SQLite. Elle est limitée à 2 Go décompressés dans cette première version. Test de restauration automatisé dans `backend/tests/test_backup.py`.

## Sauvegarde PostgreSQL

Utiliser `pg_dump --format=custom` avec un rôle de sauvegarde autorisé, une connexion TLS et un mot de passe fourni via le gestionnaire de secrets ou `PGPASSFILE`, jamais dans une commande versionnée. Copier également le dossier documentaire et conserver sa correspondance avec les métadonnées.

Pour une sauvegarde strictement coordonnée, mettre l’API en maintenance pendant le dump et la copie documentaire. Sauvegarder hors machine, chiffrer et tester régulièrement une restauration vers **une nouvelle base** avec `pg_restore --no-owner --no-privileges`, puis réappliquer les droits, vérifier les empreintes des documents et vider `sessions` pour invalider les jetons sauvegardés. Ne jamais restaurer directement sur une base de production sans procédure validée.

L’outil SQLite refuse PostgreSQL : la procédure PostgreSQL est documentée, mais son orchestration de sauvegarde/restauration n’est pas automatisée dans cette livraison.

## Mise à jour

Procédure initiale manuelle : sauvegarder, arrêter l’API, mettre à jour le code et les dépendances verrouillées, exécuter `alembic upgrade head`, vérifier les tests, redémarrer et vérifier `/api/health`. Une régression doit être traitée par restauration sur une nouvelle base ou migration corrective, pas par un downgrade aveugle.

L’updater Tauri signé, la signature de code Windows et le canal de publication ne sont pas encore configurés. Ne pas activer d’updater non signé. Le workflow CI peut compiler le client Windows après validation ; il ne publie ni ne déploie automatiquement de version.
