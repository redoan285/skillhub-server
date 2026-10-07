import { seedCategories, seedCourses, seedEnrollments, seedNotifications, seedReviews, seedUsers } from '../../shared/seed.js';
import type { Category, Course, CourseReview, Enrollment, Notification, SkillHubUser } from '../../shared/types.js';
import { mongoConnected } from '../config/database.js';

export const demoMode = () => process.env.DEMO_MODE !== 'false' && !mongoConnected;
export const store: {
  users: SkillHubUser[];
  courses: Course[];
  enrollments: Enrollment[];
  reviews: CourseReview[];
  categories: Category[];
  notifications: Notification[];
  wishlists: { id: string; userId: string; courseId: string }[];
  certificates: { id: string; studentId: string; courseId: string; courseTitle: string; studentName: string; instructorName: string; issuedAt: string }[];
} = {
  users: structuredClone(seedUsers),
  courses: structuredClone(seedCourses).map((course) => ({ ...course, instructorId: course.instructorName === 'Nadia Rahman' ? 'demo-instructor' : course.instructorId })),
  enrollments: structuredClone(seedEnrollments),
  reviews: structuredClone(seedReviews),
  categories: structuredClone(seedCategories),
  notifications: structuredClone(seedNotifications),
  wishlists: [{ id: 'wish-design', userId: 'demo-student', courseId: 'course-design' }, { id: 'wish-fullstack', userId: 'demo-student', courseId: 'course-fullstack' }],
  certificates: [],
};
export const today = () => new Date().toISOString().slice(0, 10);
export const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
