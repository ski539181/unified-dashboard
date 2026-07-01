// Learning Store — SQLite read model for lessons
import { DatabaseManager } from './database';
import { Lesson, LessonCategory } from '../modules/learning/learning-loop';

interface LessonRow {
  id: string;
  title: string;
  description: string;
  pattern: string;
  category: string;
  confidence: number;
  evidence: string;
  application_count: number;
  created_at: number;
  last_applied_at: number | null;
}

export class LearningStore {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  saveLesson(lesson: Lesson): void {
    this.db.getDb().prepare(`
      INSERT INTO lessons (id, title, description, pattern, category, confidence,
        evidence, application_count, created_at, last_applied_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, description=excluded.description, pattern=excluded.pattern,
        category=excluded.category, confidence=excluded.confidence, evidence=excluded.evidence,
        application_count=excluded.application_count, last_applied_at=excluded.last_applied_at
    `).run(
      lesson.id, lesson.title, lesson.description, lesson.pattern, lesson.category,
      lesson.confidence, JSON.stringify(lesson.evidence), lesson.applicationCount,
      lesson.createdAt, lesson.lastAppliedAt || null
    );
  }

  getLesson(id: string): Lesson | undefined {
    const row = this.db.getDb().prepare('SELECT * FROM lessons WHERE id = ?').get(id) as LessonRow | undefined;
    return row ? this.rowToLesson(row) : undefined;
  }

  getAllLessons(): Lesson[] {
    const rows = this.db.getDb().prepare('SELECT * FROM lessons ORDER BY confidence DESC').all() as LessonRow[];
    return rows.map(r => this.rowToLesson(r));
  }

  getLessonsByCategory(category: string): Lesson[] {
    const rows = this.db.getDb().prepare(
      'SELECT * FROM lessons WHERE category = ? ORDER BY confidence DESC'
    ).all(category) as LessonRow[];
    return rows.map(r => this.rowToLesson(r));
  }

  deleteLesson(id: string): void {
    this.db.getDb().prepare('DELETE FROM lessons WHERE id = ?').run(id);
  }

  private rowToLesson(row: LessonRow): Lesson {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      pattern: row.pattern,
      category: row.category as LessonCategory,
      confidence: row.confidence,
      evidence: JSON.parse(row.evidence),
      createdAt: row.created_at,
      applicationCount: row.application_count,
      lastAppliedAt: row.last_applied_at || undefined,
    };
  }
}