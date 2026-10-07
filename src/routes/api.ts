import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { Certificate, Category, Course, CourseReview, Enrollment, Notification, Role, SkillHubUser } from '../../shared/types.js';
import { seedCategories, seedCourses, seedUsers } from '../../shared/seed.js';
import { authOptional, authRequired, requireRole, type AuthRequest } from '../middleware/auth.js';
import { mongoConnected } from '../config/database.js';
import { CategoryModel, CertificateModel, CourseModel, EnrollmentModel, NotificationModel, ReviewModel, UserModel, WishlistModel } from '../models/index.js';
import { demoMode, makeId, store, today } from '../services/memoryStore.js';

export const apiRouter = Router();
const roles = ['student', 'instructor', 'admin'] as const;
const courseInput = z.object({
  title: z.string().trim().min(8).max(90),
  description: z.string().trim().min(30).max(1200),
  category: z.string().trim().min(2).max(70),
  price: z.number().min(0).max(50000),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
  duration: z.string().trim().min(2).max(30).default('4h 30m'),
  summary: z.string().trim().max(220).optional(),
  cover: z.string().trim().max(30).optional(),
  accent: z.string().trim().max(20).optional(),
  tags: z.array(z.string().trim().max(30)).max(8).optional(),
  outcomes: z.array(z.string().trim().max(120)).max(8).optional(),
  modules: z.array(z.object({ id: z.string().optional(), title: z.string().trim().min(2).max(90), lessons: z.array(z.object({ id: z.string().optional(), title: z.string().trim().min(2).max(90), duration: z.string().optional(), preview: z.boolean().optional(), content: z.string().optional() })).max(40).default([]) })).max(24).optional(),
  thumbnail: z.string().url().optional(),
});
const reviewInput = z.object({ courseId: z.string().min(3), rating: z.number().int().min(1).max(5), comment: z.string().trim().min(8).max(700) });
const dateToday = () => today();
const currentUser = (req: Request) => (req as AuthRequest).authUser!;
const normalizedRecord = <T,>(record: Record<string, unknown>): T => Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value instanceof Date ? value.toISOString().slice(0, 10) : value])) as T;
const plain = <T,>(value: unknown): T => {
  if (value && typeof value === 'object' && 'toObject' in value && typeof (value as { toObject?: unknown }).toObject === 'function') {
    const { _id, __v, ...rest } = (value as { toObject: () => Record<string, unknown> }).toObject();
    return normalizedRecord<T>(rest);
  }
  if (value && typeof value === 'object' && '_id' in value) {
    const { _id, __v, ...rest } = value as Record<string, unknown>;
    return normalizedRecord<T>(rest);
  }
  return value as T;
};
const findCourse = async (id: string) => mongoConnected ? plain<Course | null>(await CourseModel.findOne({ $or: [{ id }, { slug: id }] }).lean()) : store.courses.find((course) => course.id === id || course.slug === id) ?? null;
const findEnrollment = async (id: string) => mongoConnected ? plain<Enrollment | null>(await EnrollmentModel.findOne({ id }).lean()) : store.enrollments.find((item) => item.id === id) ?? null;
const notify = async (userId: string, type: Notification['type'], title: string, message: string) => {
  const item: Notification = { id: makeId('note'), userId, type, title, message, read: false, createdAt: dateToday() };
  if (mongoConnected) await NotificationModel.create(item); else store.notifications.unshift(item);
};
const allCourses = async (): Promise<Course[]> => mongoConnected ? (await CourseModel.find({}).lean()).map((item) => plain<Course>(item)) : store.courses;
const allEnrollments = async (): Promise<Enrollment[]> => mongoConnected ? (await EnrollmentModel.find({}).lean()).map((item) => plain<Enrollment>(item)) : store.enrollments;
const allReviews = async (): Promise<CourseReview[]> => mongoConnected ? (await ReviewModel.find({}).lean()).map((item) => plain<CourseReview>(item)) : store.reviews;
const hasEnrollment = async (studentId: string, courseId: string) => mongoConnected ? Boolean(await EnrollmentModel.exists({ studentId, courseId })) : store.enrollments.some((item) => item.studentId === studentId && item.courseId === courseId);
const ownsCourse = (user: SkillHubUser | undefined, course: Course) => Boolean(user && user.role === 'instructor' && (course.instructorId === user.id || (demoMode() && user.id === 'demo-instructor' && course.instructorName === user.name)));
const courseForViewer = (course: Course, hasFullAccess: boolean): Course => hasFullAccess ? course : {
  ...course,
  modules: course.modules.map((module) => ({
    ...module,
    lessons: module.lessons.map((lesson) => lesson.preview ? lesson : ({ id: lesson.id, title: lesson.title, duration: lesson.duration, preview: lesson.preview })),
  })),
};

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok', service: 'SkillHub API', database: mongoConnected ? 'mongodb' : 'demo', demoMode: demoMode() }));
apiRouter.post('/auth/demo', (req, res) => {
  if (!demoMode()) return res.status(503).json({ message: 'Demo accounts are disabled when persistent storage is connected.' });
  const parsed = z.object({ role: z.enum(roles) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Choose a valid demo role.' });
  const user = store.users.find((item) => item.id === `demo-${parsed.data.role}`);
  if (!user) return res.status(404).json({ message: 'That seeded demo account is unavailable.' });
  return res.json({ token: `demo:${user.id}`, user, demo: true });
});

apiRouter.get('/categories', async (_req, res) => {
  const source = mongoConnected ? (await CategoryModel.find({}).lean()).map((item) => plain<Category>(item)) : store.categories;
  const courses = (await allCourses()).filter((item) => item.published && item.approved);
  return res.json({ categories: source.map((item) => ({ ...item, count: courses.filter((course) => course.category === item.name).length })) });
});

apiRouter.get('/courses', authOptional, async (req, res) => {
  const user = (req as AuthRequest).authUser;
  const mine = req.query.mine === '1';
  const admin = req.query.admin === '1';
  if (mine && (!user || user.role !== 'instructor')) return res.status(403).json({ message: 'Instructor access is required.' });
  if (admin && (!user || user.role !== 'admin')) return res.status(403).json({ message: 'Admin access is required.' });
  const data = await allCourses();
  const query = String(req.query.q ?? '').trim().toLowerCase();
  const category = String(req.query.category ?? '');
  const level = String(req.query.level ?? '');
  const maxPrice = Number(req.query.maxPrice ?? Number.POSITIVE_INFINITY);
  const minRating = Number(req.query.minRating ?? 0);
  const duration = String(req.query.duration ?? '');
  const sortBy = String(req.query.sort ?? 'popular');
  let filtered = data.filter((course) => {
    if (mine) return course.instructorId === user?.id || (demoMode() && user?.id === 'demo-instructor' && course.instructorName === user.name);
    if (!admin && (!course.published || !course.approved)) return false;
    return true;
  });
  filtered = filtered.filter((course) => {
    const text = `${course.title} ${course.summary} ${course.description} ${course.tags.join(' ')} ${course.instructorName}`.toLowerCase();
    return (!query || text.includes(query)) && (!category || course.category === category) && (!level || course.level === level) && course.price <= maxPrice && course.rating >= minRating && (!duration || (duration === 'short' ? Number.parseFloat(course.duration) < 5 : Number.parseFloat(course.duration) >= 5));
  });
  const sorters: Record<string, (a: Course, b: Course) => number> = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    popular: (a, b) => b.students - a.students,
  };
  filtered.sort(sorters[sortBy] ?? sorters.popular);
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 50)));
  const total = filtered.length;
  const pageCourses = filtered.slice((page - 1) * limit, page * limit);
  const enrolledCourseIds = new Set<string>();
  if (user?.role === 'student') {
    const records = mongoConnected ? await EnrollmentModel.find({ studentId: user.id }).select({ courseId: 1, _id: 0 }).lean() : store.enrollments.filter((item) => item.studentId === user.id);
    for (const item of records) enrolledCourseIds.add(String(item.courseId));
  }
  const courses = pageCourses.map((course) => courseForViewer(course, user?.role === 'admin' || ownsCourse(user, course) || enrolledCourseIds.has(course.id)));
  return res.json({ courses, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});
apiRouter.get('/courses/:id', authOptional, async (req, res) => {
  const course = await findCourse(req.params.id as string);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const user = (req as AuthRequest).authUser;
  if ((!course.published || !course.approved) && user?.role !== 'admin' && user?.id !== course.instructorId) return res.status(404).json({ message: 'Course not found.' });
  const hasFullAccess = user?.role === 'admin' || ownsCourse(user, course) || (user?.role === 'student' && await hasEnrollment(user.id, course.id));
  return res.json({ course: courseForViewer(course, Boolean(hasFullAccess)) });
});
apiRouter.post('/courses', authRequired, requireRole('instructor'), async (req, res) => {
  const parsed = courseInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Check the course details.' });
  const user = currentUser(req);
  const id = makeId('course');
  const slug = parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(-5);
  const course: Course = { id, slug, title: parsed.data.title, summary: parsed.data.summary ?? parsed.data.description.slice(0, 140), description: parsed.data.description, instructorId: user.id, instructorName: user.name, instructorAvatar: user.avatar ?? user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), instructorBio: user.bio ?? '', category: parsed.data.category, price: parsed.data.price, level: parsed.data.level, duration: parsed.data.duration, rating: 0, reviewCount: 0, students: 0, revenue: 0, cover: parsed.data.cover ?? 'fullstack', thumbnail: parsed.data.thumbnail, accent: parsed.data.accent ?? '#d9efab', tags: parsed.data.tags ?? [parsed.data.category], outcomes: parsed.data.outcomes ?? ['Build a practical skill through focused lessons', 'Apply the idea to a real project'], modules: parsed.data.modules?.map((module, i) => ({ id: module.id ?? makeId(`module${i}`), title: module.title, lessons: module.lessons.map((lesson) => ({ ...lesson, id: lesson.id ?? makeId('lesson'), duration: lesson.duration ?? '10 min' })) })) ?? [{ id: makeId('module'), title: 'Start here', lessons: [{ id: makeId('lesson'), title: 'Welcome and course roadmap', duration: '8 min', preview: true }] }], published: false, approved: false, createdAt: dateToday() };
  if (mongoConnected) await CourseModel.create(course); else store.courses.unshift(course);
  return res.status(201).json({ course, message: 'Course saved as a draft for admin review.' });
});
apiRouter.patch('/courses/:id', authRequired, requireRole('instructor', 'admin'), async (req, res) => {
  const parsed = courseInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid course changes.' });
  const user = currentUser(req); const existing = await findCourse(req.params.id as string);
  if (!existing) return res.status(404).json({ message: 'Course not found.' });
  if (user.role !== 'admin' && existing.instructorId !== user.id) return res.status(403).json({ message: 'You can only edit your own courses.' });
  const update = { ...parsed.data, ...(user.role === 'instructor' ? { approved: false, published: false } : {}) };
  if (mongoConnected) await CourseModel.updateOne({ id: existing.id }, { $set: update }); else Object.assign(existing, update);
  return res.json({ course: { ...existing, ...update } });
});
apiRouter.get('/courses/:id/students', authRequired, requireRole('instructor', 'admin'), async (req, res) => {
  const user = currentUser(req); const course = await findCourse(req.params.id as string);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  if (user.role !== 'admin' && course.instructorId !== user.id) return res.status(403).json({ message: 'You can only view learners in your own course.' });
  const enrollments = (await allEnrollments()).filter((enrollment) => enrollment.courseId === course.id);
  const learners = mongoConnected ? (await UserModel.find({ id: { $in: enrollments.map((item) => item.studentId) } }).lean()).map((item) => plain<SkillHubUser>(item)) : store.users;
  const students = enrollments.map((enrollment) => {
    const learner = learners.find((item) => item.id === enrollment.studentId);
    return { id: enrollment.studentId, name: learner?.name ?? 'Learner', email: learner?.email ?? '', avatar: learner?.avatar, progress: enrollment.progress, completed: enrollment.completed, enrolledAt: enrollment.enrolledAt };
  });
  return res.json({ students });
});
async function removeCourse(course: Course) {
  if (mongoConnected) {
    await Promise.all([CourseModel.deleteOne({ id: course.id }), EnrollmentModel.deleteMany({ courseId: course.id }), ReviewModel.deleteMany({ courseId: course.id }), WishlistModel.deleteMany({ courseId: course.id }), CertificateModel.deleteMany({ courseId: course.id })]);
  } else {
    store.courses = store.courses.filter((item) => item.id !== course.id);
    store.enrollments = store.enrollments.filter((item) => item.courseId !== course.id);
    store.reviews = store.reviews.filter((item) => item.courseId !== course.id);
    store.wishlists = store.wishlists.filter((item) => item.courseId !== course.id);
    store.certificates = store.certificates.filter((item) => item.courseId !== course.id);
  }
}
apiRouter.delete('/courses/:id', authRequired, requireRole('instructor', 'admin'), async (req, res) => {
  const user = currentUser(req); const course = await findCourse(req.params.id as string);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  if (user.role !== 'admin' && course.instructorId !== user.id) return res.status(403).json({ message: 'You can only delete your own courses.' });
  await removeCourse(course); return res.json({ message: 'Course and related demo records removed.' });
});
apiRouter.post('/courses/:id/modules', authRequired, requireRole('instructor', 'admin'), async (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(2).max(90) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a module title.' });
  const user = currentUser(req); const course = await findCourse(req.params.id as string);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  if (user.role !== 'admin' && course.instructorId !== user.id) return res.status(403).json({ message: 'You can only edit your own courses.' });
  const module = { id: makeId('module'), title: parsed.data.title, lessons: [] };
  if (mongoConnected) await CourseModel.updateOne({ id: course.id }, { $push: { modules: module }, $set: { approved: false, published: false } });
  else { course.modules.push(module); course.approved = false; course.published = false; }
  return res.status(201).json({ module });
});
apiRouter.post('/courses/:id/modules/:moduleId/lessons', authRequired, requireRole('instructor', 'admin'), async (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(2).max(90), duration: z.string().max(30).optional(), content: z.string().max(5000).optional(), preview: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Check the lesson details.' });
  const user = currentUser(req); const course = await findCourse(req.params.id as string);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  if (user.role !== 'admin' && course.instructorId !== user.id) return res.status(403).json({ message: 'You can only edit your own courses.' });
  const module = course.modules.find((item) => item.id === req.params.moduleId);
  if (!module) return res.status(404).json({ message: 'Module not found.' });
  const lesson = { id: makeId('lesson'), title: parsed.data.title, duration: parsed.data.duration ?? '10 min', preview: parsed.data.preview ?? false, content: parsed.data.content };
  if (mongoConnected) await CourseModel.updateOne({ id: course.id, 'modules.id': module.id }, { $push: { 'modules.$.lessons': lesson }, $set: { approved: false, published: false } });
  else { module.lessons.push(lesson); course.approved = false; course.published = false; }
  const learnerIds = mongoConnected ? (await EnrollmentModel.find({ courseId: course.id }).select('studentId').lean()).map((item) => item.studentId as string) : store.enrollments.filter((item) => item.courseId === course.id).map((item) => item.studentId);
  await Promise.all(learnerIds.map((studentId) => notify(studentId, 'lesson', 'A new lesson is available', `${parsed.data.title} is now in ${course.title}.`)));
  return res.status(201).json({ lesson });
});

apiRouter.post('/auth/profile', authRequired, async (req, res) => {
  const user = currentUser(req);
  const parsed = z.object({ name: z.string().trim().min(2).max(80).optional(), role: z.enum(['student', 'instructor']).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Check your profile details.' });
  const email = user.email.toLowerCase();
  const isAllowlistedAdmin = (process.env.ADMIN_EMAILS ?? '').split(',').map((item) => item.trim().toLowerCase()).includes(email);
  const canChooseInstructorRole = Boolean((req as AuthRequest).newFirebaseUser && parsed.data.role === 'instructor');
  const updated = { ...user, ...(parsed.data.name ? { name: parsed.data.name } : {}), email, ...(isAllowlistedAdmin ? { role: 'admin' as const } : canChooseInstructorRole ? { role: 'instructor' as const } : {}) };
  if (mongoConnected) await UserModel.updateOne({ id: user.id }, { $set: updated }, { upsert: true }); else {
    const index = store.users.findIndex((item) => item.id === user.id);
    if (index >= 0) store.users[index] = updated; else store.users.push(updated);
  }
  (req as AuthRequest).authUser = updated;
  return res.json({ user: updated });
});
apiRouter.get('/auth/profile', authRequired, (req, res) => res.json({ user: currentUser(req) }));
apiRouter.patch('/profile', authRequired, async (req, res) => {
  const user = currentUser(req); const parsed = z.object({ name: z.string().trim().min(2).max(80).optional(), bio: z.string().max(280).optional(), avatar: z.string().url().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Check your profile changes.' });
  const updated = { ...user, ...parsed.data };
  if (mongoConnected) await UserModel.updateOne({ id: user.id }, { $set: parsed.data }); else Object.assign(user, parsed.data);
  return res.json({ user: updated });
});
apiRouter.get('/instructors', async (_req, res) => {
  const courses = await allCourses();
  const grouped = new Map<string, { id: string; name: string; avatar: string; bio: string; courses: number; students: number; ratingTotal: number; ratingCount: number }>();
  for (const course of courses.filter((item) => item.published && item.approved)) {
    const instructor = grouped.get(course.instructorId) ?? { id: course.instructorId, name: course.instructorName, avatar: course.instructorAvatar, bio: course.instructorBio, courses: 0, students: 0, ratingTotal: 0, ratingCount: 0 };
    instructor.courses += 1; instructor.students += course.students; instructor.ratingTotal += course.rating; instructor.ratingCount += 1; grouped.set(course.instructorId, instructor);
  }
  return res.json({ instructors: [...grouped.values()].map((item) => ({ ...item, rating: item.ratingCount ? Number((item.ratingTotal / item.ratingCount).toFixed(1)) : 0 })) });
});

apiRouter.post('/enrollments', authRequired, requireRole('student'), async (req, res) => {
  const parsed = z.object({ courseId: z.string().min(2) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Choose a course to enroll in.' });
  const user = currentUser(req); const course = await findCourse(parsed.data.courseId);
  if (!course || !course.published || !course.approved) return res.status(404).json({ message: 'This course is not available to enroll in.' });
  if (await hasEnrollment(user.id, course.id)) return res.status(409).json({ message: 'You’re already enrolled in this course.' });
  const enrollment: Enrollment = { id: makeId('enrol'), studentId: user.id, courseId: course.id, enrolledAt: dateToday(), progress: 0, completed: false, completedLessons: [] };
  if (mongoConnected) {
    await EnrollmentModel.create(enrollment);
    await CourseModel.updateOne({ id: course.id }, { $inc: { students: 1 } });
  } else { store.enrollments.unshift(enrollment); course.students += 1; course.revenue += course.price; }
  await notify(user.id, 'enrollment', 'You’re enrolled', `${course.title} is ready when you are.`);
  await notify(course.instructorId, 'enrollment', 'A learner joined your class', `${user.name} enrolled in ${course.title}.`);
  return res.status(201).json({ enrollment });
});
apiRouter.get('/enrollments/my-courses', authRequired, requireRole('student'), async (req, res) => {
  const user = currentUser(req); const enrollments = (await allEnrollments()).filter((item) => item.studentId === user.id).sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
  const courses = await allCourses();
  return res.json({ enrollments: enrollments.map((enrollment) => ({ enrollment, course: courses.find((course) => course.id === enrollment.courseId) })) });
});
apiRouter.get('/enrollments/:courseId', authRequired, requireRole('student'), async (req, res) => {
  const user = currentUser(req);
  const enrollment = mongoConnected ? plain<Enrollment | null>(await EnrollmentModel.findOne({ studentId: user.id, courseId: req.params.courseId }).lean()) : store.enrollments.find((item) => item.studentId === user.id && item.courseId === req.params.courseId) ?? null;
  if (!enrollment) return res.status(404).json({ message: 'You are not enrolled in this course.' });
  return res.json({ enrollment });
});
apiRouter.patch('/enrollments/:id/progress', authRequired, requireRole('student'), async (req, res) => {
  const parsed = z.object({ lessonId: z.string().min(2) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Choose a lesson to mark complete.' });
  const user = currentUser(req); const enrollment = await findEnrollment(req.params.id as string);
  if (!enrollment || enrollment.studentId !== user.id) return res.status(404).json({ message: 'Enrollment not found.' });
  const course = await findCourse(enrollment.courseId);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const allLessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  if (!allLessonIds.includes(parsed.data.lessonId)) return res.status(400).json({ message: 'That lesson does not belong to this course.' });
  const completedLessons = [...new Set([...enrollment.completedLessons, parsed.data.lessonId])];
  const progress = allLessonIds.length ? Math.round(completedLessons.length / allLessonIds.length * 100) : 100;
  const completed = progress >= 100;
  const updated = { ...enrollment, completedLessons, progress, completed };
  if (mongoConnected) await EnrollmentModel.updateOne({ id: enrollment.id, studentId: user.id }, { $set: { completedLessons, progress, completed } }); else Object.assign(enrollment, updated);
  let issuedCertificate: Certificate | undefined;
  if (completed) {
    const certificateId = `SH-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const existing = mongoConnected ? await CertificateModel.findOne({ studentId: user.id, courseId: course.id }).lean() : store.certificates.find((item) => item.studentId === user.id && item.courseId === course.id);
    if (existing) issuedCertificate = plain<Certificate>(existing);
    else {
      const certificate = { id: certificateId, studentId: user.id, courseId: course.id, courseTitle: course.title, studentName: user.name, instructorName: course.instructorName, issuedAt: dateToday() };
      if (mongoConnected) await CertificateModel.create(certificate); else store.certificates.push(certificate);
      issuedCertificate = certificate;
      await notify(user.id, 'system', 'You finished a learning path', `Your SkillHub certificate for ${course.title} is ready.`);
    }
  }
  return res.json({ enrollment: updated, completed, certificate: issuedCertificate });
});

apiRouter.get('/reviews/course/:courseId', async (req, res) => {
  const reviews = (await allReviews()).filter((item) => item.courseId === req.params.courseId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ reviews });
});
async function refreshRating(courseId: string) {
  const reviews = (await allReviews()).filter((item) => item.courseId === courseId);
  const rating = reviews.length ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1)) : 0;
  if (mongoConnected) await CourseModel.updateOne({ id: courseId }, { $set: { rating, reviewCount: reviews.length } });
  else { const course = store.courses.find((item) => item.id === courseId); if (course) { course.rating = rating; course.reviewCount = reviews.length; } }
}
apiRouter.post('/reviews', authRequired, requireRole('student'), async (req, res) => {
  const parsed = reviewInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Check your rating and review.' });
  const user = currentUser(req); const course = await findCourse(parsed.data.courseId);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  if (!await hasEnrollment(user.id, course.id)) return res.status(403).json({ message: 'Enroll in this course before leaving a review.' });
  const existing = mongoConnected ? plain<CourseReview | null>(await ReviewModel.findOne({ userId: user.id, courseId: course.id }).lean()) : store.reviews.find((item) => item.userId === user.id && item.courseId === course.id) ?? null;
  const review: CourseReview = { id: existing?.id ?? makeId('review'), userId: user.id, userName: user.name, courseId: course.id, rating: parsed.data.rating, comment: parsed.data.comment, createdAt: dateToday() };
  if (mongoConnected) await ReviewModel.updateOne({ userId: user.id, courseId: course.id }, { $set: review }, { upsert: true });
  else if (existing) Object.assign(existing, review); else store.reviews.unshift(review);
  await refreshRating(course.id);
  await notify(course.instructorId, 'review', 'A learner shared a review', `${user.name} left feedback on ${course.title}.`);
  return res.status(existing ? 200 : 201).json({ review });
});
apiRouter.patch('/reviews/:id', authRequired, async (req, res) => {
  const user = currentUser(req); const parsed = z.object({ rating: z.number().int().min(1).max(5).optional(), comment: z.string().trim().min(8).max(700).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Check your review changes.' });
  const review = mongoConnected ? plain<CourseReview | null>(await ReviewModel.findOne({ id: req.params.id }).lean()) : store.reviews.find((item) => item.id === req.params.id) ?? null;
  if (!review) return res.status(404).json({ message: 'Review not found.' });
  if (user.role !== 'admin' && review.userId !== user.id) return res.status(403).json({ message: 'You can only edit your own review.' });
  const updated = { ...review, ...parsed.data, createdAt: dateToday() };
  if (mongoConnected) await ReviewModel.updateOne({ id: review.id }, { $set: parsed.data }); else Object.assign(review, updated);
  await refreshRating(review.courseId); return res.json({ review: updated });
});
apiRouter.delete('/reviews/:id', authRequired, async (req, res) => {
  const user = currentUser(req); const review = mongoConnected ? plain<CourseReview | null>(await ReviewModel.findOne({ id: req.params.id }).lean()) : store.reviews.find((item) => item.id === req.params.id) ?? null;
  if (!review) return res.status(404).json({ message: 'Review not found.' });
  if (user.role !== 'admin' && review.userId !== user.id) return res.status(403).json({ message: 'You can only delete your own review.' });
  if (mongoConnected) await ReviewModel.deleteOne({ id: review.id }); else store.reviews = store.reviews.filter((item) => item.id !== review.id);
  await refreshRating(review.courseId); return res.json({ message: 'Review removed.' });
});

apiRouter.get('/wishlist', authRequired, requireRole('student'), async (req, res) => {
  const user = currentUser(req); const courseIds = mongoConnected ? (await WishlistModel.find({ userId: user.id }).lean()).map((item) => item.courseId as string) : store.wishlists.filter((item) => item.userId === user.id).map((item) => item.courseId);
  return res.json({ courseIds });
});
apiRouter.post('/wishlist', authRequired, requireRole('student'), async (req, res) => {
  const parsed = z.object({ courseId: z.string().min(2) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Choose a course to save.' });
  const user = currentUser(req); const course = await findCourse(parsed.data.courseId);
  if (!course || !course.published || !course.approved) return res.status(404).json({ message: 'Course not found.' });
  if (mongoConnected) {
    const existing = await WishlistModel.findOne({ userId: user.id, courseId: course.id }).lean();
    if (existing) await WishlistModel.deleteOne({ userId: user.id, courseId: course.id }); else await WishlistModel.create({ id: makeId('wish'), userId: user.id, courseId: course.id });
  } else {
    const index = store.wishlists.findIndex((item) => item.userId === user.id && item.courseId === course.id);
    if (index >= 0) store.wishlists.splice(index, 1); else store.wishlists.push({ id: makeId('wish'), userId: user.id, courseId: course.id });
  }
  const courseIds = mongoConnected ? (await WishlistModel.find({ userId: user.id }).lean()).map((item) => item.courseId as string) : store.wishlists.filter((item) => item.userId === user.id).map((item) => item.courseId);
  return res.json({ courseIds });
});

apiRouter.get('/notifications', authRequired, async (req, res) => {
  const user = currentUser(req); const notifications = mongoConnected ? (await NotificationModel.find({ userId: user.id }).sort({ createdAt: -1 }).lean()).map((item) => plain<Notification>(item)) : store.notifications.filter((item) => item.userId === user.id);
  return res.json({ notifications });
});
apiRouter.patch('/notifications/:id/read', authRequired, async (req, res) => {
  const user = currentUser(req);
  if (mongoConnected) { const result = await NotificationModel.updateOne({ id: req.params.id, userId: user.id }, { $set: { read: true } }); if (!result.matchedCount) return res.status(404).json({ message: 'Notification not found.' }); }
  else { const note = store.notifications.find((item) => item.id === req.params.id && item.userId === user.id); if (!note) return res.status(404).json({ message: 'Notification not found.' }); note.read = true; }
  return res.json({ message: 'Notification marked as read.' });
});

apiRouter.get('/certificates', authRequired, requireRole('student', 'admin'), async (req, res) => {
  const user = currentUser(req); const certificates = mongoConnected ? (await CertificateModel.find(user.role === 'admin' ? {} : { studentId: user.id }).lean()).map((item) => plain(item)) : store.certificates.filter((item) => user.role === 'admin' || item.studentId === user.id);
  return res.json({ certificates });
});
apiRouter.get('/certificates/:id', authRequired, async (req, res) => {
  const user = currentUser(req); const certificate = mongoConnected ? plain<{ id: string; studentId: string } | null>(await CertificateModel.findOne({ id: req.params.id }).lean()) : store.certificates.find((item) => item.id === req.params.id) ?? null;
  if (!certificate) return res.status(404).json({ message: 'Certificate not found.' });
  if (user.role !== 'admin' && certificate.studentId !== user.id) return res.status(403).json({ message: 'This certificate belongs to another learner.' });
  return res.json({ certificate });
});

apiRouter.get('/dashboard', authRequired, async (req, res) => {
  const user = currentUser(req); const courses = await allCourses(); const enrollments = await allEnrollments(); const reviews = await allReviews();
  if (user.role === 'student') {
    const own = enrollments.filter((item) => item.studentId === user.id); const wishlist = mongoConnected ? await WishlistModel.countDocuments({ userId: user.id }) : store.wishlists.filter((item) => item.userId === user.id).length;
    return res.json({ user, stats: { courses: own.length, completed: own.filter((item) => item.completed).length, inProgress: own.filter((item) => !item.completed).length, wishlist }, recent: own.slice(0, 5) });
  }
  if (user.role === 'instructor') {
    const ownCourses = courses.filter((item) => item.instructorId === user.id || (demoMode() && user.id === 'demo-instructor' && item.instructorName === user.name));
    const ownCourseIds = new Set(ownCourses.map((course) => course.id)); const ownEnrollments = enrollments.filter((item) => ownCourseIds.has(item.courseId));
    const uniqueStudents = new Set(ownEnrollments.map((item) => item.studentId)).size; const revenue = ownCourses.reduce((sum, item) => sum + item.revenue, 0); const reviewAverage = ownCourses.length ? ownCourses.reduce((sum, item) => sum + item.rating, 0) / ownCourses.length : 0;
    const now = new Date(); const analytics = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
      const key = monthDate.toISOString().slice(0, 7);
      return { month: monthDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), learners: ownEnrollments.filter((item) => item.enrolledAt.slice(0, 7) === key).length };
    });
    return res.json({ user, stats: { courses: ownCourses.length, students: uniqueStudents, revenue, averageRating: Number(reviewAverage.toFixed(1)), reviews: reviews.filter((item) => ownCourseIds.has(item.courseId)).length }, recent: ownCourses, analytics });
  }
  const users = mongoConnected ? await UserModel.countDocuments({}) : store.users.length;
  return res.json({ user, stats: { users, courses: courses.length, instructors: mongoConnected ? await UserModel.countDocuments({ role: 'instructor' }) : store.users.filter((item) => item.role === 'instructor').length, enrollments: enrollments.length, revenue: courses.reduce((sum, item) => sum + item.revenue, 0) }, recent: courses.slice(0, 5) });
});

apiRouter.get('/admin/overview', authRequired, requireRole('admin'), async (_req, res) => {
  const courses = await allCourses(); const enrollments = await allEnrollments();
  const users = mongoConnected ? await UserModel.countDocuments({}) : store.users.length;
  const instructors = mongoConnected ? await UserModel.countDocuments({ role: 'instructor' }) : store.users.filter((item) => item.role === 'instructor').length;
  return res.json({ stats: { users, courses: courses.length, instructors, enrollments: enrollments.length, revenue: courses.reduce((sum, item) => sum + item.revenue, 0) } });
});
apiRouter.get('/admin/users', authRequired, requireRole('admin'), async (_req, res) => {
  const users = mongoConnected ? (await UserModel.find({}).lean()).map((item) => plain<SkillHubUser>(item)) : store.users;
  return res.json({ users });
});
apiRouter.patch('/admin/users/:id/role', authRequired, requireRole('admin'), async (req, res) => {
  const parsed = z.object({ role: z.enum(['student', 'instructor']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Admin privilege is managed outside this control.' });
  const user = currentUser(req);
  if (user.id === req.params.id) return res.status(400).json({ message: 'You cannot change your own access here.' });
  if (mongoConnected) { const result = await UserModel.updateOne({ id: req.params.id, role: { $ne: 'admin' } }, { $set: { role: parsed.data.role } }); if (!result.matchedCount) return res.status(404).json({ message: 'User not found or protected.' }); }
  else { const target = store.users.find((item) => item.id === req.params.id); if (!target || target.role === 'admin') return res.status(404).json({ message: 'User not found or protected.' }); target.role = parsed.data.role; }
  return res.json({ message: 'User role updated.' });
});
apiRouter.delete('/admin/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  const user = currentUser(req);
  if (user.id === req.params.id) return res.status(400).json({ message: 'An admin cannot remove their own account.' });
  if (mongoConnected) {
    const target = await UserModel.findOne({ id: req.params.id }).lean(); if (!target || target.role === 'admin') return res.status(404).json({ message: 'User not found or protected.' });
    const authored = await CourseModel.find({ instructorId: req.params.id }).lean(); for (const item of authored) await removeCourse(plain<Course>(item));
    await UserModel.deleteOne({ id: req.params.id });
    await Promise.all([EnrollmentModel.deleteMany({ studentId: req.params.id }), ReviewModel.deleteMany({ userId: req.params.id }), WishlistModel.deleteMany({ userId: req.params.id }), CertificateModel.deleteMany({ studentId: req.params.id }), NotificationModel.deleteMany({ userId: req.params.id })]);
  } else {
    const target = store.users.find((item) => item.id === req.params.id); if (!target || target.role === 'admin') return res.status(404).json({ message: 'User not found or protected.' });
    for (const course of store.courses.filter((item) => item.instructorId === target.id)) await removeCourse(course);
    store.users = store.users.filter((item) => item.id !== req.params.id); store.enrollments = store.enrollments.filter((item) => item.studentId !== req.params.id); store.reviews = store.reviews.filter((item) => item.userId !== req.params.id); store.wishlists = store.wishlists.filter((item) => item.userId !== req.params.id); store.certificates = store.certificates.filter((item) => item.studentId !== req.params.id); store.notifications = store.notifications.filter((item) => item.userId !== req.params.id);
  }
  return res.json({ message: 'User removed.' });
});
apiRouter.get('/admin/notifications', authRequired, requireRole('admin'), async (_req, res) => {
  const notifications = mongoConnected ? (await NotificationModel.find({}).sort({ createdAt: -1 }).limit(200).lean()).map((item) => plain<Notification>(item)) : store.notifications.slice(0, 200);
  return res.json({ notifications });
});
apiRouter.post('/admin/notifications', authRequired, requireRole('admin'), async (req, res) => {
  const parsed = z.object({ recipientId: z.string().min(1).max(200), title: z.string().trim().min(3).max(120), message: z.string().trim().min(8).max(700) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Choose a recipient and enter a 3–120 character title and an 8–700 character message.' });
  const recipients = mongoConnected ? (parsed.data.recipientId === 'all' ? (await UserModel.find({}).select({ id: 1, _id: 0 }).lean()).map((item) => String(item.id)) : (await UserModel.find({ id: parsed.data.recipientId }).select({ id: 1, _id: 0 }).lean()).map((item) => String(item.id))) : store.users.filter((item) => parsed.data.recipientId === 'all' || item.id === parsed.data.recipientId).map((item) => item.id);
  if (!recipients.length) return res.status(404).json({ message: 'Recipient not found.' });
  const notifications: Notification[] = recipients.map((userId) => ({ id: makeId('note'), userId, type: 'system', title: parsed.data.title, message: parsed.data.message, read: false, createdAt: dateToday() }));
  if (mongoConnected) await NotificationModel.insertMany(notifications); else store.notifications.unshift(...notifications);
  return res.status(201).json({ count: notifications.length, message: 'Notification delivered.' });
});
apiRouter.delete('/admin/notifications/:id', authRequired, requireRole('admin'), async (req, res) => {
  if (mongoConnected) { const result = await NotificationModel.deleteOne({ id: req.params.id }); if (!result.deletedCount) return res.status(404).json({ message: 'Notification not found.' }); }
  else { const index = store.notifications.findIndex((item) => item.id === req.params.id); if (index < 0) return res.status(404).json({ message: 'Notification not found.' }); store.notifications.splice(index, 1); }
  return res.json({ message: 'Notification removed.' });
});
apiRouter.get('/admin/courses', authRequired, requireRole('admin'), async (_req, res) => res.json({ courses: await allCourses() }));
apiRouter.patch('/admin/courses/:id/approve', authRequired, requireRole('admin'), async (req, res) => {
  const course = await findCourse(req.params.id as string); if (!course) return res.status(404).json({ message: 'Course not found.' });
  if (mongoConnected) await CourseModel.updateOne({ id: course.id }, { $set: { approved: true, published: true } }); else { course.approved = true; course.published = true; }
  await notify(course.instructorId, 'approval', 'Your course is approved', `${course.title} is now ready for learners.`);
  return res.json({ course: { ...course, approved: true, published: true } });
});
apiRouter.delete('/admin/courses/:id', authRequired, requireRole('admin'), async (req, res) => {
  const course = await findCourse(req.params.id as string); if (!course) return res.status(404).json({ message: 'Course not found.' }); await removeCourse(course); return res.json({ message: 'Course and related learning records removed.' });
});
apiRouter.get('/admin/categories', authRequired, requireRole('admin'), async (_req, res) => res.json({ categories: mongoConnected ? (await CategoryModel.find({}).lean()).map((item) => plain<Category>(item)) : store.categories }));
apiRouter.post('/admin/categories', authRequired, requireRole('admin'), async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(70), icon: z.string().max(8).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a category name.' });
  const category: Category = { id: makeId('cat'), name: parsed.data.name, count: 0, icon: parsed.data.icon ?? '✳' };
  if (mongoConnected) await CategoryModel.create(category); else { if (store.categories.some((item) => item.name.toLowerCase() === category.name.toLowerCase())) return res.status(409).json({ message: 'That category already exists.' }); store.categories.push(category); }
  return res.status(201).json({ category });
});
apiRouter.delete('/admin/categories/:id', authRequired, requireRole('admin'), async (req, res) => {
  if (mongoConnected) { const category = await CategoryModel.findOne({ id: req.params.id }).lean(); if (!category) return res.status(404).json({ message: 'Category not found.' }); if (await CourseModel.exists({ category: category.name })) return res.status(409).json({ message: 'Move courses out of this category before removing it.' }); await CategoryModel.deleteOne({ id: req.params.id }); }
  else { const category = store.categories.find((item) => item.id === req.params.id); if (!category) return res.status(404).json({ message: 'Category not found.' }); if (store.courses.some((course) => course.category === category.name)) return res.status(409).json({ message: 'Move courses out of this category before removing it.' }); store.categories = store.categories.filter((item) => item.id !== req.params.id); }
  return res.json({ message: 'Category removed.' });
});
apiRouter.get('/admin/reviews', authRequired, requireRole('admin'), async (_req, res) => res.json({ reviews: await allReviews() }));
apiRouter.get('/admin/reports', authRequired, requireRole('admin'), async (_req, res) => {
  const [courses, enrollments, reviews] = await Promise.all([allCourses(), allEnrollments(), allReviews()]);
  return res.json({ reports: { enrollments: enrollments.length, reviews: reviews.length, coursesAwaitingReview: courses.filter((item) => !item.approved).length, totalValue: courses.reduce((sum, item) => sum + item.revenue, 0), coursePerformance: courses.map(({ id, title, students, rating, revenue }) => ({ id, title, students, rating, revenue })) } });
});

apiRouter.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SkillHub API]', error);
  if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) return res.status(409).json({ message: 'That record already exists.' });
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
});
