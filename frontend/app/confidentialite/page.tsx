import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { CURRENT_TERMS_VERSION } from '@/lib/terms-version';

export const metadata = {
  title: 'Politique de confidentialité — GET',
  description:
    'Politique de confidentialité de la plateforme GET (Grandes Écoles de Tananarive) : données collectées, usage, conservation et droits.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#faf9ff] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            aria-label="Retour à l’accueil GET"
            className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Link>
          <Logo size={40} tone="color" />
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-7 shadow-[0_20px_60px_rgba(60,45,140,0.08)] sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#101643]">
            Politique de confidentialité
          </h1>
          <p className="mt-2 text-sm text-[#69738f]">
            Version du {CURRENT_TERMS_VERSION} — dernière mise à jour.
          </p>

          <div className="mt-8 text-[15px] leading-7 text-[#33395c] [&>h2]:mt-8 [&>h2]:text-xl [&>h2]:font-extrabold [&>h2]:text-[#101643] [&>hr]:my-8 [&>hr]:border-slate-200 [&>li]:mt-1.5 [&>p]:mt-3 [&>ul]:mt-3 [&>ul]:list-disc [&>ul]:space-y-1.5 [&>ul]:pl-6 [&_a]:font-medium [&_a]:text-indigo-600 [&_a]:hover:underline [&_strong]:font-bold [&_strong]:text-[#101643]">
            <p>
              Cette politique décrit quelles données personnelles GET
              collecte, pourquoi, comment elles sont protégées, combien de
              temps elles sont conservées, et quels droits chaque
              utilisateur peut exercer.
            </p>

            <h2>1. Données collectées</h2>
            <p>Selon l’usage fait de la plateforme, GET traite :</p>
            <ul>
              <li>
                <strong>Identité et contact</strong> : nom, prénom, adresse
                email, numéro de téléphone ;
              </li>
              <li>
                <strong>Données de candidature</strong> : établissement et
                formation visés, résultats de tests, dates d’entretien,
                décisions et historique de statut ;
              </li>
              <li>
                <strong>Pièces justificatives</strong> : pièce d’identité
                (CIN), relevés de notes, diplômes, photo, et tout document
                déposé à l’appui d’une candidature ;
              </li>
              <li>
                <strong>Données de paiement</strong> : montant, méthode,
                statut et référence de transaction — jamais les données
                bancaires ou de carte complètes, traitées directement par
                le prestataire de paiement ;
              </li>
              <li>
                <strong>Données techniques</strong> : jetons de session
                (cookies), historique de connexion, adresse IP à des fins
                de sécurité (limitation du nombre de tentatives de
                connexion).
              </li>
            </ul>

            <h2>2. Finalités du traitement</h2>
            <p>Ces données sont utilisées pour :</p>
            <ul>
              <li>créer et sécuriser le compte utilisateur ;</li>
              <li>
                traiter les candidatures et transmettre les informations
                nécessaires à l’établissement concerné par la candidature
                (jamais à un établissement où l’utilisateur n’a pas
                postulé) ;
              </li>
              <li>traiter les paiements de frais de scolarité ;</li>
              <li>
                envoyer les notifications relatives au compte et aux
                candidatures (email obligatoire pour la sécurité du
                compte ; SMS/notifications push selon les préférences
                choisies dans les paramètres du compte) ;
              </li>
              <li>
                assurer la sécurité de la plateforme (détection de
                tentatives de connexion frauduleuses, journal d’audit des
                actions sensibles).
              </li>
            </ul>

            <h2>3. Protection des données</h2>
            <p>
              Les données les plus sensibles (numéro de téléphone, numéro
              de pièce d’identité, adresse postale) sont chiffrées avant
              d’être enregistrées en base — même un accès direct à la base
              de données ne permet pas de les lire en clair sans la clé de
              chiffrement, gérée séparément. Les mots de passe ne sont
              jamais stockés en clair (hachage à sens unique). Les
              documents déposés (pièces d’identité, diplômes) sont hébergés
              sur un stockage privé : leur accès nécessite une
              authentification et une vérification que le demandeur est
              bien le propriétaire du document, l’établissement où une
              candidature a été déposée, ou un administrateur habilité. Un
              document supprimé par son propriétaire est retiré du
              stockage et son lien d’accès cesse immédiatement de
              fonctionner.
            </p>

            <h2>4. Partage des données</h2>
            <p>
              Les données d’une candidature ne sont partagées qu’avec
              l’établissement auprès duquel elle a été déposée. GET fait
              appel à des prestataires techniques tiers pour certaines
              fonctions (envoi d’emails transactionnels, hébergement des
              documents, traitement des paiements) : ces prestataires
              n’accèdent aux données que dans la stricte mesure nécessaire
              à l’exécution de leur service, et n’ont pas le droit de les
              réutiliser à d’autres fins. GET ne vend ni ne loue aucune
              donnée personnelle à des tiers à des fins commerciales.
            </p>

            <h2>5. Conservation des données</h2>
            <p>
              Les données d’un compte sont conservées tant que le compte
              est actif. Une inscription laissée en attente de
              vérification d’email non finalisée est automatiquement
              purgée après expiration du délai de vérification. En cas de
              suppression de compte, les données d’identification directe
              sont supprimées ou anonymisées, sous réserve des obligations
              légales de conservation (notamment comptables, pour les
              paiements déjà effectués).
            </p>

            <h2>6. Cookies et session</h2>
            <p>
              La connexion repose sur des cookies de session techniques
              (jeton d’accès et de rafraîchissement), indispensables au
              fonctionnement du compte — ils ne servent ni au suivi
              publicitaire ni au profilage. Selon le choix fait à la
              connexion (« se souvenir de moi »), ces cookies restent
              actifs sur la durée normale de la session ou sont effacés à
              la fermeture du navigateur.
            </p>

            <h2>7. Droits de l’utilisateur</h2>
            <p>Chaque utilisateur peut demander, en écrivant à l’adresse ci-dessous :</p>
            <ul>
              <li>l’accès aux données le concernant ;</li>
              <li>la rectification d’une information inexacte ;</li>
              <li>
                la suppression de son compte et des données associées,
                sous réserve des obligations légales de conservation
                mentionnées ci-dessus ;
              </li>
              <li>
                la portabilité de ses données de candidature, dans un
                format exploitable.
              </li>
            </ul>

            <h2>8. Contact</h2>
            <p>
              Pour toute question ou demande relative à cette politique,
              contacter <a href="mailto:contact@get.mg">contact@get.mg</a>.
            </p>

            <hr />
            <p className="text-sm text-[#69738f]">
              Ce document décrit fidèlement le fonctionnement actuel de la
              plateforme GET. Il n’a pas fait l’objet d’une revue par un
              conseil juridique et devra être validé par un professionnel
              du droit avant tout usage en production réelle.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
