import 'dotenv/config';
import mongoose from 'mongoose';
import { seedCategories, seedCourses } from '../../shared/seed.js';
import { CategoryModel, CourseModel } from '../models/index.js';

async function seed() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('Set MONGODB_URI before running the persistent seed command.');
  await mongoose.connect(uri);
  for (const category of seedCategories) await CategoryModel.updateOne({ id: category.id }, { $setOnInsert: category }, { upsert: true });
  for (const course of seedCourses) await CourseModel.updateOne({ id: course.id }, { $setOnInsert: course }, { upsert: true });
  console.info(`Seeded ${seedCategories.length} categories and ${seedCourses.length} published sample courses.`);
  await mongoose.disconnect();
}
seed().catch((error) => { console.error('Seed failed.', error); process.exitCode = 1; });
