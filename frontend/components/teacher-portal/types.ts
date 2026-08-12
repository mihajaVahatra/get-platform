/** Vue principale du portail professeur, pilotée par le paramètre d'URL `?view=`. */
export type View =
  | 'dashboard'
  | 'courses'
  | 'course-detail'
  | 'students'
  | 'evaluations'
  | 'grades'
  | 'schedule'
  | 'availability'
  | 'assignments'
  | 'resources'
  | 'messages'
  | 'announcements'
  | 'settings';

/** Onglet actif dans la vue "Détail d'un cours", piloté par le paramètre d'URL `?tab=`. */
export type CourseTab =
  | 'overview'
  | 'content'
  | 'students'
  | 'evaluations'
  | 'assignments'
  | 'grades'
  | 'attendance'
  | 'settings';

/** Statut de présence d'un étudiant pour une séance (voir POST .../attendance). */
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

/** Ligne du trombinoscope de présence, telle que renvoyée par GET .../attendance. */
export type AttendanceEntry = {
  studentId: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus | null;
};

/** Cours enseigné par le professeur, tel que listé dans la vue "Mes cours". */
export type CourseSummary = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  level: string;
  group?: string | null;
  credits: number;
  room?: string | null;
  schedule?: string | null;
  isPublished: boolean;
  school: { id: string; name: string; slug: string };
  _count: {
    enrollments: number;
    chapters: number;
    evaluations: number;
    assignments: number;
  };
};

/** Établissement dans lequel le professeur intervient. */
export type TeacherSchool = {
  school: { id: string; name: string; slug: string };
};

/** Ressource pédagogique attachée à un chapitre de cours (lien, fichier, etc.). */
export type CourseResource = {
  id: string;
  title: string;
  url: string;
  type: string;
};

/** Ressource enrichie du contexte de son chapitre et de son cours, utilisée dans la vue globale "Ressources". */
export type TeacherResource = CourseResource & {
  createdAt: string;
  chapter: { title: string; course: { id: string; title: string } };
};

/** Chapitre d'un cours ; `isPublished` détermine s'il est visible par les étudiants. */
export type CourseChapter = {
  id: string;
  title: string;
  description?: string | null;
  position: number;
  isPublished: boolean;
  publishedAt?: string | null;
  resources: CourseResource[];
};

/** Détail complet d'un cours (fiche affichée dans la vue "Détail d'un cours"), incluant chapitres, évaluations, devoirs et réglages pédagogiques. */
export type CourseDetailData = Omit<CourseSummary, 'school' | '_count'> & {
  schoolId: string;
  chapters: CourseChapter[];
  evaluations: unknown[];
  assignments: unknown[];
  _count: { enrollments: number };
  welcomeMessage?: string | null;
  allowGroupMessages: boolean;
  notifyOnPublish: boolean;
};

/** Inscription d'un étudiant à un cours, avec ses informations d'identité minimales. */
export type CourseEnrollment = {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    user: { email: string };
  };
};

/** Évaluation programmée pour un cours (contrôle, examen, etc.), avec son coefficient dans le calcul de moyenne. */
export type Evaluation = {
  id: string;
  courseId: string;
  title: string;
  type: string;
  scheduledAt?: string | null;
  coefficient: number;
};

/** Note attribuée à un étudiant pour une évaluation donnée. */
export type EvaluationGrade = {
  id: string;
  studentId: string;
  value: number;
  comment?: string | null;
};

/** Ligne du carnet de notes associant un étudiant à sa note pour l'évaluation sélectionnée (note absente si non encore saisie). */
export type EvaluationGradeEntry = {
  studentId: string;
  student: CourseEnrollment['student'];
  grade: EvaluationGrade | null;
};

/** Annonce envoyée par le professeur aux étudiants d'un cours, avec le suivi de lecture. */
export type TeacherAnnouncement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  recipientCount: number;
  readCount: number;
};

/** Profil du professeur connecté (identité, coordonnées, préférences liées au compte utilisateur). */
export type TeacherProfile = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  user: { email: string; theme?: string };
};

/** Préférence d'apparence de l'application choisie par le professeur. */
export type ThemePreference = 'light' | 'dark' | 'system';

