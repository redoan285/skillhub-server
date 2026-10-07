export type Role = 'student' | 'instructor' | 'admin';
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface SkillHubUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  bio?: string;
  createdAt?: string;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  preview?: boolean;
  content?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  instructorId: string;
  instructorName: string;
  instructorAvatar: string;
  instructorBio: string;
  category: string;
  price: number;
  level: CourseLevel;
  duration: string;
  rating: number;
  reviewCount: number;
  students: number;
  revenue: number;
  cover: string;
  thumbnail?: string;
  accent: string;
  tags: string[];
  outcomes: string[];
  modules: CourseModule[];
  published: boolean;
  approved: boolean;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
  progress: number;
  completed: boolean;
  completedLessons: string[];
}

export interface CourseReview {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'approval' | 'lesson' | 'enrollment' | 'review' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  count: number;
  icon: string;
}

export interface Certificate {
  id: string;
  studentId: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  instructorName: string;
  issuedAt: string;
}

export interface InstructorStudent {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  progress: number;
  completed: boolean;
  enrolledAt: string;
}

export interface InstructorSummary {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  courses: number;
  students: number;
  rating: number;
}

export interface InstructorAnalyticsPoint {
  month: string;
  learners: number;
}
