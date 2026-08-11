Frontend de la plateforme GET (Next.js, App Router) — voir le [README racine](../README.md) pour la vue d'ensemble du monorepo (backend, infrastructure Docker) et le [guide de déploiement](../DEPLOYMENT.md).

## Démarrage

```bash
npm install
npm run dev
```

Ce dépôt utilise `npm` (`package-lock.json` committé) — pas de yarn/pnpm/bun, un second lockfile créerait une dérive de versions non détectée par la CI.

Le backend (voir [`../backend`](../backend)) doit tourner en parallèle (`npm run start:dev`, http://localhost:3001) pour que les appels API fonctionnent. Une fois les deux lancés, http://localhost:3000 affiche l'application.

## Avant de terminer un écran

Exécutez la [checklist responsive manuelle](docs/RESPONSIVE_TEST_CHECKLIST.md) avant toute livraison d’un écran nouveau ou modifié. Elle fait partie de la définition de terminé du frontend.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
