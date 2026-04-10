'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { UserContext } from '@/contexts/user-context';
import type { User } from '@/types';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const user = await auth.me();
        setUser(user);
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 401) router.push('/auth');
      }
    }
    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 未完成鉴权前不渲染子页面
  if (!user) return null;

  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  );
}
