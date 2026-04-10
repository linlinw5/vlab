import pool from '../client';
import type { Paginated } from '../../lib/pagination';

export interface ClonedVM {
  id: number;
  name: string;
  vm_id: string;
  lab_id: number;
  user_id: number;
  group_id: number | null;
  source_vm_id: string;
  title?: string;
  email?: string;
}

export async function getClonedVmsByUserId(userId: number): Promise<ClonedVM[]> {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.vm_id, c.lab_id, c.user_id, c.group_id, c.source_vm_id,
           l.title, u.email
    FROM cloned_vms c
    LEFT JOIN labs l ON c.lab_id = l.id
    JOIN users u ON c.user_id = u.id
    WHERE c.user_id = $1
  `, [userId]);
  return rows;
}

export async function getClonedVmsByLabIdUserId(labId: number, userId: number): Promise<ClonedVM[]> {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.vm_id, c.lab_id, c.user_id, c.group_id, c.source_vm_id,
           l.title, u.email
    FROM cloned_vms c
    LEFT JOIN labs l ON c.lab_id = l.id
    JOIN users u ON c.user_id = u.id
    WHERE c.lab_id = $1 AND c.user_id = $2
  `, [labId, userId]);
  return rows;
}

export async function getClonedVmsByGroupIdLabId(groupId: number, labId: number): Promise<ClonedVM[]> {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.vm_id, c.lab_id, c.user_id, c.group_id, c.source_vm_id,
           l.title, u.email
    FROM cloned_vms c
    LEFT JOIN labs l ON c.lab_id = l.id
    JOIN users u ON c.user_id = u.id
    WHERE c.group_id = $1 AND c.lab_id = $2
  `, [groupId, labId]);
  return rows;
}

export async function getClonedVmsByLabId(labId: number): Promise<ClonedVM[]> {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.vm_id, c.lab_id, c.user_id, c.group_id, c.source_vm_id,
           l.title, u.email
    FROM cloned_vms c
    LEFT JOIN labs l ON c.lab_id = l.id
    JOIN users u ON c.user_id = u.id
    WHERE c.lab_id = $1
  `, [labId]);
  return rows;
}

export async function getClonedVmsByGroupId(groupId: number): Promise<ClonedVM[]> {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.vm_id, c.lab_id, c.user_id, c.group_id, c.source_vm_id,
           l.title, u.email
    FROM cloned_vms c
    LEFT JOIN labs l ON c.lab_id = l.id
    JOIN users u ON c.user_id = u.id
    WHERE c.group_id = $1
  `, [groupId]);
  return rows;
}

export async function getClonedVMByVmId(vmId: string): Promise<ClonedVM | null> {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.vm_id, c.lab_id, c.user_id, c.group_id, c.source_vm_id,
           l.title, u.email
    FROM cloned_vms c
    LEFT JOIN labs l ON c.lab_id = l.id
    JOIN users u ON c.user_id = u.id
    WHERE c.vm_id = $1
  `, [vmId]);
  return rows[0] ?? null;
}

// Paginated version of getClonedVmsByUserId — for /api/vms/my
export async function getPaginatedClonedVmsByUserId(userId: number, limit = 20, offset = 0): Promise<Paginated<ClonedVM>> {
  const base = `
    FROM cloned_vms c
    LEFT JOIN labs l ON c.lab_id = l.id
    JOIN users u ON c.user_id = u.id
    WHERE c.user_id = $1
  `;
  const [dataRes, countRes] = await Promise.all([
    pool.query(`SELECT c.id, c.name, c.vm_id, c.lab_id, c.user_id, c.group_id, c.source_vm_id,
                       l.title, u.email
                ${base} ORDER BY c.id LIMIT $2 OFFSET $3`, [userId, limit, offset]),
    pool.query(`SELECT COUNT(*) ${base}`, [userId]),
  ]);
  return {
    data: dataRes.rows,
    total: parseInt(countRes.rows[0].count),
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  };
}

// Paginated version for admin /api/vms/cloned with optional filters
export async function getPaginatedClonedVms(
  filters: { userId?: number; groupId?: number; labId?: number },
  limit = 20,
  offset = 0,
): Promise<Paginated<ClonedVM>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  if (filters.userId  !== undefined) { conditions.push(`c.user_id = $${p++}`);  params.push(filters.userId); }
  if (filters.groupId !== undefined) { conditions.push(`c.group_id = $${p++}`); params.push(filters.groupId); }
  if (filters.labId   !== undefined) { conditions.push(`c.lab_id = $${p++}`);   params.push(filters.labId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const base = `FROM cloned_vms c LEFT JOIN labs l ON c.lab_id = l.id JOIN users u ON c.user_id = u.id ${where}`;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT c.id, c.name, c.vm_id, c.lab_id, c.user_id, c.group_id, c.source_vm_id,
              l.title, u.email
       ${base} ORDER BY c.id LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) ${base}`, params),
  ]);
  return {
    data: dataRes.rows,
    total: parseInt(countRes.rows[0].count),
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  };
}

export async function createClonedVM(
  name: string,
  vmId: string,
  labId: number | null,
  userId: number,
  groupId: number | null,
  sourceVmId: string
): Promise<ClonedVM> {
  const { rows } = await pool.query(`
    INSERT INTO cloned_vms (name, vm_id, lab_id, user_id, group_id, source_vm_id)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [name, vmId, labId, userId, groupId, sourceVmId]);
  return rows[0];
}

export async function deleteClonedVMByVmId(vmId: string): Promise<ClonedVM | null> {
  const { rows } = await pool.query(
    'DELETE FROM cloned_vms WHERE vm_id = $1 RETURNING *',
    [vmId]
  );
  return rows[0] ?? null;
}
