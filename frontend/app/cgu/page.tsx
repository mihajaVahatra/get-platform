import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { CURRENT_TERMS_VERSION } from '@/lib/terms-version';

export const metadata = {
  title: 'Conditions d’utilisation — GET',
  description:
    'Conditions générales d’utilisation de la plateforme GET (Grandes Écoles de Tananarive).',
};

export default function TermsOfServicePage() {
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
            Conditions générales d’utilisation
          </h1>
          <p className="mt-2 text-sm text-[#69738f]">
            Version du {CURRENT_TERMS_VERSION} — dernière mise à jour.
          </p>

          <div className="mt-8 text-[15px] leading-7 text-[#33395c] [&>h2]:mt-8 [&>h2]:text-xl [&>h2]:font-extrabold [&>h2]:text-[#101643] [&>hr]:my-8 [&>hr]:border-slate-200 [&>li]:mt-1.5 [&>p]:mt-3 [&>ul]:mt-3 [&>ul]:list-disc [&>ul]:space-y-1.5 [&>ul]:pl-6 [&_a]:font-medium [&_a]:text-indigo-600 [&_a]:hover:underline [&_strong]:font-bold [&_strong]:text-[#101643]">
            <p>
              Les présentes conditions générales d’utilisation (« CGU »)
              régissent l’accès et l’utilisation de la plateforme GET
              (Grandes Écoles de Tananarive), un service en ligne permettant
              aux candidats de postuler à des formations post-bac, de
              suivre leurs candidatures, de s’inscrire et de régler leurs
              frais de scolarité auprès des établissements partenaires.
              L’utilisation de la plateforme implique l’acceptation pleine
              et entière des présentes CGU.
            </p>

            <h2>1. Objet du service</h2>
            <p>
              GET met en relation les candidats à l’enseignement supérieur
              et les établissements partenaires (écoles, instituts,
              universités) pour la publication d’offres de formation, le
              dépôt et le suivi de candidatures, la planification de tests
              et d’entretiens, l’inscription administrative et le paiement
              des frais de scolarité. GET n’est pas un établissement
              d’enseignement et ne délivre aucun diplôme ; chaque décision
              d’admission relève exclusivement de l’établissement
              concerné.
            </p>

            <h2>2. Création de compte</h2>
            <p>
              La création d’un compte candidat nécessite une adresse email
              valide, vérifiée par un lien ou un code envoyé à cette
              adresse avant toute activation. L’utilisateur s’engage à
              fournir des informations exactes, complètes et à jour
              (identité, coordonnées, pièces justificatives), et à ne créer
              qu’un seul compte par personne. Un compte est strictement
              personnel : le partage des identifiants de connexion est
              interdit. Toute action effectuée depuis un compte est
              présumée effectuée par son titulaire.
            </p>

            <h2>3. Obligations de l’utilisateur</h2>
            <p>L’utilisateur s’engage à :</p>
            <ul>
              <li>
                ne transmettre que des documents et informations
                authentiques (pièce d’identité, relevés de notes, diplômes)
                — toute falsification peut entraîner l’annulation de la
                candidature ou de l’inscription concernée, sans préjudice
                d’éventuelles poursuites ;
              </li>
              <li>
                ne pas tenter de contourner les mesures de sécurité de la
                plateforme, d’accéder à des données ne lui appartenant pas,
                ou de perturber son fonctionnement ;
              </li>
              <li>
                utiliser la plateforme conformément à sa destination
                (candidature, suivi, inscription, paiement) et à la
                réglementation en vigueur.
              </li>
            </ul>

            <h2>4. Candidatures et décisions d’admission</h2>
            <p>
              Le dépôt d’une candidature ne garantit ni son examen dans un
              délai déterminé ni une réponse favorable. Chaque
              établissement partenaire reste seul décisionnaire de
              l’acceptation, du rejet, ou de la mise en liste d’attente
              d’une candidature, selon ses propres critères. GET assure la
              mise à disposition technique du service et la traçabilité du
              processus (historique de statut), sans intervenir dans les
              décisions d’admission elles-mêmes.
            </p>

            <h2>5. Paiement des frais de scolarité</h2>
            <p>
              Les frais affichés pour chaque offre de formation sont fixés
              par l’établissement partenaire et non par GET. Le paiement
              n’est ouvert qu’après acceptation de la candidature. Les
              moyens de paiement proposés (mobile money, carte bancaire,
              virement selon disponibilité) sont opérés par des
              prestataires de paiement tiers ; GET ne stocke jamais les
              données bancaires ou de paiement complètes. Un reçu est mis
              à disposition après confirmation du paiement.
            </p>

            <h2>6. Disponibilité du service</h2>
            <p>
              GET met en œuvre des moyens raisonnables pour assurer la
              disponibilité et la sécurité de la plateforme, sans garantie
              d’absence totale d’interruption (maintenance, incident
              technique, cas de force majeure). En cas d’indisponibilité
              affectant un délai de candidature, contacter l’administrateur
              de la plateforme dans les meilleurs délais.
            </p>

            <h2>7. Responsabilité</h2>
            <p>
              GET agit en tant qu’intermédiaire technique entre candidats
              et établissements. Sa responsabilité ne saurait être engagée
              pour les décisions d’admission, le contenu des offres de
              formation publiées par les établissements, ou l’usage fait
              par un tiers d’informations que l’utilisateur aurait
              lui-même rendues publiques ou partagées en dehors de la
              plateforme.
            </p>

            <h2>8. Suspension et suppression de compte</h2>
            <p>
              GET se réserve le droit de suspendre ou de supprimer un
              compte en cas de manquement grave aux présentes CGU (fraude,
              usurpation d’identité, tentative d’intrusion). L’utilisateur
              peut à tout moment demander la suppression de son compte
              auprès de l’administrateur — voir la Politique de
              confidentialité pour le détail des données conservées après
              suppression.
            </p>

            <h2>9. Modification des CGU</h2>
            <p>
              Les présentes CGU peuvent être modifiées pour refléter une
              évolution du service ou de la réglementation applicable. Toute
              modification substantielle fait l’objet d’une nouvelle
              version, datée, et d’une nouvelle acceptation explicite lors
              de la prochaine inscription ou reconnexion nécessitant cette
              validation.
            </p>

            <h2>10. Droit applicable</h2>
            <p>
              Les présentes CGU sont soumises au droit malgache. Tout
              litige relatif à leur interprétation ou à leur exécution
              relève, à défaut de résolution amiable, des juridictions
              compétentes de Madagascar.
            </p>

            <h2>11. Contact</h2>
            <p>
              Pour toute question relative aux présentes CGU, contacter{' '}
              <a href="mailto:contact@get.mg">contact@get.mg</a>.
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
