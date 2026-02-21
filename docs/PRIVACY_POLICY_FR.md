# EazMenu — Politique de Confidentialité et de Protection des Données

**Dernière mise à jour :** 21 février 2026

---

## 1. Introduction

EazMenu (« nous », « notre », « nos ») est une plateforme numérique de menus et de commandes qui permet aux restaurateurs et commerçants (« Utilisateurs Administrateurs ») de créer, gérer et publier leurs menus en ligne, et à leurs clients (« Utilisateurs Finaux ») de consulter les menus et passer des commandes en scannant des codes QR.

La présente Politique de Confidentialité et de Protection des Données décrit les données personnelles que nous collectons, pourquoi nous les collectons, comment nous les traitons et les protégeons, ainsi que les droits dont vous disposez concernant vos données. Elle s'applique aux :

- **Utilisateurs Finaux (Clients) :** personnes qui scannent un code QR pour consulter le menu d'un restaurant et éventuellement passer des commandes.
- **Utilisateurs Administrateurs (Commerçants) :** propriétaires et gestionnaires de restaurants qui s'inscrivent sur EazMenu pour gérer leurs établissements, menus et commandes.
- **Visiteurs du site web :** personnes qui visitent la page d'accueil d'EazMenu et peuvent utiliser le formulaire de contact.

---

## 2. Responsable du traitement

Le responsable du traitement des données personnelles traitées via EazMenu est :

**EazMenu**
Contact : contact@eazmenu.com

Pour toute question relative à cette politique ou pour exercer vos droits, veuillez nous contacter à l'adresse ci-dessus.

---

## 3. Données collectées auprès des Utilisateurs Finaux (Clients)

Les Utilisateurs Finaux n'ont **pas** besoin de créer un compte ni de fournir d'informations personnelles pour utiliser EazMenu. La consultation d'un menu et le passage d'une commande sont entièrement anonymes.

### 3.1 Identifiant de session

Lorsqu'un Utilisateur Final scanne un code QR et accède au menu d'un restaurant, un **identifiant de session aléatoire** (UUID) est stocké sous forme de cookie HTTP-only sur son appareil. Cet identifiant de session :

- Est une chaîne de caractères générée aléatoirement, sans lien avec une identité personnelle.
- Expire automatiquement après **24 heures**.
- Est utilisé uniquement pour associer les commandes à une session de navigation, afin que l'Utilisateur Final puisse consulter le statut de ses propres commandes.

### 3.2 Données de commande

Lorsqu'un Utilisateur Final passe une commande, les données suivantes sont enregistrées :

| Donnée | Finalité |
|---|---|
| Articles commandés, quantités et prix unitaires | Pour traiter et afficher la commande au restaurant |
| Total de la commande | Pour calculer l'addition |
| Numéro de table | Pour identifier le lieu de livraison de la commande |
| Statut de la commande (Reçue, En préparation, Prête, Servie, Annulée) | Pour suivre l'avancement de la commande |
| Notes en texte libre (optionnel, ex. : « sans oignons ») | Instructions de préparation spéciales demandées par l'Utilisateur Final |
| Identifiant de session (UUID) | Pour lier la commande à la session du navigateur de l'Utilisateur Final |
| Horodatage | Pour enregistrer le moment de la commande |

**Important :** Nous ne collectons **pas** le nom, l'adresse e-mail, le numéro de téléphone, l'adresse postale ou toute autre information directement identifiante de l'Utilisateur Final.

### 3.3 Analyse des interactions avec le menu

Nous collectons des données d'événements anonymes lorsque les Utilisateurs Finaux interagissent avec un menu :

| Événement | Finalité |
|---|---|
| Consultations, clics et ajouts au panier d'articles du menu | Pour fournir aux restaurateurs des statistiques agrégées sur la performance de leur menu |

Ces événements sont associés uniquement à l'identifiant de session anonyme et ne peuvent pas être rattachés à une personne identifiable.

### 3.4 Données de paiement

Lorsqu'un restaurant a activé le paiement en ligne, le traitement des paiements est entièrement assuré par **Stripe**, un prestataire de paiement tiers conforme à la norme PCI DSS. EazMenu ne reçoit, ne traite et ne stocke **jamais** les numéros de carte bancaire, les cryptogrammes visuels (CVV) ou toute autre donnée de carte de paiement. Seuls le statut du paiement et le montant sont enregistrés dans notre système pour mettre à jour la commande. Veuillez consulter la [Politique de Confidentialité de Stripe](https://stripe.com/fr/privacy) pour plus de détails sur la manière dont Stripe traite vos données de paiement.

### 3.5 Conservation des données — Utilisateurs Finaux

| Donnée | Durée de conservation |
|---|---|
| Cookie de session | 24 heures (expiration automatique) |
| Données de commande | Conservées le temps nécessaire au restaurant pour ses besoins opérationnels, puis soumises à un nettoyage périodique |
| Événements d'interaction avec le menu | Conservés sous forme agrégée à des fins d'analyse ; les identifiants de session individuels ne sont pas utilisés à des fins de ré-identification |

---

## 4. Données collectées auprès des Utilisateurs Administrateurs (Commerçants)

### 4.1 Informations de compte

Lors de l'inscription d'un commerçant sur EazMenu, les informations suivantes sont collectées :

| Donnée | Finalité |
|---|---|
| Nom d'utilisateur | Pour identifier de manière unique le compte du commerçant |
| Adresse e-mail | Pour l'authentification, la récupération de compte et les communications de service |
| Nom d'affichage | Affiché dans l'interface d'administration |
| URL de la photo de profil | Affichée dans l'interface d'administration (provenant du fournisseur OAuth le cas échéant) |
| Fournisseur d'authentification (e-mail, Google, Apple, Microsoft) | Pour gérer la méthode de connexion |

L'authentification est déléguée à **Supabase**, un service d'authentification tiers. Si vous vous connectez via Google, Apple ou Microsoft, vos données de profil OAuth (nom, e-mail, photo de profil) sont récupérées auprès du fournisseur respectif. **Nous ne stockons pas de mots de passe** — la gestion des mots de passe est entièrement assurée par Supabase.

### 4.2 Informations sur le restaurant / l'établissement

Les commerçants fournissent des informations commerciales pour configurer le profil de leur restaurant :

| Donnée | Finalité |
|---|---|
| Nom du restaurant | Affiché sur le menu public |
| Adresse | Affichée sur le menu public (optionnel) |
| Numéro de téléphone | Affiché sur le menu public (optionnel) |
| E-mail professionnel | Affiché sur le menu public (optionnel) |
| Description | Affichée sur le menu public |
| Liens vers les réseaux sociaux (Instagram, Facebook, TikTok) | Affichés sur le menu public (optionnel) |
| URL du site web | Affiché sur le menu public (optionnel) |
| URL Google Maps | Affichée sur le menu public (optionnel) |
| Images du logo et de la bannière | Affichées sur le menu public |
| Devise et fuseau horaire | Pour la configuration des commandes et de l'affichage |
| Configuration du thème (couleurs, police) | Pour la personnalisation visuelle du menu |

**Remarque :** Les coordonnées du restaurant (adresse, téléphone, e-mail) sont des données de contact professionnel publiées volontairement par le commerçant à l'intention de ses clients. Les commerçants contrôlent quelles informations ils choisissent d'afficher.

### 4.3 Contenu du menu

Les commerçants créent et gèrent :

- Les catégories et articles du menu (noms, descriptions, prix, images)
- Les informations nutritionnelles (calories, protéines, lipides, glucides, poids)
- Les déclarations d'allergènes
- Les ingrédients
- Les traductions en plusieurs langues

Il s'agit de contenu commercial, et non de données personnelles.

### 4.4 Fichiers téléversés

Les commerçants peuvent téléverser des images (JPEG, PNG, GIF, WebP) pour les articles du menu, les logos et les bannières de restaurant. Ces fichiers sont stockés dans **Supabase Storage** et diffusés via des URL sécurisées.

### 4.5 Conservation des données — Utilisateurs Administrateurs

| Donnée | Durée de conservation |
|---|---|
| Données du compte commerçant | Conservées pendant la durée de vie du compte ; supprimées sur demande de suppression du compte |
| Données du restaurant et du menu | Conservées pendant la durée de vie du compte ; les éléments supprimés de manière réversible sont conservés pour une éventuelle restauration, puis purgés définitivement |
| Images téléversées | Conservées pendant la durée de vie du restaurant associé ; supprimées lorsque le restaurant ou le compte est supprimé |

---

## 5. Données collectées auprès des Visiteurs du site web

### 5.1 Formulaire de contact

Lorsqu'un visiteur remplit le formulaire de contact sur notre page d'accueil, les données suivantes sont collectées :

| Donnée | Obligatoire | Finalité |
|---|---|---|
| Nom | Oui | Pour adresser la demande |
| Adresse e-mail | Oui | Pour répondre à la demande |
| Message | Oui | Contenu de la demande |
| Numéro de téléphone | Non | Pour un suivi si fourni |
| Nom de l'entreprise | Non | Pour contextualiser la demande |

Ces données sont :

- **Envoyées par e-mail** à notre équipe pour traitement.
- **Éventuellement synchronisées avec Klaviyo** (plateforme de marketing par e-mail) si le visiteur y consent, aux fins de communications relatives aux services d'EazMenu.
- **Non stockées dans une base de données** par EazMenu directement.

### 5.2 Google reCAPTCHA v3

Le formulaire de contact utilise Google reCAPTCHA v3 pour se protéger contre le spam et les abus. Google peut collecter des informations sur le navigateur et l'appareil, des cookies et des adresses IP dans le cadre de ce service. Veuillez consulter la [Politique de Confidentialité de Google](https://policies.google.com/privacy) pour plus de détails.

### 5.3 Suivi des erreurs (PostHog)

Notre page d'accueil utilise **PostHog** (hébergé dans l'UE, `eu.posthog.com`) pour le suivi des exceptions et des erreurs. PostHog est configuré pour :

- **Ne pas** capturer automatiquement les pages vues.
- Capturer uniquement les exceptions techniques (à des fins de débogage et de fiabilité du site).

PostHog peut collecter des métadonnées anonymes sur l'appareil/navigateur et des détails sur les erreurs. Aucune identification manuelle des utilisateurs n'est effectuée.

---

## 6. Données techniques et opérationnelles

### 6.1 Limitation du débit (Rate Limiting)

Pour protéger nos services contre les abus, nous utilisons un système de limitation du débit en mémoire qui suit temporairement les identifiants de session ou les adresses IP. Ces données :

- Sont stockées uniquement dans la mémoire vive du serveur (RAM).
- Ne sont jamais écrites sur disque ou dans une base de données.
- Sont automatiquement purgées toutes les 10 minutes.

### 6.2 Journaux du serveur

Nos serveurs génèrent des journaux opérationnels qui peuvent contenir :

- Des métadonnées de requête (horodatages, méthodes HTTP, URL)
- Des identifiants d'utilisateur ou de session à des fins de débogage
- Des messages d'erreur et des traces d'exécution

En production, les journaux sont nettoyés pour minimiser l'exposition des données personnelles. Les journaux sont conservés pendant une durée limitée à des fins de débogage et de surveillance de la sécurité, puis automatiquement purgés.

---

## 7. Services tiers

Nous utilisons les services tiers suivants susceptibles de traiter des données pour notre compte :

| Service | Finalité | Données traitées | Politique de confidentialité |
|---|---|---|---|
| **Supabase** | Authentification et stockage de fichiers | Comptes commerçants, données OAuth, images téléversées | [supabase.com/privacy](https://supabase.com/privacy) |
| **Stripe** | Traitement des paiements (optionnel) | Données de carte de paiement, montants des transactions | [stripe.com/fr/privacy](https://stripe.com/fr/privacy) |
| **Google reCAPTCHA** | Protection anti-robot sur le formulaire de contact | Empreinte du navigateur, adresse IP | [policies.google.com/privacy](https://policies.google.com/privacy) |
| **PostHog** | Suivi des erreurs (page d'accueil) | Métadonnées anonymes appareil/navigateur, erreurs | [posthog.com/privacy](https://posthog.com/privacy) |
| **Klaviyo** | Marketing par e-mail (optionnel) | Soumissions du formulaire de contact | [klaviyo.com/legal/privacy](https://www.klaviyo.com/legal/privacy-notice) |
| **Gmail SMTP** | Transfert des e-mails du formulaire de contact | Soumissions du formulaire de contact | [policies.google.com/privacy](https://policies.google.com/privacy) |

---

## 8. Sécurité des données

Nous mettons en œuvre les mesures suivantes pour protéger vos données :

- **Chiffrement en transit :** Toutes les communications entre votre appareil et nos serveurs utilisent le chiffrement HTTPS/TLS.
- **Sécurité de l'authentification :** L'authentification des commerçants est déléguée à Supabase avec prise en charge de l'authentification multi-facteurs et des protocoles OAuth 2.0.
- **Contrôle d'accès :** Les données des restaurants sont isolées par commerçant ; les commerçants ne peuvent accéder qu'à leurs propres restaurants et données.
- **Aucun stockage de mot de passe :** Nous ne stockons jamais de mots de passe ; cette gestion est entièrement assurée par notre fournisseur d'authentification.
- **Aucun stockage de données de carte bancaire :** Les données de carte bancaire ne transitent jamais par nos serveurs.
- **Cookies HTTP-only :** Les cookies de session sont configurés en HTTP-only pour empêcher l'accès par des scripts côté client.
- **Limitation du débit :** Les points d'accès de l'API sont soumis à une limitation du débit pour prévenir les abus.
- **Validation et assainissement des entrées :** Toutes les saisies utilisateur sont validées et assainies côté serveur.

---

## 9. Cookies

| Cookie | Type | Durée | Finalité |
|---|---|---|---|
| `tableSessionId` | Essentiel / Fonctionnel | 24 heures | Lie le navigateur de l'Utilisateur Final à ses commandes pour le suivi du statut des commandes |

Nous n'utilisons **pas** de cookies publicitaires, de cookies de suivi ou de cookies tiers à des fins de profilage sur la plateforme de commande. Le seul cookie défini sur l'application destinée aux clients est le cookie de session fonctionnel décrit ci-dessus.

---

## 10. Vos droits

Selon votre juridiction, vous pouvez disposer des droits suivants concernant vos données personnelles :

- **Droit d'accès :** Demander des informations sur les données personnelles que nous détenons à votre sujet.
- **Droit de rectification :** Demander la correction de données personnelles inexactes.
- **Droit à l'effacement :** Demander la suppression de vos données personnelles.
- **Droit à la portabilité des données :** Demander une copie de vos données dans un format structuré et lisible par machine.
- **Droit à la limitation du traitement :** Demander que nous limitions le traitement de vos données.
- **Droit d'opposition :** Vous opposer au traitement de vos données personnelles.
- **Droit de retrait du consentement :** Lorsque le traitement est fondé sur le consentement, le retirer à tout moment.

**Pour les Utilisateurs Finaux :** Étant donné que nous ne collectons aucune donnée personnelle identifiante, il n'y a généralement pas de données personnelles à consulter, corriger ou supprimer. Si vous souhaitez effacer votre session, il vous suffit de supprimer le cookie de votre navigateur ou d'attendre son expiration (24 heures).

**Pour les Utilisateurs Administrateurs :** Pour exercer vos droits, contactez-nous à contact@eazmenu.com. Les commerçants peuvent également supprimer les données de leur restaurant directement depuis le tableau de bord d'administration. Les demandes de suppression de compte seront traitées dans un délai de 30 jours.

---

## 11. Transferts internationaux de données

Nos services peuvent impliquer le traitement de données dans différentes juridictions. Le cas échéant :

- Supabase et Stripe opèrent avec des garanties de protection des données appropriées.
- PostHog est configuré pour utiliser des serveurs basés dans l'UE (`eu.posthog.com`).
- Nous veillons à ce que tout transfert international soit conforme aux réglementations applicables en matière de protection des données, y compris l'utilisation de Clauses Contractuelles Types (CCT) le cas échéant.

---

## 12. Protection des données des mineurs

EazMenu ne s'adresse pas aux personnes de moins de 16 ans. Nous ne collectons pas sciemment de données personnelles auprès d'enfants. Étant donné que les Utilisateurs Finaux ne sont pas tenus de fournir des informations personnelles, le risque de collecte involontaire de données de mineurs est minimal.

---

## 13. Modifications de cette politique

Nous pouvons mettre à jour la présente Politique de Confidentialité et de Protection des Données de temps à autre. En cas de modifications significatives, nous en informerons les Utilisateurs Administrateurs par e-mail ou via le tableau de bord d'administration. La date de « Dernière mise à jour » en haut de ce document indique la révision la plus récente.

---

## 14. Nous contacter

Si vous avez des questions concernant cette Politique de Confidentialité et de Protection des Données, ou si vous souhaitez exercer vos droits en matière de protection des données, veuillez nous contacter à :

**E-mail :** contact@eazmenu.com
