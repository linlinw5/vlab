import pool from '../client';

export interface Category {
  id: number;
  name: string;
}

export async function getAllCategories(): Promise<Category[]> {
  const { rows } = await pool.query('SELECT id, name FROM categories ORDER BY id');
  return rows;
}

export async function getCategoryById(id: number): Promise<Category | null> {
  const { rows } = await pool.query('SELECT id, name FROM categories WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function createCategory(name: string): Promise<Category> {
  const { rows } = await pool.query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING *',
    [name]
  );
  return rows[0];
}

export async function updateCategory(id: number, name: string): Promise<Category | null> {
  const { rows } = await pool.query(
    'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
    [name, id]
  );
  return rows[0] ?? null;
}

export async function deleteCategory(id: number): Promise<Category | null> {
  const { rows } = await pool.query(
    'DELETE FROM categories WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] ?? null;
}
