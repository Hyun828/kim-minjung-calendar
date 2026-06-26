/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Schedule {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (30-min increments)
  endTime: string; // HH:MM (30-min increments)
  location?: string;
  description?: string;
  creatorRole: 'host' | 'guest';
  creatorToken?: string; // Client-side localStorage UUID token
  guestName?: string; // Optional nickname for guests
  guestPassword?: string; // Optional 4-digit PIN for device cross-over editing
  createdAt: string; // ISO String
  isEditable?: boolean; // Client flag for frontend editing permission
  hasPassword?: boolean; // Client flag indicating event has PIN
}

export interface ScheduleInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  guestName?: string;
  guestPassword?: string;
}

export interface TimeRange {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface HostVerificationResponse {
  success: boolean;
  token?: string;
  message?: string;
}
