Tu reprends un repository TypeScript contenant déjà :

- un moteur générique de détection de coïncidences / similarités N-aires ;
- un domaine de données consacré aux présidents américains ;
- un mécanisme de détection structurée ;
- un calcul de prévalence sur des groupes de contrôle ;
- des tests et des exemples utilisant des présidents arbitraires.

Ce système a été conçu précédemment sans chercher à reproduire les célèbres coïncidences entre Abraham Lincoln et John F. Kennedy.

Cette phase consiste maintenant à utiliser le système existant pour réaliser cette expérience.

## Règle méthodologique principale

Ne modifie pas le vocabulaire des relations, le mécanisme de détection, la logique de scoring/prévalence ou le schéma du domaine simplement parce qu'une modification permettrait de détecter davantage de ressemblances entre Lincoln et Kennedy.

Le système existant constitue le protocole de l'expérience.

Les corrections de bugs génériques sont permises si elles sont réellement des bugs et si la correction est valable indépendamment de Lincoln et Kennedy. Toute modification de ce type doit être explicitement signalée.

De même, si des données présidentielles sont manquantes ou incorrectes, elles peuvent être complétées ou corrigées à condition d'appliquer la même règle de collecte à l'ensemble du domaine concerné et de documenter les sources.

Ne crée pas un champ ou une relation ad hoc pour capturer une anecdote Kennedy-Lincoln.

## Étape 1: Vérifier le domaine

Inspecte le dataset présidentiel existant.

Vérifie en particulier que les données nécessaires aux relations déjà supportées par le moteur sont présentes et correctement renseignées pour Lincoln, Kennedy et les autres présidents utilisés comme contrôles.

Corrige uniquement les erreurs factuelles ou problèmes généraux de couverture du dataset.

Utilise des sources fiables et conserve leur provenance.

## Étape 2: Exécuter Lincoln-Kennedy

Exécute le moteur sur :

- Abraham Lincoln ;
- John F. Kennedy.

Utilise exactement le même pipeline que pour n'importe quelle autre paire.

Produis la liste complète des détections, ou une sortie exploitable si elle est très volumineuse.

Pour chaque détection, expose au minimum :

- l'expression / les observations concernées ;
- la relation ;
- la signature ;
- les données sources utiles pour vérifier le résultat ;
- sa prévalence parmi les autres paires comparables.

Trie ou rends facilement triables les résultats par rareté.

Ne cherche pas encore à transformer cette liste en narration.

## Étape 3: Contrôles

Applique exactement le même moteur à toutes les autres paires de présidents possibles, ou à l'ensemble exhaustif pertinent permis par le dataset.

Lincoln-Kennedy ne doit recevoir aucun traitement algorithmique spécial.

Produis des éléments permettant de situer leur résultat par rapport aux contrôles.

Même si le système ne possède pas encore un score global satisfaisant, montre au minimum des comparaisons comme :

- nombre total de détections ;
- distribution des prévalences des détections ;
- nombre de détections sous plusieurs seuils descriptifs de rareté ;
- détections les plus rares ;
- autres paires présentant des profils similaires ou riches en coïncidences.

Si un agrégat existe déjà dans le moteur, utilise-le.

N'invente pas un nouveau score uniquement parce qu'il donne un résultat particulièrement intéressant pour Lincoln-Kennedy.

Si aucune agrégation existante n'est satisfaisante, conserve une analyse vectorielle / descriptive plutôt que de forcer un chiffre unique.

## Étape 4: Dataset séparé des coïncidences populaires Lincoln-Kennedy

Seulement après avoir exécuté l'expérience principale, constitue séparément un dataset des affirmations traditionnellement associées aux « coïncidences Lincoln-Kennedy ».

Recherche des sources permettant de distinguer :

- les affirmations exactes ;
- les affirmations approximatives ;
- les affirmations trompeuses ;
- les affirmations fausses ou non vérifiables.

Ce dataset folklorique ne doit pas modifier rétrospectivement le moteur.

Pour chaque affirmation populaire, indique si :

1. le système existant la détecte naturellement ;
2. le système pourrait conceptuellement la représenter mais le domaine manque de données ;
3. elle n'est pas représentable avec le vocabulaire actuel ;
4. elle repose sur une formulation arbitraire ou trop spécifique ;
5. elle est factuellement incorrecte.

L'objectif n'est pas de maximiser la couverture.

Au contraire, les coïncidences célèbres que le moteur refuse naturellement de considérer peuvent être très informatives sur la manière dont les listes populaires sont construites.

## Étape 5: Analyse

Réponds aux questions suivantes à partir des résultats :

- Quelles ressemblances Lincoln-Kennedy sont réellement détectées par un moteur générique conçu sans cette cible ?
- Les signatures correspondantes sont-elles rares parmi les autres paires de présidents ?
- Lincoln-Kennedy présentent-ils beaucoup de structures rares, ou simplement beaucoup de structures décrivables ?
- Existe-t-il d'autres paires présidentielles qui produisent elles aussi des ensembles impressionnants de coïncidences ?
- Quelles affirmations célèbres reposent sur des degrés de liberté que le moteur générique n'aurait pas choisis naturellement ?
- Quelles redondances apparaissent entre différentes détections ?
- Quelles limites du moteur deviennent visibles à travers cette expérience ?

Évite de transformer automatiquement chaque faible prévalence en preuve d'une relation « extraordinaire ».

Présente les résultats tels qu'ils sortent du protocole.

## Reproductibilité

Ajoute un script ou une commande unique permettant de reproduire l'expérience depuis le repository.

Idéalement, l'exécution doit produire des sorties structurées: JSON, CSV ou équivalent: en plus d'un affichage lisible.

Conserve les résultats bruts afin qu'on puisse ensuite construire d'autres visualisations ou expériences sans relancer la collecte.

## Livrable final

Le repository doit contenir :

- les éventuelles corrections documentées du dataset ;
- l'exécution reproductible Lincoln-Kennedy ;
- les résultats de toutes les paires de contrôle ;
- les détections structurées et leurs prévalences ;
- le dataset séparé des affirmations populaires Kennedy-Lincoln avec leur vérification ;
- une analyse concise de ce que montre l'expérience ;
- les limitations ou questions ouvertes découvertes pendant l'exécution.

Le but est de tester honnêtement le système construit précédemment, pas de fabriquer une démonstration selon laquelle Lincoln et Kennedy seraient soit extraordinairement semblables, soit nécessairement ordinaires.

Laisse les résultats empiriques décider.
