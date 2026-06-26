/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { Schedule } from './src/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(process.cwd(), 'schedules.json');
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'admin1234';

app.use(express.json());

// Helper: Ensure database file exists
async function initDatabase() {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify([], null, 2));
    console.log('Database initialized: schedules.json created.');
  }
}

// Helper: Read schedules
async function readSchedules(): Promise<Schedule[]> {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data) as Schedule[];
  } catch (error) {
    console.error('Error reading database:', error);
    return [];
  }
}

// Helper: Write schedules
async function writeSchedules(schedules: Schedule[]): Promise<void> {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(schedules, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Helper: Convert time string "HH:MM" to minutes from midnight
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper: Check if two events overlap
function isOverlapping(
  eventA: { date: string; startTime: string; endTime: string },
  eventB: { date: string; startTime: string; endTime: string }
): boolean {
  if (eventA.date !== eventB.date) return false;
  const startA = timeToMinutes(eventA.startTime);
  const endA = timeToMinutes(eventA.endTime);
  const startB = timeToMinutes(eventB.startTime);
  const endB = timeToMinutes(eventB.endTime);
  return Math.max(startA, startB) < Math.min(endA, endB);
}

// Helper: Check if request is authorized as Host
function checkIsHost(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  return token === HOST_PASSWORD;
}

// Initialize database inside startServer() below

// --- API Endpoints ---

// 1. Verify Host Password
app.post('/api/auth/host', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: '비밀번호를 입력해주세요.' });
  }
  if (password === HOST_PASSWORD) {
    return res.json({ success: true, token: HOST_PASSWORD, message: '인증에 성공했습니다.' });
  } else {
    return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
  }
});

// 2. Get All Schedules
app.get('/api/schedules', async (req, res) => {
  const isHost = checkIsHost(req);
  const creatorToken = req.headers['x-creator-token'] as string;
  const schedules = await readSchedules();

  // Strip sensitive passwords & tokens for security, unless they belong to the current host/creator
  const secureSchedules = schedules.map((schedule) => {
    const isOwner = schedule.creatorRole === 'guest' && creatorToken && schedule.creatorToken === creatorToken;
    const { guestPassword, creatorToken: token, ...rest } = schedule;
    
    return {
      ...rest,
      // Only include edit permission indicator
      isEditable: isHost || isOwner,
      // Mask locations/descriptions if needed (optional, keeping it simple for view, but protect password)
      hasPassword: !!guestPassword
    };
  });

  res.json(secureSchedules);
});

// 3. Create Schedule
app.post('/api/schedules', async (req, res) => {
  const isHost = checkIsHost(req);
  const creatorToken = req.headers['x-creator-token'] as string || crypto.randomUUID();
  const { title, date, startTime, endTime, location, description, guestName, guestPassword } = req.body;

  if (!title || !date || !startTime || !endTime) {
    return res.status(400).json({ error: '필수 입력 항목(일정명, 날짜, 시작 시간, 종료 시간)이 누락되었습니다.' });
  }

  // Validate time format and bounds (HH:MM and start < end)
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  if (startMins >= endMins) {
    return res.status(400).json({ error: '종료 시간은 시작 시간보다 늦어야 합니다.' });
  }

  const newEvent = {
    date,
    startTime,
    endTime,
  };

  const schedules = await readSchedules();

  // Overlap validation
  if (!isHost) {
    // Guests are not allowed to double-book
    const hasOverlap = schedules.some((schedule) => isOverlapping(schedule, newEvent));
    if (hasOverlap) {
      return res.status(409).json({ error: '해당 시간대에 이미 예약이 등록되어 있습니다. 다른 시간을 선택해 주세요.' });
    }
  }

  const createdSchedule: Schedule = {
    id: crypto.randomUUID(),
    title: title.trim(),
    date,
    startTime,
    endTime,
    location: location ? location.trim() : undefined,
    description: description ? description.trim() : undefined,
    creatorRole: isHost ? 'host' : 'guest',
    creatorToken: isHost ? undefined : creatorToken,
    guestName: isHost ? undefined : (guestName ? guestName.trim() : '게스트'),
    guestPassword: isHost ? undefined : (guestPassword ? guestPassword.trim() : undefined),
    createdAt: new Date().toISOString(),
  };

  schedules.push(createdSchedule);
  await writeSchedules(schedules);

  res.status(211).json({
    schedule: {
      id: createdSchedule.id,
      title: createdSchedule.title,
      date: createdSchedule.date,
      startTime: createdSchedule.startTime,
      endTime: createdSchedule.endTime,
      location: createdSchedule.location,
      description: createdSchedule.description,
      creatorRole: createdSchedule.creatorRole,
      guestName: createdSchedule.guestName,
      createdAt: createdSchedule.createdAt,
      isEditable: true,
      hasPassword: !!createdSchedule.guestPassword
    },
    creatorToken: createdSchedule.creatorToken
  });
});

// 4. Update Schedule
app.put('/api/schedules/:id', async (req, res) => {
  const { id } = req.params;
  const isHost = checkIsHost(req);
  const creatorToken = req.headers['x-creator-token'] as string;
  const guestPasswordHeader = req.headers['x-guest-password'] as string;

  const { title, date, startTime, endTime, location, description, guestName, guestPassword } = req.body;

  if (!title || !date || !startTime || !endTime) {
    return res.status(400).json({ error: '필수 입력 항목이 누락되었습니다.' });
  }

  const schedules = await readSchedules();
  const scheduleIndex = schedules.findIndex((s) => s.id === id);

  if (scheduleIndex === -1) {
    return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
  }

  const existingSchedule = schedules[scheduleIndex];

  // Auth check for guests
  if (!isHost) {
    const isOwnerByToken = existingSchedule.creatorRole === 'guest' && creatorToken && existingSchedule.creatorToken === creatorToken;
    const isOwnerByPassword = existingSchedule.creatorRole === 'guest' && existingSchedule.guestPassword && 
      (existingSchedule.guestPassword === guestPasswordHeader || existingSchedule.guestPassword === guestPassword);

    if (!isOwnerByToken && !isOwnerByPassword) {
      return res.status(403).json({ error: '이 일정을 수정할 권한이 없습니다. 본인 작성 글인지 확인해 주세요.' });
    }
  }

  // Validate time bounds
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  if (startMins >= endMins) {
    return res.status(400).json({ error: '종료 시간은 시작 시간보다 늦어야 합니다.' });
  }

  const updatedEvent = { date, startTime, endTime };

  // Overlap validation (exclude self when checking overlaps)
  if (!isHost) {
    const hasOverlap = schedules.some((schedule) => schedule.id !== id && isOverlapping(schedule, updatedEvent));
    if (hasOverlap) {
      return res.status(409).json({ error: '해당 시간대에 이미 예약이 등록되어 있습니다. 다른 시간을 선택해 주세요.' });
    }
  }

  // Update schedule
  const updatedSchedule: Schedule = {
    ...existingSchedule,
    title: title.trim(),
    date,
    startTime,
    endTime,
    location: location ? location.trim() : undefined,
    description: description ? description.trim() : undefined,
    guestName: existingSchedule.creatorRole === 'host' ? undefined : (guestName ? guestName.trim() : existingSchedule.guestName),
    guestPassword: existingSchedule.creatorRole === 'host' ? undefined : (guestPassword ? guestPassword.trim() : existingSchedule.guestPassword),
  };

  schedules[scheduleIndex] = updatedSchedule;
  await writeSchedules(schedules);

  res.json({
    schedule: {
      id: updatedSchedule.id,
      title: updatedSchedule.title,
      date: updatedSchedule.date,
      startTime: updatedSchedule.startTime,
      endTime: updatedSchedule.endTime,
      location: updatedSchedule.location,
      description: updatedSchedule.description,
      creatorRole: updatedSchedule.creatorRole,
      guestName: updatedSchedule.guestName,
      createdAt: updatedSchedule.createdAt,
      isEditable: true,
      hasPassword: !!updatedSchedule.guestPassword
    }
  });
});

// 5. Delete Schedule
app.delete('/api/schedules/:id', async (req, res) => {
  const { id } = req.params;
  const isHost = checkIsHost(req);
  const creatorToken = req.headers['x-creator-token'] as string;
  const guestPasswordHeader = req.headers['x-guest-password'] as string;
  const { guestPassword } = req.body || {};

  const schedules = await readSchedules();
  const scheduleIndex = schedules.findIndex((s) => s.id === id);

  if (scheduleIndex === -1) {
    return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
  }

  const existingSchedule = schedules[scheduleIndex];

  // Auth check
  if (!isHost) {
    const isOwnerByToken = existingSchedule.creatorRole === 'guest' && creatorToken && existingSchedule.creatorToken === creatorToken;
    const isOwnerByPassword = existingSchedule.creatorRole === 'guest' && existingSchedule.guestPassword && 
      (existingSchedule.guestPassword === guestPasswordHeader || existingSchedule.guestPassword === guestPassword);

    if (!isOwnerByToken && !isOwnerByPassword) {
      return res.status(403).json({ error: '이 일정을 삭제할 권한이 없습니다.' });
    }
  }

  schedules.splice(scheduleIndex, 1);
  await writeSchedules(schedules);

  res.json({ success: true, message: '일정이 삭제되었습니다.' });
});

// --- Frontend Serving and Development Middleware Setup ---

async function startServer() {
  await initDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
