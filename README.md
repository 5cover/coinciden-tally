# coinciden-tally

Moteur TypeScript générique de détection de structures communes à **N instances, N ≥ 2**, avec signatures inspectables et prévalence empirique exhaustive. Les présidents américains sont un premier domaine de validation, pas un concept du noyau. Aucune narration, aucun score global, aucune recherche de coïncidences célèbres.

## Démarrer

Node.js ≥ 22 et pnpm. Le snapshot est versionné : les tests et les explorations ne nécessitent aucun accès réseau.

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm explore
pnpm explore monroe taft
pnpm explore grant coolidge eisenhower --json
pnpm explore adams monroe grant hoover carter --max-groups=1300000
```

Le mode texte affiche les huit premières détections, triées par prévalence structurelle croissante. `--json` expose **toutes** les détections, leurs AST, observations, sources, implications et compteurs. `--save` régénère [`data/exploration-summary.json`](data/exploration-summary.json) avec les huit premiers résultats de chaque groupe exécuté. Sans identifiants, quatre groupes arbitraires fixes sont comparés. Les identifiants utilisables sont dans [`data/presidents.json`](data/presidents.json), ou `presidentsDomain.instances`.

## Exemple d'API générique

Après `pnpm build`, les exports ESM `coinciden-tally` et `coinciden-tally/presidents` sont utilisables, y compris depuis ce dépôt. Les types sont générés avec le build.

L'exemple complet est dans [`scripts/example.ts`](scripts/example.ts), exécutable avec `pnpm example`. Ses huit personnes et ses années sont fictives : la population illustre des structures répétées, des paramètres exacts différents et une donnée manquante, pas une estimation statistique représentative.

```ts
import { CoincidenceEngine, debugDetection, field, known, missing } from 'coinciden-tally'
import type { Domain } from 'coinciden-tally'

interface Person {
  id: string
  birthYear: number | null
  eventYear: number
  category: string
}

const birth = field<Person, 'number'>(
  'birthYear',
  'number',
  p => (p.birthYear === null ? missing('not recorded') : known(p.birthYear)),
  { unit: 'year' }
)
const event = field<Person, 'number'>('eventYear', 'number', p => known(p.eventYear), { unit: 'year' })

const domain: Domain<Person> = {
  id: 'people',
  identify: p => p.id,
  label: p => p.id,
  instances: [
    { id: 'a', birthYear: 10, eventYear: 58, category: 'A' },
    { id: 'b', birthYear: 15, eventYear: 63, category: 'A' },
    { id: 'c', birthYear: 20, eventYear: 68, category: 'A' },
    // D'autres triplets reproduisent les structures, parfois avec un autre pas ou une autre catégorie.
    { id: 'd', birthYear: 25, eventYear: 73, category: 'B' },
    { id: 'e', birthYear: 30, eventYear: 78, category: 'B' },
    { id: 'f', birthYear: 40, eventYear: 88, category: 'B' },
    // Un intervalle différent et une naissance inconnue rendent les comparaisons moins uniformes.
    { id: 'g', birthYear: 31, eventYear: 80, category: 'C' },
    { id: 'h', birthYear: null, eventYear: 98, category: 'A' },
  ],
  schema: {
    fields: [birth, event, field<Person, 'category'>('category', 'category', p => known(p.category))],
    // Déclarer des endpoints sémantiquement pertinents, pas leur valeur dérivée.
    intervals: [{ from: birth, to: event }],
  },
}

const engine = new CoincidenceEngine(domain)
const detections = engine.analyze(['a', 'b', 'c'])
console.log('Groupe analysé : a, b, c. Comparaison avec les autres triplets, groupe cible exclu.')
for (const detection of detections) console.log(`\n${debugDetection(detection)}`)
```

L'exécution affiche quatre détections, triées par prévalence structurelle croissante :

| Expression                       | Relation         | Prévalence structurelle | Prévalence exacte | Triplets avec donnée manquante |
| -------------------------------- | ---------------- | ----------------------- | ----------------- | ------------------------------ |
| `category`                       | `allEqual`       | 7,27 % (4/55)           | 5,45 % (3/55)     | 0                              |
| `eventYear`                      | `regularSpacing` | 12,73 % (7/55)          | 3,64 % (2/55)     | 0                              |
| `birthYear`                      | `regularSpacing` | 14,71 % (5/34)          | 5,88 % (2/34)     | 21                             |
| `interval(birthYear, eventYear)` | `allEqual`       | 55,88 % (19/34)         | 55,88 % (19/34)   | 21                             |

Il y a 56 triplets possibles, dont le groupe cible est exclu : 55 autres groupes. La naissance inconnue de `h` rend 21 triplets inéligibles pour `birthYear` et l'intervalle, mais pas pour `eventYear` ou `category`. Le dénominateur dépend donc de l'expression.

La prévalence structurelle compte les progressions de n'importe quel pas et les catégories égales de n'importe quelle valeur. La prévalence exacte exige le pas observé de 5 ou la catégorie `A`. Ainsi, le triplet `d,e,f`, de catégorie `B`, contribue à l'égalité structurelle des catégories, mais pas à son égalité exacte.

`detect(ids)` détecte sans calculer de prévalence. `analyze(ids, { maxGroups })` ajoute les compteurs exhaustifs et trie avec `byPrevalence`. L'ordre fourni des sujets ne change pas le résultat. Un groupe comporte des identifiants uniques appartenant au domaine ; il peut contenir deux, trois, cinq ou davantage de sujets. Les observations du domaine sont évaluées et indexées une fois à la construction du moteur : reconstruire le moteur après modification des données.

Exemple présidentiel :

```ts
import { CoincidenceEngine } from 'coinciden-tally'
import { presidentsDomain } from 'coinciden-tally/presidents'

const results = new CoincidenceEngine(presidentsDomain).analyze(['grant', 'coolidge', 'eisenhower'])
console.log(JSON.stringify(results, null, 2))
```

## Concepts et responsabilités

| Module                    | Responsabilité                                                             |
| ------------------------- | -------------------------------------------------------------------------- |
| `src/core/model.ts`       | Domaine, schéma, champs typés, observations et constructeurs d'expressions |
| `src/core/expressions.ts` | Validation des types/unités, découverte, AST canonique et évaluation       |
| `src/core/relations.ts`   | Détecteurs N-aires déterministes                                           |
| `src/core/signatures.ts`  | Paramètres exacts, classes structurelles et clés stables                   |
| `src/core/detections.ts`  | Faits détectés, implications et tri                                        |
| `src/core/groups.ts`      | Combinaisons non ordonnées, sans remise                                    |
| `src/core/prevalence.ts`  | Réexécution du mécanisme et fréquences empiriques                          |
| `src/core/debug.ts`       | Affichage, indépendant du calcul                                           |
| `src/domains/presidents/` | Modèle et schéma présidentiels, chargement validé du snapshot              |
| `scripts/`                | Import reproductible et explorations                                       |

Une `Observation` est soit `{ status: 'known', value, sources }`, soit `{ status: 'missing', reason, sources }`. `null`, les dates invalides, `NaN` et les infinis ne sont pas des valeurs connues valides. Le noyau n'invente rien et ne remplace pas une absence par zéro. Un groupe incomplet pour une expression est exclu **pour cette expression seulement**, sans réduire N.

Une `Detection` contient les sujets, l'expression canonique et ses alias, la relation, la signature, les observations évaluées dans l'ordre des sujets, les implications manifestes et éventuellement la prévalence. Les observations dérivées conservent les sources des operands. Le calcul ne dépend pas des labels ou d'un texte en langage naturel.

Les faits de `implications` ont le même contrat `DetectedFact` qu'une détection : une `expression` structurée (`node`, `kind`, `unit` éventuelle, `label`, `aliases`, `id`), une `relation` et une `signature`. Ils restent inspectables même lorsque leur détection est supprimée de la liste principale. L'`id` est une clé canonique calculée à partir de l'AST, pas une expression à désérialiser. Les références `FactReference` de `explainedBy` utilisent explicitement `expressionId` et `relation` ; elles se résolvent parmi les détections et leurs implications pour le même groupe de sujets.

### Un vocabulaire volontairement borné

Les champs portent un type (`number`, `category`, `boolean`, `date`). Les champs numériques exigent une unité sémantique. Les dates sont des jours grégoriens ISO `YYYY-MM-DD`, pas des timestamps ou des chaînes comparées arbitrairement.

Le schéma découvre automatiquement `year(date)`, `month(date)` et `monthDay(date)` pour chaque champ date. **Seule l'année est numérique** : les mois sont cycliques, donc un écart linéaire entre leurs numéros serait trompeur. `monthDay` est une catégorie `MM-DD`, y compris `02-29`.

Les paires d'endpoints déclarées dans `schema.intervals` engendrent `interval(from, to) = to - from`. Des nombres doivent avoir la même unité ; des dates produisent un nombre de jours et également un intervalle entre leurs années. Le schéma fixe les paires avant les comparaisons : pas d'exploration de toutes les soustractions possibles. `schema.expressions` permet d'ajouter explicitement une expression avec `interval(...)` ou `datePart(...)`.

Il n'existe ni constantes arithmétiques, ni modulo, ni transformation libre dans l'AST. Les intervalles imbriqués sont refusés, y compris après résolution des alias. On compare des observations ou des intervalles interprétables, pas des formules arbitraires. Les extracteurs sont des fonctions applicatives de confiance et doivent rester purs : ce n'est pas un sandbox pour du code tiers.

### Relations et signatures

| Relation         | Condition                                  | Paramètres exacts  | Classe utilisée par défaut                                       |
| ---------------- | ------------------------------------------ | ------------------ | ---------------------------------------------------------------- |
| `allEqual`       | N ≥ 2, toutes les valeurs égales           | `{ value }`        | Toutes les égalités sur cette même expression                    |
| `allDistinct`    | N ≥ 2, toutes distinctes                   | `{}`               | Toutes les distinctions sur cette même expression                |
| `pairGap`        | N = 2, nombres distincts                   | `{ gap }`, positif | Tous les écarts positifs sur cette même expression               |
| `regularSpacing` | N ≥ 3, nombres triés, pas positif constant | `{ step }`         | Toutes les progressions de pas positif sur cette même expression |

Les progressions sont **non ordonnées** : on trie les valeurs, pas les sujets. Deux points ne suffisent pas à établir une progression. Un pas zéro est une égalité, pas une seconde détection. Les répétitions partielles ne constituent ni une progression ni une distinction complète.

La signature n'est pas un identifiant global indépendant : sa clé de comparaison est conceptuellement **(expression canonique, relation, N, classe)** ; la fréquence exacte ajoute les paramètres. `class: {}` signifie que toute occurrence de la relation sur cette expression appartient à la même classe, **pas** qu'on compare toutes les relations ou tous les champs entre eux.

`Detector` est un point d'extension : `id`, `accepts(expression, N)`, `detect(values)` et éventuellement `implies`. Un nouveau détecteur doit être déterministe, invariant par permutation, produire des signatures JSON finies et fixer ses classes indépendamment du groupe cible. Le noyau ne prétend pas certifier la pertinence sémantique des extensions ; le vocabulaire fourni reste petit.

### Prévalence : structure d'abord, valeur exacte séparément

Pour chaque fait détecté, le moteur applique **le même détecteur à la même expression** sur chaque autre combinaison de N instances du domaine. Il ne cherche pas des faits « proches » et ne choisit pas de classes après coup.

```text
frequency      = groupes ayant la même classe / autres groupes entièrement observables
exactFrequency = groupes ayant la même classe ET paramètres / même dénominateur
```

Le groupe cible est exclu, les groupes qui partagent certains sujets avec lui ne le sont pas. Les groupes sont non ordonnés et chaque combinaison est comptée une fois. `totalOtherGroups`, `eligibleOtherGroups`, `missingOtherGroups`, `matches` et `exactMatches` permettent de vérifier les dénominateurs.

Exemple : une égalité d'intervalle à 48 est évaluée principalement comme « intervalles égaux », pas uniquement « tous égaux à 48 ». De même, un écart numérique exact inhabituel ne rend pas une paire artificiellement remarquable : sa classe reste « deux valeurs distinctes ». La fréquence exacte reste disponible pour examiner la valeur ou le pas effectivement observé, mais **ne pilote pas le tri principal**.

Les occurrences sont comptées avant la suppression des redondances d'affichage : une égalité d'année compte aussi lorsqu'elle est impliquée par une égalité de date complète dans un groupe de référence. Sinon la suppression changerait artificiellement la fréquence du mécanisme.

Sans autre groupe éligible, la fréquence vaut `null`, pas zéro. Un zéro observé signifie « aucune occurrence ailleurs dans ce snapshot », pas une impossibilité, une probabilité théorique nulle ou une estimation statistique précise.

Le garde-fou par défaut est **100 000 combinaisons, cible comprise**. Un dépassement échoue explicitement ; `maxGroups` autorise une énumération plus grande. Aucun échantillonnage silencieux. Pour 45 sujets : 990 paires, 14 190 triplets et 1 221 759 groupes de cinq. Le générateur est paresseux ; le calcul reste combinatoire, environ O(combinaisons × détections cibles × N).

### Redondances et implications

- Les AST identiques partagent un identifiant stable ; les labels sont conservés comme alias et n'engendrent pas des faits supplémentaires.
- Un champ matérialisé peut déclarer `definedAs: interval(birth, event)`. Ses détections sont fusionnées avec celles de l'expression. Le moteur vérifie l'égalité de la valeur stockée et calculée lorsqu'elles sont toutes deux disponibles. L'expression est la référence : une valeur stockée ne remplace pas des operands manquants.
- `regularSpacing` et `pairGap` impliquent `allDistinct` sur la même expression : le fait faible est conservé dans `implications`, pas présenté séparément.
- L'égalité d'une date complète implique celle de son année, de son mois et de son jour-mois. L'égalité du jour-mois implique celle du mois. Les faits faibles sont fusionnés, avec conservation des implications transitives.
- Quand les deux endpoints sont constants dans un groupe, l'égalité de leur intervalle est marquée `explainedBy` avec **les deux** faits nécessaires. Cette dépendance conjointe reste visible, sans prétendre qu'un seul endpoint implique le résultat. Les références peuvent viser un fait présent dans `implications`.
- Les définitions d'alias et les implications de détecteurs cycliques sont refusées. Les types et unités sont vérifiés après normalisation.

On ne prétend pas résoudre toutes les dépendances statistiques ou tous les théorèmes algébriques. Les écarts opposés, des corrélations entre champs et certaines implications calendaires ne sont pas automatiquement unifiés. **Il ne faut pas sommer les détections comme des preuves indépendantes.**

## Domaine réel : présidents américains

Le snapshot provient exclusivement des **Fast Facts** du [Miller Center, Université de Virginie](https://millercenter.org/president), récupérés le **3 octobre 2026**. Chaque observation conserve l'URL individuelle, le label exact du champ, son texte source et l'horodatage. Par exemple, les fiches de [Monroe](https://millercenter.org/president/monroe) et de [Taft](https://millercenter.org/president/taft) permettent de vérifier les dates de leur comparaison. Aucun essai biographique, anecdote ou liste de coïncidences n'est extrait. Il s'agit de faits structurés, pas d'une copie des biographies.

Une instance est une **personne** : 45 instances couvrent 47 présidences. Cleveland et Trump possèdent deux périodes non consécutives. Ces périodes ne sont pas les mandats électoraux de quatre ans : `presidencyPeriods` compte les périodes de présidence continue identifiées par la source.

Le schéma homogène comprend la naissance, le décès, le lieu de naissance, le résumé des partis et de la religion, la première date d'inauguration/entrée publiée, la dernière fin publiée et le nombre de périodes. Ces éléments décrivent n'importe quel président ; aucun n'a été choisi pour reproduire une anecdote sur une paire particulière. Identifiants et numéros présidentiels servent à l'identification et aux validations, pas de champs à rechercher pour des coïncidences.

Les intervalles déclarés sont naissance : première entrée, naissance : décès et première entrée : dernière fin. **Un intervalle d'années calendaires n'est pas un âge révolu.** Le dernier intervalle est une amplitude calendaire, pas le temps total effectivement passé au pouvoir lorsque des périodes sont disjointes. `firstStart` reflète le champ `Inauguration Date` de la source : ce n'est pas une reconstitution juridique uniforme des dates de succession.

Les catégories sont les libellés exacts, à l'espacement normalisé ; pas de géocodage du lieu de naissance, de synonymes religieux ou de reclassification historique des partis. `partySummary` peut être un libellé composé et ne signifie pas « parti à la première entrée ». Les données absentes sont explicites. Une date de décès absente n'est pas une affirmation que la personne est encore en vie ; une fin absente n'est pas remplacée par une échéance future.

L'import :

```sh
pnpm import:presidents
pnpm test
pnpm explore --save
```

Il suit l'index présidentiel, déduplique les personnes, analyse seulement les blocs structurés, récupère les pages séquentiellement et écrit le nouveau snapshot uniquement après un import complet. Les dates machine sont validées ; des périodes ambiguës, inversées ou des fins futures observées font échouer l'import. L'index affiche actuellement une ancienne fin dans la seconde ligne de Trump : **seules les Fast Facts individuelles font foi pour l'import**, où la seconde fin est absente. Aucun correctif inventé n'est ajouté.

Les tests réels fixent le comportement du snapshot versionné ; après actualisation, des compteurs ou la couverture peuvent changer et doivent être revérifiés. Les sources ne sont pas croisées indépendamment : conserver leur provenance ne garantit pas leur exactitude historique ni leur mise à jour exhaustive.

### Explorations réalisées

Les groupes suivants ont été exécutés sans rechercher ni optimiser une cible. Les comptes et les huit premiers faits des quatre premiers groupes sont dans [`data/exploration-summary.json`](data/exploration-summary.json). Le résumé de l'énumération à cinq est dans [`data/exploration-five-summary.json`](data/exploration-five-summary.json).

| Groupe                               | N   | Autres groupes | Exemple de structure et prévalence                                                                |
| ------------------------------------ | --- | -------------- | ------------------------------------------------------------------------------------------------- |
| Monroe, Taft                         | 2   | 989            | Intervalle calendaire naissance-décès égal à 73 : structure 11/779 = 1,41 % ; valeur exacte 0/779 |
| Van Buren, Hoover                    | 2   | 989            | Intervalle calendaire naissance-première entrée égal à 55 : structure 32/989 = 3,24 %             |
| Madison, Polk, Carter                | 3   | 14 189         | Résumés des partis tous distincts : 5 760/14 189 = 40,59 %                                        |
| Grant, Coolidge, Eisenhower          | 3   | 14 189         | Résumés des partis égaux : 1 181/14 189 = 8,32 %                                                  |
| Adams, Monroe, Grant, Hoover, Carter | 5   | 1 221 758      | Résumés religieux tous distincts : 373 820/1 221 758 = 30,60 %                                    |

Les dénominateurs inférieurs au nombre de groupes indiquent des observations manquantes pour l'expression concernée. Les signatures exactes, y compris celles de fréquence zéro, ne sont pas cachées ni assimilées au score structurel.

## Validation et limites de cette phase

`pnpm test` exécute les tests Node après compilation TypeScript : données synthétiques pour N = 2, 3 et 5, valeurs égales/distinctes, progressions, intervalles multi-champs, dates bissextiles et invalides, provenance, valeurs manquantes, fusion d'alias, implications, dénominateurs, signatures exactes et classes, groupe cible exclu, limites combinatoires et extensions. Les tests présidentiels vérifient également le snapshot, l'import HTML et les explorations exhaustives de groupes arbitraires. `pnpm lint` conserve les règles strictes existantes. TypeScript est installé dans la plage supportée par typescript-eslint.

Limites assumées :

- Comparaisons numériques exactes, sans tolérance ou arrondi choisi après coup ; les flottants demandent une convention de domaine appropriée.
- Pas de fuzzy matching de texte, de partitions partielles d'un groupe, d'alignement de listes ou de séries de mandats.
- Pas d'ajustement pour recherches multiples, d'intervalle de confiance, de probabilité causale ou de score global. Les groupes de référence se recouvrent et ne sont pas des essais indépendants.
- Le schéma, les classes et le vocabulaire conditionnent la recherche ; ils doivent être fixés avant d'examiner une cible. La rareté empirique n'est pas une qualification humaine de l'intérêt d'un fait.
- Exhaustivité sur le domaine et snapshot déclarés seulement ; ni sampling, ni population de comparaison externe implicite.

Cette phase se clôt par des commits locaux Conventional Commits séparant le noyau, le domaine sourcé et la documentation/validation. Aucun travail de narration ou d'optimisation d'une paire célèbre n'a été entrepris. Le dossier `docs/` n'a pas été consulté et est exclu des entrées TypeScript.
