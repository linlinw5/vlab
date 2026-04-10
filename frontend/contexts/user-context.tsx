'use client';

import { createContext, useContext } from 'react';
import type { User } from '@/types';

export const UserContext = createContext<User | null>(null);

export function useUser(): User | null {
  return useContext(UserContext);
}
