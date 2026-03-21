import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

let currentClinicaId = null;

export function setClinicaId(id) {
  currentClinicaId = id;
}

export function getClinicaId() {
  return currentClinicaId;
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (currentClinicaId) {
    headers['X-Clinica-Id'] = String(currentClinicaId);
  }
  const res = await fetch(`/api${path}`, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de conexión' }));
    throw new Error(err.error || 'Error del servidor');
  }
  return res.json();
}
