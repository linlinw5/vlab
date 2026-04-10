import pool from '../client';

export interface Lab {
  id: number;
  title: string;
  description: string | null;
  link: string | null;
  category_id: number | null;
  vm_ids: string[];
  category_name?: string;
}

export interface Assignment {
  id: number;
  lab_id: number;
  group_id: number;
  lab_title?: string;
  group_name?: string;
}

export async function getAllLabs(): Promise<Lab[]> {
  const { rows } = await pool.query(`
    SELECT l.id, l.title, l.description, l.link, l.category_id, l.vm_ids,
           c.name AS category_name
    FROM labs l
    LEFT JOIN categories c ON l.category_id = c.id
  `);
  return rows;
}

export async function getLabById(id: number): Promise<Lab | null> {
  const { rows } = await pool.query(`
    SELECT l.id, l.title, l.description, l.link, l.category_id, l.vm_ids,
           c.name AS category_name
    FROM labs l
    LEFT JOIN categories c ON l.category_id = c.id
    WHERE l.id = $1
  `, [id]);
  return rows[0] ?? null;
}

export async function getLabsByGroupId(groupId: number): Promise<Lab[]> {
  const { rows } = await pool.query(`
    SELECT l.id, l.title, l.description, l.link, l.category_id, l.vm_ids,
           c.name AS category_name
    FROM labs l
    LEFT JOIN categories c ON l.category_id = c.id
    INNER JOIN lab_groups lg ON lg.lab_id = l.id
    WHERE lg.group_id = $1
  `, [groupId]);
  return rows;
}

export async function createLab(
  title: string,
  description: string,
  link: string,
  categoryId: number | null,
  vmIds: string[]
): Promise<Lab> {
  const { rows } = await pool.query(
    'INSERT INTO labs (title, description, link, category_id, vm_ids) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, description, link, categoryId, vmIds]
  );
  return rows[0];
}

export async function updateLab(
  id: number,
  title: string,
  description: string,
  link: string,
  categoryId: number | null,
  vmIds: string[]
): Promise<Lab | null> {
  const { rows } = await pool.query(`
    UPDATE labs SET title = $1, description = $2, link = $3, category_id = $4, vm_ids = $5
    WHERE id = $6 RETURNING *
  `, [title, description, link, categoryId, vmIds, id]);
  return rows[0] ?? null;
}

export async function deleteLab(id: number): Promise<Lab | null> {
  const { rows } = await pool.query('DELETE FROM labs WHERE id = $1 RETURNING *', [id]);
  return rows[0] ?? null;
}

// Lab-Group assignments
export async function getAllAssignments(): Promise<Assignment[]> {
  const { rows } = await pool.query(`
    SELECT lg.id, lg.lab_id, lg.group_id,
           l.title AS lab_title, g.name AS group_name
    FROM lab_groups lg
    LEFT JOIN labs l ON lg.lab_id = l.id
    LEFT JOIN groups g ON lg.group_id = g.id
    ORDER BY lg.lab_id
  `);
  return rows;
}

export async function getAssignmentsByLabId(labId: number): Promise<Assignment[]> {
  const { rows } = await pool.query(`
    SELECT lg.id, lg.lab_id, lg.group_id,
           l.title AS lab_title, g.name AS group_name
    FROM lab_groups lg
    LEFT JOIN labs l ON lg.lab_id = l.id
    LEFT JOIN groups g ON lg.group_id = g.id
    WHERE lg.lab_id = $1
    ORDER BY lg.group_id
  `, [labId]);
  return rows;
}

export async function getAssignmentsByGroupId(groupId: number): Promise<Assignment[]> {
  const { rows } = await pool.query(`
    SELECT lg.id, lg.lab_id, lg.group_id,
           l.title AS lab_title, g.name AS group_name
    FROM lab_groups lg
    LEFT JOIN labs l ON lg.lab_id = l.id
    LEFT JOIN groups g ON lg.group_id = g.id
    WHERE lg.group_id = $1
    ORDER BY lg.lab_id
  `, [groupId]);
  return rows;
}

export async function getAssignmentByLabAndGroup(labId: number, groupId: number): Promise<Assignment | null> {
  const { rows } = await pool.query(`
    SELECT lg.id, lg.lab_id, lg.group_id,
           l.title AS lab_title, g.name AS group_name
    FROM lab_groups lg
    LEFT JOIN labs l ON lg.lab_id = l.id
    LEFT JOIN groups g ON lg.group_id = g.id
    WHERE lg.lab_id = $1 AND lg.group_id = $2
  `, [labId, groupId]);
  return rows[0] ?? null;
}

export async function assignLabToGroup(labId: number, groupId: number): Promise<Assignment> {
  const { rows } = await pool.query(
    'INSERT INTO lab_groups (lab_id, group_id) VALUES ($1, $2) RETURNING *',
    [labId, groupId]
  );
  return rows[0];
}

export async function deleteAssignment(id: number): Promise<Assignment | null> {
  const { rows } = await pool.query('DELETE FROM lab_groups WHERE id = $1 RETURNING *', [id]);
  return rows[0] ?? null;
}
