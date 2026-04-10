'use client';

import { useEffect, useState } from 'react';
import { cron as cronApi } from '@/lib/api';
import type { CronTask } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

export default function AdminCronPage() {
  const [tasks, setTasks]     = useState<CronTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cronApi.tasks().then(list => { setTasks(list); setLoading(false); });
  }, []);

  async function handleToggle(id: string) {
    const result = await cronApi.toggle(id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, enabled: result.enabled } : t));
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Scheduled Tasks</h1>
      <div className="border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Cron Expression</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(task => (
              <TableRow key={task.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{task.id}</TableCell>
                <TableCell>{task.description}</TableCell>
                <TableCell className="font-mono text-xs">{task.expression}</TableCell>
                <TableCell>
                  <Badge variant={task.enabled ? 'default' : 'secondary'}>
                    {task.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch checked={task.enabled} onCheckedChange={() => handleToggle(task.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
