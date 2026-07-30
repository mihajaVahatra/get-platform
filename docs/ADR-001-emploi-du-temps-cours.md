# ADR-001 — Modèle d'emploi du temps des cours

- **Statut :** accepté — remplace la décision initiale Option A
- **Date :** 2026-07-30
- **Décideur :** Product Owner

## Contexte

Le modèle `Course` possède déjà les champs texte optionnels `room` et `schedule`.
Un écran d'emploi du temps factice existe historiquement, mais il ne doit pas être
connecté ni enrichi tant que le niveau de structuration des données n'est pas tranché.

Deux options ont été évaluées :

1. **Option A (S)** — conserver `Course.room` et `Course.schedule` sous forme de
   texte libre et présenter ces informations dans une liste de cours.
2. **Option B (L)** — introduire `CourseSlot(courseId, dayOfWeek, startTime,
   endTime, room)`, migrer les données existantes et construire une grille
   interactive avec détection de conflits.

## Décision

Nous retenons **l'option B**. L'emploi du temps sera modélisé par une nouvelle
entité `CourseSlot` plutôt que par le seul champ texte `Course.schedule`.

Le modèle cible est :

```text
CourseSlot
- courseId
- dayOfWeek
- startTime
- endTime
- room
```

Un cours pourra ainsi avoir plusieurs créneaux. Le champ `Course.schedule` devient
une donnée historique à migrer puis à déprécier ; il ne sera plus la source de vérité
pour l'affichage d'un emploi du temps.

## Conséquences

- Le prochain ticket backend devra ajouter le modèle Prisma et sa migration, avec les
  index nécessaires aux recherches par cours, jour et salle.
- Une migration de données devra convertir les valeurs `schedule` non ambiguës ; les
  valeurs libres ambiguës devront être signalées pour une reprise manuelle plutôt que
  converties de façon hasardeuse.
- Les contrôles de conflit devront au minimum empêcher deux créneaux qui se chevauchent
  dans une même salle et au même horaire. Les conflits de professeur/groupe devront être
  inclus si ces données sont disponibles dans le ticket d'implémentation.
- Aucun écran de planning ne doit être livré avant la migration, les contrôles de
  conflit et le contrat API correspondant.

## Conditions de réouverture

Un futur ADR ne sera nécessaire que si le périmètre de détection des conflits ou les
règles de conversion des créneaux existants changent substantiellement.
