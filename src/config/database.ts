import mongoose from 'mongoose';

export let mongoConnected = false;
export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  const demoMode = process.env.DEMO_MODE !== 'false' && !uri;
  if (!uri) {
    if (!demoMode) throw new Error('MONGODB_URI is required when DEMO_MODE=false.');
    console.info('[SkillHub] MongoDB is not configured; using seeded in-memory demo data.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    mongoConnected = true;
    mongoose.connection.on('disconnected', () => { mongoConnected = false; console.error('[SkillHub] MongoDB disconnected.'); });
    console.info('[SkillHub] MongoDB connection ready.');
  } catch (error) {
    if (!demoMode) throw error;
    console.warn('[SkillHub] MongoDB connection failed; continuing in demo mode.', error instanceof Error ? error.message : error);
  }
}
