#!/usr/bin/env node
// HikVision DS-K1T343MWX connectivity probe.
//
// Usage (PowerShell — keeps password out of shell history):
//   $env:HIKVISION_USER = "admin"
//   $env:HIKVISION_PW   = "<password>"
//   node scripts/hikvision-probe.mjs                  # uses default host 192.168.8.11
//   node scripts/hikvision-probe.mjs 192.168.8.11     # explicit host
//
// Tests HTTP Digest auth against the device's ISAPI endpoint.
// Returns device info on success. No dependencies.

import http from 'node:http';
import crypto from 'node:crypto';

const username = process.env.HIKVISION_USER || process.argv[2];
const password = process.env.HIKVISION_PW || process.argv[3];
const host = process.argv[process.env.HIKVISION_USER ? 2 : 4] || '192.168.8.11';
if (!username || !password) {
  console.error('usage: set $env:HIKVISION_USER and $env:HIKVISION_PW, then run: node hikvision-probe.mjs [host]');
  process.exit(1);
}

const path = '/ISAPI/System/deviceInfo';

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

function req(opts, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { host, port: 80, path: opts.path, method: 'GET', headers, timeout: 5000 },
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
    r.on('timeout', () => {
      r.destroy(new Error('timeout (device unreachable)'));
    });
    r.end();
  });
}

(async () => {
  console.log(`→ Probing ${host}${path} ...`);
  // 1st request — expect 401 digest challenge
  const first = await req({ path });
  if (first.status !== 401) {
    console.log(`Status ${first.status} (expected 401 challenge):`);
    console.log(first.body.slice(0, 400));
    return;
  }
  const wa = first.headers['www-authenticate'];
  if (!wa) {
    console.error('No WWW-Authenticate header in challenge');
    return;
  }
  const d = parseDigest(wa);

  // Build digest response
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const qop = (d.qop || 'auth').split(',')[0].trim();
  const ha1 = md5(`${username}:${d.realm}:${password}`);
  const ha2 = md5(`GET:${path}`);
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

  const second = await req({ path }, { Authorization: `Digest ${authParts.join(', ')}` });

  console.log(`\n← Status ${second.status}`);
  if (second.status === 200) {
    console.log('\n✅ SUCCESS — Device reachable and credentials accepted.\n');
    console.log(second.body);
  } else if (second.status === 401) {
    console.log('\n❌ AUTH FAILED — username or password is wrong.\n');
    console.log(second.body.slice(0, 400));
  } else {
    console.log(`\n⚠️  Unexpected status ${second.status}\n`);
    console.log(second.body.slice(0, 400));
  }
})().catch((err) => {
  console.error('\n❌ Connection failed:', err.message);
  console.error('Check: device powered on, same Wi-Fi, IP 192.168.8.11 still correct.');
  process.exit(1);
});
