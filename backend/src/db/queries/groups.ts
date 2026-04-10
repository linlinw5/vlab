import pool from '../client';
import type { Paginated } from '../../lib/pagination';

export interface Group {
  id: number;
  name: string;
  description: string | null;
  vmware_tag_id: string | null;
}

export async function getAllGroups(limit = 20, offset = 0): Promise<Paginated<Group>> {
  const [dataRes, countRes] = await Promise.all([
    pool.query('SELECT * FROM groups ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]),
    pool.query('SELECT COUNT(*) FROM groups'),
  ]);
  return {
    data: dataRes.rows,
    total: parseInt(countRes.rows[0].count),
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  };
}

export async function getGroupByName(name: string): Promise<Group | null> {
  const { rows } = await pool.query('SELECT * FROM groups WHERE name = $1', [name]);
  return rows[0] ?? null;
}

export async function getGroupById(id: number): Promise<Group | null> {
  const { rows } = await pool.query('SELECT * FROM groups WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function createGroup(name: string, description: string, vmware_tag_id: string): Promise<Group> {
  const { rows } = await pool.query(
    'INSERT INTO groups (name, description, vmware_tag_id) VALUES ($1, $2, $3) RETURNING *',
    [name, description, vmware_tag_id]
  );
  return rows[0];
}

export async function updateGroup(id: number, name: string, description: string): Promise<Group | null> {
  const { rows } = await pool.query(
    'UPDATE groups SET name = $1, description = $2 WHERE id = $3 RETURNING *',
    [name, description, id]
  );
  return rows[0] ?? null;
}

export async function deleteGroup(id: number): Promise<{ deletedUsers: number; deletedGroups: number }> {
  await pool.query('DELETE FROM lab_groups WHERE group_id = $1', [id]);
  await pool.query('DELETE FROM cloned_vms WHERE group_id = $1', [id]);
  const r1 = await pool.query('DELETE FROM users WHERE group_id = $1', [id]);
  const r2 = await pool.query('DELETE FROM groups WHERE id = $1', [id]);
  return { deletedUsers: r1.rowCount ?? 0, deletedGroups: r2.rowCount ?? 0 };
}
