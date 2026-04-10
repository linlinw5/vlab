import VCenterClient from './api-client';

const client = new VCenterClient();

export type FolderType = 'VIRTUAL_MACHINE' | 'DATASTORE' | 'HOST' | 'NETWORK' | 'DATACENTER';

export interface Folder {
  folder: string;
  name: string;
  type: FolderType;
}

export async function getFolders(type: FolderType = 'VIRTUAL_MACHINE'): Promise<Folder[]> {
  return client.get<Folder[]>(`/api/vcenter/folder?type=${type}`);
}

export async function getDatastores() {
  return client.get('/api/vcenter/datastore');
}

export async function getHosts() {
  return client.get('/api/vcenter/host');
}

export async function getClusters() {
  return client.get('/api/vcenter/cluster');
}

export async function getDatacenters() {
  return client.get('/api/vcenter/datacenter');
}

export async function getNetworks() {
  return client.get('/api/vcenter/network');
}

export async function getResourcePools() {
  return client.get('/api/vcenter/resource-pool');
}
