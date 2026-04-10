export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: number;
  email: string;
  username: string;
  roleId: number;
  roleName: string;
  groupId: number | null;
  groupName: string | null;
  vpnEnable: boolean;
  vpnPassword: string | null;
  createdAt: string;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  vmwareTagId: string | null;
}

export interface Category {
  id: number;
  name: string;
}

export interface Lab {
  id: number;
  title: string;
  description: string | null;
  link: string | null;
  categoryId: number | null;
  vmIds: string[];
  categoryName?: string;
}

export interface Assignment {
  id: number;
  labId: number;
  groupId: number;
  labTitle?: string;
  groupName?: string;
}

export interface ClonedVM {
  id: number;
  name: string;
  vmId: string;
  labId: number;
  userId: number;
  groupId: number | null;
  sourceVmId: string;
  title?: string;
  email?: string;
}

export interface PowerState {
  state: 'POWERED_ON' | 'POWERED_OFF' | 'SUSPENDED';
}

export interface CronTask {
  id: string;
  description: string;
  expression: string;
  enabled: boolean;
}
