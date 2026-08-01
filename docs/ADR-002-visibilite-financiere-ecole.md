# ADR-002 — Visibilité financière de l'école

- **Statut :** accepté
- **Date :** 2026-07-30
- **Décision métier :** vue agrégée et détail transactionnel

## Décision

Un administrateur d'école peut consulter les deux niveaux de visibilité sur les
paiements liés aux candidatures de son établissement :

- un résumé agrégé : nombre total, paiements terminés, en attente, échoués et
  montant réellement encaissé ;
- un détail transactionnel paginé, limité aux données nécessaires au suivi :
  statut, montant, référence, moyen de paiement, candidat et offre concernés.

## Protection du périmètre

L'endpoint `GET /schools/me/payments` ne reçoit aucun identifiant d'école du
client. Il déduit l'école depuis le profil `schoolAdmin` authentifié et filtre les
paiements par le chemin `Payment → Application → Offer → schoolId`.

Les paiements sans candidature associée, ainsi que les candidatures et offres
supprimées, sont exclus. Une école ne peut donc pas recevoir de paiement lié à une
autre école.

## Conséquence frontend

Le tableau de bord affiche le résumé et les cinq transactions les plus récentes.
La réponse API reste paginée pour permettre une future page de détail sans charger
l'ensemble des paiements.
