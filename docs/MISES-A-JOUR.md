# Installer et mettre à jour IMMO PILOT AI

## Utilisation

Télécharger l’installateur depuis [GitHub Releases](https://github.com/colonelchaboumm/vwimo/releases/latest), l’exécuter puis ouvrir IMMO PILOT AI. À partir de 0.3.0, Python et le backend sont embarqués : aucune console ni installation de Node/Python n’est nécessaire.

Installer cette version **une première fois** : la version 0.2 ne possède pas de moteur de mise à jour. Les suivantes sont proposées par l’icône de téléchargement en haut à droite, également accessible sur l’écran de connexion. L’icône devient bleue lorsqu’une version est disponible. Ouvrir les notes puis cliquer sur **Installer et redémarrer**. La vérification est automatique au démarrage et toutes les quatre heures, ainsi qu’au retour dans l’application après quinze minutes. Elle peut aussi être relancée manuellement.

Un échec de connexion n’est pas présenté comme « à jour ». Une signature invalide bloque l’installation. La mise à jour remplace le client et le backend ensemble. Le bouton est indisponible pendant l’édition d’un dossier ou une opération en cours. L’application redémarre après l’installation Windows.

## Données

Les données de l’application autonome se trouvent dans `%LOCALAPPDATA%\fr.immopilot.desktop` : `demo.db`, `documents`, `backups` et `backend.log`. Elles sont séparées des fichiers du programme. Avant une migration de schéma, une sauvegarde de la base et des documents est créée ; une sauvegarde impossible bloque le démarrage avant migration.

Le mode navigateur de développement garde ses données dans `.local` du projet. Il s’agit d’un espace différent. Pour transférer une démonstration existante, arrêter les applications, créer une sauvegarde avec `app.backup`, la restaurer dans un dossier neuf, puis placer `database.db` sous le nom `demo.db` et le dossier `documents` dans le dossier Windows **uniquement si celui-ci n’existe pas encore**. Ne jamais remplacer une base déjà utilisée. Conserver l’original et la sauvegarde. Les tests utilisent des dossiers distincts.

La version autonome actuelle utilise le mode démonstration SQLite. Le mode réel PostgreSQL et les intégrations externes nécessitent encore leur déploiement dédié.

## Publication d’une nouvelle version

1. Mettre à jour le code et le numéro de version dans les deux `package.json`, `tauri.conf.json`, `Cargo.toml`, l’API et les libellés de l’interface. Synchroniser les fichiers de verrouillage (`npm install --package-lock-only` et compilation Cargo).
2. Ajouter `docs/releases/<version>.md` avec les changements destinés à l’utilisateur.
3. Vérifier les tests puis pousser le commit et un tag `v<version>`, par exemple `v0.3.1`.
4. Le workflow **Publish Windows update** exécute les tests, compile le backend et le client, signe l’installateur, teste WebView2, génère `latest.json`, crée une release en brouillon avec ses fichiers puis la publie. Une exécution manuelle du workflow est également possible pour une version non publiée.

Un simple commit ne publie pas de mise à jour. Une release déjà publiée n’est pas écrasée : corriger avec un nouveau numéro. Ne pas republier un ancien numéro comme dernière version. Les signatures utilisent le secret GitHub Actions `TAURI_SIGNING_PRIVATE_KEY`, créé avec l’autorisation du propriétaire du dépôt. La clé publique seule figure dans la configuration du client.

La clé privée locale est dans `.local/signing/updater.key`, exclue de Git. La sauvegarder dans un coffre sûr : sa perte empêcherait de signer des mises à jour reconnues par les versions déjà installées. Ne jamais la joindre à une release ni la coller dans un ticket. GitHub ne permet pas de relire un secret enregistré.

La signature de mise à jour Tauri garantit l’authenticité du paquet. Elle n’est pas une signature Windows Authenticode : SmartScreen peut donc afficher un avertissement pour une application encore peu distribuée.

Références : [mise à jour Tauri](https://v2.tauri.app/plugin/updater/) et [ressources embarquées](https://v2.tauri.app/develop/resources/).
