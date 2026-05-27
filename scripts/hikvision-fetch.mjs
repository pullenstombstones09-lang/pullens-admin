#!/usr/bin/env node
// HikVision DS-K1T343MWX — pull recent access events + enrolled user list.
//
// Usage (PowerShell):
//   $env:HIKVISION_USER = "admin"
//   $env:HIKVISION_PW   = "<password>"
//   node scripts/hikvision-fetch.mjs                # default: last 48h events + all users
//   node scripts/hikvision-fetch.mjs events         # only events
//   node scripts/hikvision-fetch.mjs users          # only user list
//
// Optional: $env:HIKVISION_HOST (defaults to 192.168.8.11)

import http from 'node:http';
import crypto from 'node:crypto';

const username = process.env.HIKVISION_USER;
const password = process.env.HIKVISION_PW;
const host = process.env.HIKVISION_HOST || '192.168.8.11';
const mode = process.argv[2] || 'both';

if (!username || !password) {
  console.error('Set $env:HIKVISION_USER and $env:HIKVISION_PW first.');
  process.exit(1);
}

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function parseDigest(header) {
  const parts = {};
  header
    .replace(/^Digest /, '')
    .split(',')
    .forEach((p) => {
      const m = p.trim().match(/^(\w+)="?([^"]*)"?$/);
      if (m) parts[m[1]] = m[2];
    });
  return parts;
}

function rawReq({ path, method, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { host, port: 80, path, method, headers, timeout: 10000 },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          })
        );
      }
    );
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('timeout (device unreachable)')));
    if (body) r.write(body);
    r.end();
  });
}

async function digestReq(method, path, jsonBody = null) {
  const bodyStr = jsonBody ? JSON.stringify(jsonBody) : null;
  const baseHeaders = bodyStr
    ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    : {};

  const first = await rawReq({ path, method, headers: baseHeaders, body: bodyStr });
  if (first.status !== 401) return first;

  const wa = first.headers['www-authenticate'];
  if (!wa) throw new Error('No WWW-Authenticate header on 401');
  const d = parseDigest(wa);

  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const qop = (d.qop || 'auth').split(',')[0].trim();
  const ha1 = md5(`${username}:${d.realm}:${password}`);
  const ha2 = md5(`${method}:${path}`);
  const response = md5(`${ha1}:${d.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const authParts = [
    `username="${username}"`,
    `realm="${d.realm}"`,
    `nonce="${d.nonce}"`,
    `uri="${path}"`,
    `qop=${qop}`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
    `response="${response}"`,
    `algorithm=MD5`,
  ];
  if (d.opaque) authParts.push(`opaque="${d.opaque}"`);

  return rawReq({
    path,
    method,
    body: bodyStr,
    headers: { ...baseHeaders, Authorization: `Digest ${authParts.join(', ')}` },
  });
}

function isoZA(date) {
  const offset = '+02:00';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset}`
  );
}

async function fetchEvents() {
  const now = new Date();
  const startDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const searchID = crypto.randomUUID();
  const allEvents = [];
  let position = 0;
  const pageSize = 30;
  let totalMatches = null;

  for (let page = 0; page < 50; page++) {
    const body = {
      AcsEventCond: {
        searchID,
        searchResultPosition: position,
        maxResults: pageSize,
        major: 0,
        minor: 0,
        startTime: isoZA(startDate),
        endTime: isoZA(now),
      },
    };
    const res = await digestReq('POST', '/ISAPI/AccessControl/AcsEvent?format=json', body);
    if (res.status !== 200) {
      console.error(`Events fetch failed with status ${res.status}:`);
      console.error(res.body.slice(0, 600));
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(res.body);
    } catch (e) {
      console.error('AcsEvent response was not JSON:');
      console.error(res.body.slice(0, 600));
      return null;
    }
    const cond = parsed.AcsEvent;
    if (!cond) {
      console.error('Unexpected AcsEvent response shape:');
      console.error(JSON.stringify(parsed).slice(0, 600));
      return null;
    }
    totalMatches = cond.totalMatches ?? totalMatches;
    const infoList = cond.InfoList || [];
    allEvents.push(...infoList);
    position += infoList.length;
    if (cond.responseStatusStrg === 'NO MATCH' || infoList.length < pageSize) break;
  }

  return { totalMatches, events: allEvents };
}

async function fetchUsers() {
  const searchID = crypto.randomUUID();
  const all = [];
  let position = 0;
  const pageSize = 50;

  for (let page = 0; page < 20; page++) {
    const body = {
      UserInfoSearchCond: {
        searchID,
        searchResultPosition: position,
        maxResults: pageSize,
      },
    };
    const res = await digestReq('POST', '/ISAPI/AccessControl/UserInfo/Search?format=json', body);
    if (res.status !== 200) {
      console.error(`User search failed with status ${res.status}:`);
      console.error(res.body.slice(0, 600));
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(res.body);
    } catch (e) {
      console.error('UserInfo response was not JSON:');
      console.error(res.body.slice(0, 600));
      return null;
    }
    const cond = parsed.UserInfoSearch;
    if (!cond) {
      console.error('Unexpected UserInfoSearch response shape:');
      console.error(JSON.stringify(parsed).slice(0, 600));
      return null;
    }
    const infoList = cond.UserInfo || [];
    all.push(...infoList);
    position += infoList.length;
    if (cond.responseStatusStrg === 'NO MATCH' || cond.responseStatusStrg === 'OK' || infoList.length === 0) break;
  }

  return all;
}

(async () => {
  if (mode === 'events' || mode === 'both') {
    console.log(`\n=== Recent events (last 48h on ${host}) ===`);
    const result = await fetchEvents();
    if (result) {
      console.log(`Total reported: ${result.totalMatches} · Returned: ${result.events.length}`);
      console.log('First 5 events:');
      console.log(JSON.stringify(result.events.slice(0, 5), null, 2));
      console.log(`(${result.events.length} total — full list at /tmp/hikvision-events.json)`);
      const fs = await import('node:fs/promises');
      await fs.writeFile('hikvision-events.json', JSON.stringify(result.events, null, 2));
      console.log('Saved to hikvision-events.json');
    }
  }

  if (mode === 'users' || mode === 'both') {
    console.log(`\n=== Enrolled users on ${host} ===`);
    const users = await fetchUsers();
    if (users) {
      console.log(`Total enrolled: ${users.length}`);
      const slim = users.map((u) => ({
        employeeNo: u.employeeNo,
        name: u.name,
        userType: u.userType,
        gender: u.gender,
        valid: u.Valid?.enable,
      }));
      console.log(JSON.stringify(slim, null, 2));
      const fs = await import('node:fs/promises');
      await fs.writeFile('hikvision-users.json', JSON.stringify(users, null, 2));
      console.log('Full payload saved to hikvision-users.json');
    }
  }
})().catch((err) => {
  console.error('\n❌ Fetch failed:', err.message);
  process.exit(1);
});
