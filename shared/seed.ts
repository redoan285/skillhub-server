import type { Category, Course, CourseReview, Enrollment, Notification, SkillHubUser } from './types.js';

const moduleFor = (prefix: string, title: string, lessons: string[]) => ({
  id: `${prefix}-module-1`,
  title,
  lessons: lessons.map((name, i) => ({ id: `${prefix}-lesson-${i + 1}`, title: name, duration: `${8 + i * 4} min`, preview: i === 0 })),
});

export const seedCourses: Course[] = [
  {
    id: 'course-react', slug: 'modern-react', title: 'Modern React: From Components to Apps',
    summary: 'Build confident React skills by shipping a real product interface.',
    description: 'Go from reusable components to a polished, data-driven application. Learn the mental models behind React while building real features with state, routing, forms and a clean component system.',
    instructorId: 'user-nadia', instructorName: 'Nadia Rahman', instructorAvatar: 'NR', instructorBio: 'Product engineer who helps teams turn complex ideas into clear, useful software.',
    category: 'Web Development', price: 1490, level: 'Intermediate', duration: '8h 20m', rating: 4.9, reviewCount: 328, students: 2840, revenue: 127600,
    cover: 'react', accent: '#7edfd3', tags: ['React', 'Frontend', 'Projects'], outcomes: ['Compose reusable components with confidence', 'Manage application state and forms', 'Ship a responsive project with routing'],
    modules: [moduleFor('react', 'A modern React mindset', ['Components that communicate', 'State without surprises', 'Project setup and structure']), { id: 'react-module-2', title: 'Build a real interface', lessons: [{ id: 'react-lesson-4', title: 'Designing reusable UI', duration: '18 min' }, { id: 'react-lesson-5', title: 'Data, filters and interactions', duration: '24 min' }] }],
    published: true, approved: true, createdAt: '2026-09-18',
  },
  {
    id: 'course-ts', slug: 'typescript-foundations', title: 'TypeScript Foundations for App Builders',
    summary: 'Make your JavaScript safer, clearer and easier to grow.',
    description: 'A practical path into TypeScript focused on the patterns you will use in modern applications: inference, unions, interfaces, generics, API data and safe refactors.',
    instructorId: 'user-imran', instructorName: 'Imran Hossain', instructorAvatar: 'IH', instructorBio: 'Full-stack developer and mentor focused on thoughtful TypeScript systems.',
    category: 'Web Development', price: 1190, level: 'Beginner', duration: '6h 45m', rating: 4.8, reviewCount: 214, students: 1970, revenue: 92300,
    cover: 'typescript', accent: '#8cb8ff', tags: ['TypeScript', 'JavaScript', 'Backend'], outcomes: ['Model application data with types', 'Use unions and generics in everyday code', 'Integrate typed APIs into a project'],
    modules: [moduleFor('ts', 'Types that tell a story', ['Type inference in practice', 'Objects and interfaces', 'Union types and narrowing'])],
    published: true, approved: true, createdAt: '2026-09-10',
  },
  {
    id: 'course-node', slug: 'node-express-api', title: 'Node.js APIs with Express',
    summary: 'Design dependable REST APIs and connect them to a database.',
    description: 'Build a production-minded API with Node, Express, request validation, authorization, useful error handling and a MongoDB data model. You will leave with an API you can extend.',
    instructorId: 'user-nadia', instructorName: 'Nadia Rahman', instructorAvatar: 'NR', instructorBio: 'Product engineer who helps teams turn complex ideas into clear, useful software.',
    category: 'Backend Development', price: 1690, level: 'Intermediate', duration: '10h 10m', rating: 4.9, reviewCount: 186, students: 1630, revenue: 98500,
    cover: 'node', accent: '#a8df8e', tags: ['Node.js', 'Express', 'API'], outcomes: ['Structure an Express service by feature', 'Validate requests and return consistent errors', 'Connect routes to persistent data'],
    modules: [moduleFor('node', 'Build an API foundation', ['Routes and controllers', 'Middleware that earns its place', 'Validating incoming data'])],
    published: true, approved: true, createdAt: '2026-08-28',
  },
  {
    id: 'course-mongo', slug: 'mongodb-data-modeling', title: 'MongoDB Data Modelling Lab',
    summary: 'Shape document databases around the way your product works.',
    description: 'Learn how to model relationships, index the right fields and build efficient queries for an application. The hands-on labs use a course platform as the example domain.',
    instructorId: 'user-imran', instructorName: 'Imran Hossain', instructorAvatar: 'IH', instructorBio: 'Full-stack developer and mentor focused on thoughtful TypeScript systems.',
    category: 'Data & Databases', price: 1290, level: 'Beginner', duration: '5h 30m', rating: 4.7, reviewCount: 142, students: 1110, revenue: 65800,
    cover: 'mongodb', accent: '#9ddeb5', tags: ['MongoDB', 'Database', 'Backend'], outcomes: ['Choose embedding or references deliberately', 'Add indexes for useful query patterns', 'Design a reliable course platform schema'],
    modules: [moduleFor('mongo', 'Model the product', ['Documents and collections', 'References that scale', 'Indexes and query plans'])],
    published: true, approved: true, createdAt: '2026-08-21',
  },
  {
    id: 'course-design', slug: 'design-systems-that-work', title: 'Design Systems That Work',
    summary: 'Give your product a visual language teams can actually use.',
    description: 'Create a durable visual system from the interface outward: tokens, type, color, interaction patterns, component documentation and collaboration rituals.',
    instructorId: 'user-samia', instructorName: 'Samia Chowdhury', instructorAvatar: 'SC', instructorBio: 'Design lead turning brand principles into useful product systems.',
    category: 'UI/UX Design', price: 990, level: 'Beginner', duration: '4h 50m', rating: 4.8, reviewCount: 96, students: 890, revenue: 43200,
    cover: 'design', accent: '#e5b8ff', tags: ['UI/UX', 'Systems', 'Product'], outcomes: ['Define practical design tokens', 'Document components for your team', 'Connect visual decisions to product intent'],
    modules: [moduleFor('design', 'A system with a point of view', ['Audit the interface language', 'Build color and type tokens', 'Document an interaction pattern'])],
    published: true, approved: true, createdAt: '2026-08-12',
  },
  {
    id: 'course-fullstack', slug: 'full-stack-launchpad', title: 'Full-stack Launchpad: React + Express',
    summary: 'Connect a sharp frontend to a useful, secure backend.',
    description: 'Take an idea from interface to API. Connect React to Express, shape the data, handle authentication boundaries and learn the workflow that keeps a small project moving.',
    instructorId: 'user-nadia', instructorName: 'Nadia Rahman', instructorAvatar: 'NR', instructorBio: 'Product engineer who helps teams turn complex ideas into clear, useful software.',
    category: 'Full-stack', price: 1990, level: 'Advanced', duration: '12h 15m', rating: 4.9, reviewCount: 177, students: 1460, revenue: 106700,
    cover: 'fullstack', accent: '#ffca78', tags: ['React', 'Express', 'Full-stack'], outcomes: ['Separate client and server responsibilities', 'Connect authenticated UI to an API', 'Ship an integrated project end-to-end'],
    modules: [moduleFor('fullstack', 'Bring the layers together', ['Build the product surface', 'Create the API contract', 'Connect auth and data'])],
    published: true, approved: true, createdAt: '2026-08-04',
  },
];

export const seedCategories: Category[] = [
  { id: 'cat-web', name: 'Web Development', count: 24, icon: '⌘' },
  { id: 'cat-backend', name: 'Backend Development', count: 18, icon: '◉' },
  { id: 'cat-design', name: 'UI/UX Design', count: 16, icon: '◌' },
  { id: 'cat-data', name: 'Data & Databases', count: 12, icon: '▦' },
  { id: 'cat-full', name: 'Full-stack', count: 21, icon: '⤢' },
];

export const seedUsers: SkillHubUser[] = [
  { id: 'demo-student', name: 'Redoan Ahmed', email: 'redoan@skillhub.local', role: 'student', avatar: 'RA', bio: 'Curious builder learning one project at a time.' },
  { id: 'demo-instructor', name: 'Nadia Rahman', email: 'nadia@skillhub.local', role: 'instructor', avatar: 'NR', bio: 'Product engineer and educator.' },
  { id: 'demo-admin', name: 'Amina Islam', email: 'admin@skillhub.local', role: 'admin', avatar: 'AI', bio: 'SkillHub platform administrator.' },
];

export const seedReviews: CourseReview[] = [
  { id: 'review-1', userId: 'student-2', userName: 'Muntasir Karim', courseId: 'course-react', rating: 5, comment: 'Clear explanations and a great final project. I finally feel comfortable structuring a React app.', createdAt: '2026-09-24' },
  { id: 'review-2', userId: 'student-3', userName: 'Tania Sultana', courseId: 'course-react', rating: 5, comment: 'Practical, calm and easy to follow. The small patterns made a big difference.', createdAt: '2026-09-22' },
  { id: 'review-3', userId: 'student-4', userName: 'Rafi Hasan', courseId: 'course-react', rating: 4, comment: 'Loved the real-world examples. Would recommend to anyone moving beyond tutorials.', createdAt: '2026-09-18' },
];

export const seedEnrollments: Enrollment[] = [
  { id: 'enrol-react', studentId: 'demo-student', courseId: 'course-react', enrolledAt: '2026-09-19', progress: 65, completed: false, completedLessons: ['react-lesson-1', 'react-lesson-2', 'react-lesson-3', 'react-lesson-4'] },
  { id: 'enrol-node', studentId: 'demo-student', courseId: 'course-node', enrolledAt: '2026-09-10', progress: 40, completed: false, completedLessons: ['node-lesson-1', 'node-lesson-2'] },
  { id: 'enrol-ts', studentId: 'demo-student', courseId: 'course-ts', enrolledAt: '2026-09-02', progress: 20, completed: false, completedLessons: ['ts-lesson-1'] },
];

export const seedNotifications: Notification[] = [
  { id: 'notify-1', userId: 'demo-student', type: 'enrollment', title: 'You’re enrolled', message: 'Your React learning path is ready when you are.', read: false, createdAt: '2026-09-19' },
  { id: 'notify-2', userId: 'demo-student', type: 'lesson', title: 'A new chapter is waiting', message: 'Nadia added a new lesson to Modern React.', read: false, createdAt: '2026-09-18' },
];
