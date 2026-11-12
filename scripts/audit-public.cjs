const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
if (!files.length) throw Error('No tracked or staged files to audit');
const failures = [];
const forbidden = /(^|\/)(?:\.work|dist|node_modules|coverage|\.env(?:\..*)?|prefs\.js|user\.js|cert9\.db|key4\.db|cookies\.sqlite|zotero\.sqlite|id_rsa|id_ed25519)(?:\/|$)/i;
const homePath = /[a-z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/[a-z0-9._-]+\//i;
const credential = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bAKIA[A-Z0-9]{16}\b/;
for (const name of files) {
  if (forbidden.test(name) && name !== '.env.example') failures.push(`${name}: private or generated file`);
  // Audit the exact staged/published content; this also catches staged changes
  // when the working copy has subsequently been edited.
  const content = execFileSync('git', ['show', `:${name}`], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (homePath.test(content)) failures.push(`${name}: machine-specific home path`);
  if (credential.test(content)) failures.push(`${name}: possible credential`);
  if (/\.(?:sqlite|db|pdf|xpi|log)$/i.test(name)) failures.push(`${name}: unexpected binary or local-data artifact`);
}
if (failures.length) throw Error(failures.join('\n'));
console.log(`Audited ${files.length} tracked files: no private profiles, home paths, or recognized credentials.`);
