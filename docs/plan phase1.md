Tu travailles dans un repository TypeScript existant ou à créer pour construire un moteur générique de détection de coïncidences / similarités entre plusieurs instances d'un même domaine.

## Objectif

Construire une architecture générique permettant de prendre :

- un domaine composé de plusieurs instances structurées ;
- un schéma décrivant leurs champs ;
- un ensemble arbitraire de N instances, avec N >= 2 ;

et de détecter des correspondances, régularités ou relations communes entre leurs observations.

Le système ne doit absolument pas être spécifique aux présidents. Les présidents américains constituent seulement le premier domaine réel utilisé pour concevoir et valider immédiatement le moteur. L'architecture doit pouvoir être réutilisée plus tard avec d'autres datasets : personnes, pays, entreprises, œuvres, événements, objets, etc.

## Principe général

Une coïncidence n'est pas définie a priori comme « intéressante » par un humain.

Le système doit :

1. observer les données de N instances ;
2. détecter des relations structurées qui s'appliquent à ces observations ;
3. produire pour chaque détection une signature explicite et inspectable ;
4. mesurer ensuite à quelle fréquence cette même structure/signature apparaît dans les autres groupes comparables du domaine.

La rareté doit donc être essentiellement empirique : une structure est d'autant plus remarquable qu'elle apparaît rarement lorsqu'on applique exactement le même mécanisme aux autres groupes de N instances.

Ne cherche pas encore à construire un score global sophistiqué combinant toutes les coïncidences. Les résultats individuels, leurs signatures et leur prévalence doivent d'abord être corrects et interprétables.

## N-way, pas seulement pairwise

Le moteur doit être conçu nativement pour N instances.

Il ne doit pas supposer que la comparaison est toujours entre deux objets.

Une relation peut par exemple être évaluée sur :

- deux présidents ;
- trois présidents ;
- cinq présidents ;
- ou tout autre nombre raisonnable d'instances.

Les relations et signatures doivent donc être pensées comme N-aires lorsque cela a du sens.

## Relations et propriétés

Ne pars pas d'une taxonomie figée ou d'une liste imposée de propriétés.

À partir des objectifs ci-dessus, conçois un petit vocabulaire général et cohérent de relations suffisamment expressif pour produire des coïncidences humainement intelligibles, tout en évitant de transformer le système en calculatrice arbitraire capable de fabriquer artificiellement une rareté.

Une bonne relation représente une structure que l'on pourrait raisonnablement identifier comme telle : égalité, régularité, intervalle commun, correspondance entre champs, structure temporelle, etc.

Une mauvaise direction serait de permettre des transformations arbitraires du type :

« soustraire 3 à chaque valeur puis vérifier si les résultats sont divisibles par 7 »

simplement parce qu'une telle opération permet de créer une propriété rare.

La frontière exacte n'est volontairement pas spécifiée ici : elle fait partie du travail de conception.

Cherche une architecture où les relations sont génériques, typées, composables lorsque cela a un sens sémantique, mais où la composition reste limitée à des concepts interprétables.

## Expressions et relations entre plusieurs champs

Le système ne doit pas se limiter à appliquer une propriété indépendamment à chaque champ.

Il doit pouvoir représenter des relations entre plusieurs observations lorsqu'elles sont génériques.

Exemple conceptuel :

- birthYear ;
- electionYear ;
- intervalle entre birthYear et electionYear ;
- puis comparaison de cet intervalle entre plusieurs instances.

Le système doit donc pouvoir découvrir des relations dérivées sans qu'il soit nécessaire de stocker toutes les valeurs dérivées comme champs indépendants.

## Implications, redondances et double comptage

C'est un point important de conception.

Lors de la création du schéma, des expressions, des observations dérivées et des relations, recherche activement les implications logiques et les représentations redondantes.

Exemple :

ageAtElection = electionYear - birthYear

Si les deux formulations suivantes représentent nécessairement la même information :

- tous ont le même `ageAtElection` ;
- tous ont la même différence `electionYear - birthYear` ;

elles ne doivent pas être considérées naïvement comme deux éléments indépendants.

De même, certaines relations peuvent s'impliquer logiquement :

- toutes les valeurs égales ;
- progression régulière de pas zéro ;

ou une relation générale peut subsumer une relation plus spécifique.

Il n'est pas nécessaire de résoudre théoriquement tous les problèmes de dépendance statistique. En revanche, l'architecture doit reconnaître et traiter raisonnablement les duplications ou implications manifestes.

Favorise des représentations canoniques ou une fusion des détections lorsqu'elles décrivent réellement le même fait.

Documente les décisions prises.

## Résultat d'une détection

Le cœur du moteur ne doit pas dépendre du langage naturel.

Une détection doit être représentée sous forme de données structurées et facilement inspectables.

Conceptuellement, elle pourrait contenir des informations comme :

- les sujets comparés ;
- l'expression ou les observations concernées ;
- la relation détectée ;
- sa signature ;
- éventuellement sa prévalence dans le domaine.

La structure exacte est à concevoir.

Une sortie de debug pourrait ressembler à :

Adams, Baker, Clark
expression: birthYear
relation: regularSpacing
signature: { step: 5 }
prevalence: 1.3%

ou :

Adams, Baker, Clark
expression: interval(electionYear, birthYear)
relation: allEqual
signature: { value: 48 }
prevalence: 7.1%

Il n'est pas nécessaire de générer de belles phrases en langage naturel à ce stade.

Le système doit avant tout permettre de voir précisément ce qui a été détecté.

## Prévalence

Pour un groupe cible de taille N, le système doit pouvoir comparer une détection aux autres groupes de même taille dans le domaine.

Si le domaine est suffisamment petit, préfère une énumération exhaustive des combinaisons.

Par exemple, pour chaque signature détectée sur un groupe de trois instances :

- exécuter le même mécanisme sur tous les autres triplets ;
- compter la fréquence de la même structure/signature ou de la classe pertinente ;
- fournir cette fréquence comme prévalence empirique.

Fais attention à la définition de « même signature ».

Une valeur numérique exacte peut parfois être trop spécifique et rendre artificiellement toutes les signatures rares. Choisis des représentations ou classes de signatures cohérentes avec la relation considérée.

Cette décision doit rester transparente et testable.

## Domaine réel : présidents américains

Après avoir construit le noyau générique, crée un premier domaine réel consacré aux présidents américains.

Le but est de valider le système sur des données réelles et de pouvoir comparer des présidents arbitraires.

Construis un schéma présidentiel général et homogène à partir de caractéristiques qui seraient raisonnables pour décrire n'importe quel président.

Ne choisis pas des champs dans le but de reproduire une comparaison célèbre particulière.

Le schéma doit être justifiable indépendamment de n'importe quelle paire cible.

Récupère les données depuis des sources publiques fiables et conserve leur provenance de manière suffisamment claire pour pouvoir vérifier les observations importantes.

Les données manquantes doivent être représentées explicitement plutôt qu'inventées.

## Important : éviter toute contamination par une cible célèbre

Pendant cette phase, ne conçois pas le système en fonction d'une comparaison spécifique entre deux présidents célèbres.

En particulier :

- ne recherche pas de listes de « coïncidences célèbres » entre deux présidents ;
- ne construis pas de relation spécialement pour reproduire une anecdote connue ;
- ne choisis pas de champ simplement parce qu'il permettrait de détecter une telle anecdote ;
- ne teste pas le moteur dans le but de maximiser les résultats pour une paire célèbre.

Le moteur et le domaine présidentiel doivent être développés comme si leur objectif était simplement :

« comparer arbitrairement des présidents et découvrir des structures éventuellement surprenantes que nous ne connaissons pas à l'avance ».

Pour valider le comportement, teste plusieurs paires et groupes de présidents arbitraires.

Il est acceptable que certains résultats semblent sans intérêt : la prévalence empirique doit justement permettre de les distinguer des structures inhabituelles.

## Architecture

Utilise TypeScript et conçois une API claire, générique et fortement typée.

Sépare au minimum les responsabilités conceptuelles suivantes, même si les noms exacts ou la structure des fichiers peuvent différer :

- définition du domaine / schéma ;
- extraction ou évaluation des observations ;
- expressions ou relations dérivées ;
- relations / détecteurs ;
- signatures ;
- détections ;
- génération des groupes de N instances ;
- calcul de prévalence ;
- affichage/debug des résultats ;
- domaine spécifique des présidents.

Évite tout hardcoding du domaine présidentiel dans le moteur générique.

Le package générique ne devrait idéalement rien connaître de notions comme `President`, `birthYear`, `party`, etc.

## Tests

Ajoute des tests unitaires avec de petites données synthétiques où les structures attendues sont évidentes.

Teste notamment :

- N = 2 ;
- N > 2 ;
- valeurs identiques ;
- valeurs toutes distinctes ;
- structures régulières ;
- relations entre plusieurs champs ;
- données manquantes ;
- cas de redondance / implication ;
- calcul de prévalence.

Ajoute ensuite quelques tests ou scripts d'exploration utilisant le véritable domaine présidentiel.

## Livrable

À la fin :

1. le moteur générique doit fonctionner ;
2. le dataset / domaine des présidents doit être utilisable ;
3. plusieurs comparaisons arbitraires doivent avoir été exécutées ;
4. les détections doivent être inspectables et triables notamment par prévalence ;
5. les principales décisions architecturales et limites connues doivent être documentées ;
6. le code doit rester simple et compréhensible plutôt que chercher prématurément une théorie parfaite du phénomène.

Ne construis pas encore de narration, de génération de vidéos ou de langage naturel élaboré.

Ne cherche pas encore à optimiser un résultat concernant une paire particulière de présidents.

Une fois le système dans un état cohérent et testé, termine cette phase par un commit propre qui servira de frontière avant l'expérience suivante.

Documente les concepts et l'utilisation de l'API via un exemple dans README.md

Sépare le travail par commits locaux en utilisant la notation conventional commits.
