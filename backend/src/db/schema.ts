import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Persisted scenario document (short URL target). */
export const scenarios = sqliteTable('scenarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  dataJson: text('data_json').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/** Immutable snapshots when a scenario is saved/updated. */
export const scenarioVersions = sqliteTable('scenario_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scenarioId: integer('scenario_id')
    .notNull()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  dataJson: text('data_json').notNull(),
  createdAt: text('created_at').notNull(),
});

export type ScenarioRow = typeof scenarios.$inferSelect;
export type NewScenarioRow = typeof scenarios.$inferInsert;
