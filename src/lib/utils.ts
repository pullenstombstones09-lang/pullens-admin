import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatTime(time: string | null): string {
  if (!time) return '—';
  return time.slice(0, 5); // HH:mm
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function yearsOfService(startDate: string | null): string {
  if (!startDate) return '—';
  const start = new Date(startDate);
  const now = new Date();
  const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) return 'Less than 1 year';
  return `${years} year${years === 1 ? '' : 's'}`;
}

// Derive DOB from SA ID number (first 6 digits = YYMMDD)
export function dobFromId(idNumber: string | null): string | null {
  if (!idNumber || idNumber.length < 6 || !/^\d{6}/.test(idNumber)) return null;
  const yy = parseInt(idNumber.slice(0, 2));
  const mm = idNumber.slice(2, 4);
  const dd = idNumber.slice(4, 6);
  const century = yy >= 0 && yy <= 30 ? '20' : '19';
  return `${century}${idNumber.slice(0, 2)}-${mm}-${dd}`;
}

// Get week number (ISO)
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
