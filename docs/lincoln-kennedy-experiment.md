# Expérience Lincoln-Kennedy

## Protocole et reproduction

Le moteur, les détecteurs, les signatures, les implications, le schéma présidentiel et le snapshot préexistants sont conservés. Aucun score global n'existe ; aucun n'a été ajouté. Les seuils de 1 %, 2,5 %, 5 % et 10 % sont descriptifs et inclusifs, sans sélection pour favoriser la cible.

```sh
pnpm experiment:pairs
```

Cette commande hors ligne lance d'abord `analyze(['lincoln', 'kennedy'])`, puis appelle **la même API pour chacune des 990 paires**, cible comprise. Chacune est comparée aux 989 autres paires ; celles qui partagent un président avec elle restent dans sa référence. Le rapport comparatif distingue les 989 contrôles de la cible. La recherche folklorique a commencé seulement après cette première exécution exhaustive.

Le script accepte aussi deux autres identifiants : `pnpm experiment:pairs ford truman`. Il remplace les sorties du même dossier, sans changer le moteur. Les résultats versionnés correspondent à Lincoln-Kennedy. Pour reproduire exactement le snapshot, ne pas lancer l'import réseau. Node et les dépendances du lockfile sont nécessaires.

Sorties dans [data/pair-experiment](../data/pair-experiment/) :

| Fichier | Contenu |
| --- | --- |
| `target.json` | Toutes les détections de la cible : AST, observations, provenance, signature, implications et compteurs |
| `target.csv` | Toutes les détections, fréquences structurelles et exactes, valeurs et sources, triables |
| `target.txt` | Affichage lisible complet, avec implications |
| `all-pairs.jsonl.gz` | Sortie intégrale sans perte des 990 appels, une paire par ligne JSON après décompression gzip |
| `profiles.csv` | Comptes et seuils pour chaque paire |
| `summary.json` | Métadonnées, profils, histogrammes, comparaisons et trois faits les plus rares par paire |
| `coverage.json` | Couverture et identifiants manquants de chaque expression compilée |

Le gzip est une compression standard, pas un échantillonnage ni une suppression d'observations. `gzip -dc data/pair-experiment/all-pairs.jsonl.gz` permet de récupérer le JSONL. Chaque ligne contient `ids` et `detections`, avec les sources de chaque observation. Les valeurs suivent `subjects`, dans l'ordre canonique des identifiants, donc **Kennedy avant Lincoln**. Les exports CSV ont des cellules JSON pour les valeurs composées. Les SHA-256 du snapshot et des fichiers de protocole fixent la provenance logicielle. Les valeurs numériques non arrondies sont conservées en JSON.

## Vérification du domaine

[L'audit sauvegardé](../data/presidents-audit.json) a relu l'index et les Fast Facts des **45 personnes et 47 présidences**, avec le même parseur et la même règle de collecte pour toutes. Aucun ajout, retrait ou changement de valeur/statut n'a été trouvé. Aucun fait présidentiel n'a été corrigé ou ajouté. Les nouvelles observations d'audit gardent URL, champ, texte brut et horodatage ; le snapshot original reste inchangé.

Audit réseau reproductible, distinct de l'expérience hors ligne :

```sh
pnpm audit:presidents
```

La validation existante est invoquée sur le dataset collecté. Les dates, catégories et périodes de [Lincoln](https://millercenter.org/president/lincoln) et de [Kennedy](https://millercenter.org/president/kennedy) correspondent à leurs fiches. Les récits institutionnels de [Ford's Theatre](https://fords.org/lincolns-assassination/) et de la [JFK Library](https://www.jfklibrary.org/learn/about-jfk/jfk-in-history/november-22-1963-death-of-the-president) confirment notamment la distinction entre tir et décès : Lincoln est blessé le 14 avril et meurt le 15, Kennedy est blessé et meurt le 22 novembre.

Couverture des expressions déjà prévues :

| Données | Personnes renseignées | Conséquence sur une paire cible entièrement observée |
| --- | --- | --- |
| Naissance, lieu, parti, religion, première entrée, périodes | 45/45 | 989 autres paires éligibles |
| Décès | 40/45 | 779 autres paires éligibles, 210 exclues |
| Dernière fin | 44/45 | 945 autres paires éligibles, 44 exclues |

Les projections et intervalles héritent de ces absences. Les décès absents concernent Clinton, George W. Bush, Obama, Trump et Biden ; la dernière fin absente concerne Trump. Carter possède bien un décès au 29 décembre 2024. Aucune absence n'a été remplacée par une valeur future ou un zéro.

Cet audit vérifie exhaustivement la conformité à la source universitaire et la couverture du protocole, **pas une expertise historique indépendante de chaque champ**. Le protocole compare des libellés sources : `Democratic` pour Carter n'est pas normalisé en `Democrat`, `Whig; Republican` de Lincoln n'est pas un parti unique. `firstStart` est la date publiée dans Inauguration Date, sans harmonisation juridique des successions. `presidencyPeriods` compte les périodes continues, pas les mandats électoraux. Ces conventions sont anciennes et n'ont pas été retouchées pour la cible.

**Corrections génériques explicitement signalées :** l'importeur écrivait à `../../data/presidents.json` depuis `scripts/`, donc hors du repository. Il écrit désormais à `../data/presidents.json` et valide le résultat avant écriture. La commande `import:presidents` échouait aussi avec `ERR_MODULE_NOT_FOUND` sur les imports `.js` depuis les sources TypeScript ; elle utilise maintenant le chargeur `--import tsx`, comme les autres scripts du projet. Ajout du mode d'audit sans écrasement du snapshot. Aucun bug du moteur ni de prévalence n'a été identifié ou corrigé.

## Résultats Lincoln-Kennedy

**18 détections : une égalité, sept distinctions catégorielles, dix écarts numériques.** Une distinction n'est pas une ressemblance. L'unique égalité est le nombre de périodes continues : 1 et 1, fréquence structurelle **903/989 = 91,30 %**. Elle ne dit pas que les deux présidents ont effectué un seul mandat : Lincoln était dans son second mandat.

Les sept distinctions portent sur les quatre mois de dates, le lieu de naissance, le résumé de parti et celui de religion. Les dix écarts numériques portent sur les quatre années et les six intervalles déjà déclarés (jours et années). La liste complète inspectable est dans [target.txt](../data/pair-experiment/target.txt) et [target.json](../data/pair-experiment/target.json).

Exemples, sans remplacer les résultats par une narration :

| Expression / relation | Valeurs Lincoln ; Kennedy | Signature exacte | Structure parmi les autres paires | Exact parmi les mêmes paires |
| --- | --- | --- | --- | --- |
| `month(lastEnd)` / `allDistinct` | 04 ; 11 | `{}` | 609/945 = 64,44 % | 609/945 |
| `presidencyPeriods` / `allEqual` | 1 ; 1 | `value=1` | 903/989 = 91,30 % | 902/989 |
| `year(firstStart)` / `pairGap` | 1861 ; 1961 | `gap=100` | 987/989 = 99,80 % | 15/989 = 1,52 % |
| `year(deathDate)` / `pairGap` | 1865 ; 1963 | `gap=98` | 776/779 = 99,61 % | 5/779 = 0,64 % |
| `interval(year(birthDate), year(firstStart))` / `pairGap` | 52 ; 44 | `gap=8` | 956/989 = 96,66 % | 58/989 = 5,86 % |
| `interval(firstStart, lastEnd)` / `pairGap` | 1503 ; 1036 jours | `gap=467` | 854/945 = 90,37 % | 1/945 = 0,11 % |
| `interval(birthDate, deathDate)` / `pairGap` | 20516 ; 16978 jours | `gap=3538` | 779/779 = 100 % | 0/779 |
| `interval(birthDate, firstStart)` / `pairGap` | 19013 ; 15942 jours | `gap=3071` | 989/989 = 100 % | 0/989 |

Toutes les classes sont `{}` : elles comparent la même relation sur la même expression pour N=2. L'écart de 100 n'a pas une classe spéciale. La détection structurellement la moins fréquente, `month(lastEnd)/allDistinct`, reste à **64,44 %**. Les 18 fréquences sont au-dessus de 10 % ; l'histogramme descriptif est donc `[0, 0, 0, 0, 18]` pour les bandes jusqu'à 1 %, 2,5 %, 5 %, 10 %, puis 100 %.

Les écarts exacts de jours sans occurrence ailleurs illustrent surtout la finesse d'un paramètre numérique : ils ne deviennent pas des structures rares et ne pilotent pas le tri. Une fréquence empirique nulle signifie seulement aucune autre occurrence dans ce snapshot.

## Contrôles exhaustifs

Sur les **989 contrôles**, le nombre de détections va de 10 à 21, avec médiane 18. Distribution :

| Nombre de détections | 10 | 11 | 14 | 15 | 17 | 18 | 19 | 20 | 21 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Paires de contrôle | 43 | 1 | 151 | 15 | 1 | 593 | 149 | 33 | 3 |

| Seuil structurel inclusif | Détections Lincoln-Kennedy | Contrôles ayant au moins une détection sous ce seuil |
| --- | --- | --- |
| 1 % | 0 | 20/989 |
| 2,5 % | 0 | 32/989 |
| 5 % | 0 | 63/989 |
| 10 % | 0 | 337/989 |

Des exemples sélectionnés **après l'énumération**, pour montrer différents profils et non un classement scientifique :

| Paire | Total | Égalités | Comptes sous 1 %, 2,5 %, 5 %, 10 % | Structures observées |
| --- | --- | --- | --- | --- |
| Lincoln, Kennedy | 18 | 1 | 0, 0, 0, 0 | Une période continue chacun |
| Ford, Truman | 18 | 4 | 1, 1, 2, 2 | Décès un 26 décembre : 4/779 ; même intervalle d'années naissance-entrée, 61 : 32/989 |
| Washington, Andrew Johnson | 19 | 5 | 0, 1, 2, 2 | Intervalle d'années naissance-décès de 67 : 11/779 ; naissance-entrée de 57 : 32/989 |
| Jefferson, Monroe | 19 | 8 | 1, 1, 1, 3 | Décès un 4 juillet : 4/779 ; naissance en avril ; même amplitude de présidence de 2922 jours |
| Jefferson, Madison | 18 | 7 | 0, 0, 1, 2 | Naissance-entrée de 58 années calendaires ; amplitude de 2922 jours |
| Van Buren, Hoover | 18 | 6 | 0, 0, 1, 2 | Naissance-entrée de 55 années calendaires ; amplitude de 1461 jours |

Les paires Grant-Jefferson, Grant-Monroe et William Henry Harrison-Lincoln produisent le maximum brut de 21 détections, pas nécessairement beaucoup d'égalités. Le rapport donne aussi les 128 contrôles ayant exactement le même vecteur `(total, égalités, comptes aux quatre seuils)` que la cible, dont Washington-Garfield et Adams-Kennedy. Ce vecteur ne prétend pas que leurs observations ou leurs distributions fines sont identiques.

Les faits les plus rares des contrôles incluent : décès commun d'Adams et Jefferson au 4 juillet 1826 (0/779), anniversaire commun de Polk et Harding au 2 novembre (0/989), libellé commun de naissance `New York, New York` de Theodore Roosevelt et Trump (0/989). Le dernier exemple dépend fortement de l'identité textuelle des lieux : il ne certifie ni proximité géographique ni unicité historique. Les entrées la même année de Harrison-Tyler et Garfield-Arthur sont également rares (1/989) mais liées à la succession après décès, pas à des événements indépendants.

## Corpus folklorique indépendant

[lincoln-kennedy-folklore.json](../data/lincoln-kennedy-folklore.json) conserve **24 affirmations et variantes** : 13 exactes, 3 approximatives, 2 trompeuses, 5 fausses et 1 non vérifiable dans cette recherche. Les cinq catégories de représentabilité demandées sont codées séparément, cumulables, avec sources et raisons par affirmation. La circulation est attestée par [TIME, 1964](https://content.time.com/time/subscriber/article/0,33009,876021,00.html) et un inventaire secondaire de variantes ; les vérifications privilégient les institutions historiques et archives. Snopes était inaccessible et n'est pas utilisé comme preuve consultée.

**Aucune de ces 24 affirmations n'est intégralement détectée sur Lincoln-Kennedy par le protocole actuel.** L'écart d'entrée en fonction est un résultat naturel voisin, non la vérification de l'élection. Le siècle séparant les naissances des Johnson est naturellement détectable sur **une autre paire**, mais aucune jointure vers les successeurs n'existe. Les affirmations exactes sur les blessures ou circonstances pourraient utiliser des observations scalaires homogènes ; ces données ne sont pas dans le domaine, et n'ont pas été ajoutées.

Degrés de liberté visibles : patronymes pour les présidents mais noms complets pour les auteurs des tirs ; retrait des espaces ; extraction de prénoms ; jour de semaine du tir plutôt que du décès ; changement de rôle entre théâtre et voiture ; homonymies ; catégories géographiques flexibles ; fenêtre d'une semaine. Les sept lettres de deux patronymes n'utilisent pas une transformation du vocabulaire. Le jeu Ford/Lincoln compare un bâtiment, un constructeur et une marque, pas le même champ sémantique.

Erreurs vérifiées : Booth est né en **1838**, non 1839 ([NPS](https://www.nps.gov/people/john-wilkes-booth.htm)) ; le refuge était une grange, non un entrepôt ([Ford's Theatre](https://fords.org/lincolns-assassination/material-evidence-john-wilkes-booth/)) ; les secrétaires privés documentés de Lincoln sont Nicolay et Hay ([Library of Congress](https://www.loc.gov/item/2008680250/)), tandis qu'Evelyn Lincoln est bien attestée pour Kennedy. Le décès de Marilyn Monroe en 1962 suffit à réfuter la variante de la semaine précédant novembre 1963. Un avertissement précis non vérifié n'est pas déclaré faux par simple absence de preuve.

## Redondances, limites et conclusion

La fusion existante supprime des distinctions faibles impliquées par les écarts, et des projections calendaires impliquées par une date. Ces faits demeurent dans `implications`. Elle ne résout pas toutes les dépendances :

- Pour les deux sujets, décès et dernière fin ont les mêmes dates. Les écarts d'années de 98 et les distinctions de mois se répètent donc sur deux champs. Leurs prévalences diffèrent parce que les populations éligibles et les distributions de ces champs diffèrent.
- Les écarts d'années naissance-entrée (8) et naissance-décès (10) dérivent des différences entre les écarts 108, 100 et 98. Les écarts en jours partagent également leurs endpoints. Ils ne sont pas des éléments de preuve indépendants.
- Jours et années sont deux granularités d'un intervalle, non deux phénomènes autonomes. Une soustraction d'années calendaires n'est pas un âge révolu.
- Les premiers et derniers jours des présidences reflètent une histoire institutionnelle corrélée. Les paires de contrôle se recouvrent ; leurs observations ne sont pas des essais indépendants.

**Ce que montre cette expérience :** le moteur générique produit beaucoup de structures décrivables, surtout des différences, mais aucune structure rare pour Lincoln-Kennedy selon ses classes prédéfinies. D'autres paires produisent davantage d'égalités et certaines structures moins fréquentes. Ni le total brut ni une petite fréquence exacte ne suffisent à qualifier une paire d'extraordinaire.

**Ce qu'elle ne montre pas :** elle n'est pas un test exhaustif de toutes les ressemblances historiques ni une preuve que la paire serait ordinaire sous tout protocole imaginable. Le schéma restreint explique une grande partie de la faible couverture du folklore ; la discipline d'un protocole préfixé explique le refus des transformations choisies après coup. Il n'existe pas d'ajustement pour recherches multiples, de modèle nul probabiliste, de score causal ni de mesure complète de dépendance.

Questions ouvertes pour une expérience ultérieure, **sans modification rétrospective** : comparer une collecte multissource homogène avec les libellés actuels, étudier la sensibilité à la couverture des décès, mieux rendre visibles les dépendances inter-champs et décider avant toute nouvelle cible d'un protocole d'événements biographiques. Le corpus folklorique est un corpus raisonné, pas une liste canonique exhaustive ; un item non vérifiable reste ouvert.

## Vérifications logicielles

`pnpm typecheck`, `pnpm lint`, `pnpm test`. Les tests vérifient la liaison des résultats au snapshot/protocole, l'exhaustivité et l'unicité des 990 paires, la conformité de toutes les détections archivées à `detect`, la reproduction complète de prévalences sur la cible et des contrôles variés, et les références du corpus indépendant. Le corpus n'est jamais une entrée de l'expérience.
