const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('package includes the mandatory Zotero fields and public release-update URL', () => {
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'));
  const app = manifest.applications.zotero;
  assert.equal(manifest.manifest_version, 2);
  assert.equal(app.id, 'remarkable-desktop@matan.local');
  assert.ok(app.strict_min_version);
  assert.ok(app.strict_max_version);
  assert.equal(new URL(app.update_url).protocol, 'https:');
  const project = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(manifest.version, project.version);
  assert.equal(app.update_url, project.repository.url.replace(/\.git$/, '') + '/releases/latest/download/updates.json');
});

function attachment(options = {}) {
  return {
    id: 1, deleted: false,
    isAttachment: () => true,
    isRegularItem: () => false,
    isPDFAttachment: () => true,
    isStoredFileAttachment: () => true,
    getFilePathAsync: async () => 'C:\\Zotero\\Paper.pdf',
    ...options,
  };
}

function setup() {
  const calls = { launched: [], alerts: [], downloads: [], notices: 0 };
  const files = new Set(['C:\\Program Files\\reMarkable\\reMarkable.exe']);
  const prefs = new Map();
  const items = new Map();
  const classes = {
    '@mozilla.org/file/local;1': {
      createInstance: () => ({
        initWithPath(path) { this.path = path; },
        exists() { return files.has(this.path); },
        isFile() { return files.has(this.path); },
        isExecutable() { return files.has(this.path); },
      }),
    },
    '@mozilla.org/process/util;1': {
      createInstance: () => ({
        init(file) { this.exe = file.path; },
        runw(blocking, args, count) { calls.launched.push({ exe: this.exe, blocking, args: Array.from(args), count }); },
      }),
    },
  };
  const Zotero = {
    isWin: true,
    Prefs: { get: key => prefs.get(key), set: (key, value) => prefs.set(key, value) },
    Items: { get: id => items.get(id) },
    Sync: { Runner: { downloadFile: async a => calls.downloads.push(a.id) } },
    alert: (_window, _title, message) => calls.alerts.push(message),
    logError: () => {},
    ProgressWindow: function () {
      return { changeHeadline() {}, addDescription() {}, show() { calls.notices++; }, startCloseTimer() {} };
    },
  };
  const context = vm.createContext({
    Zotero,
    Services: { env: { get: key => ({ ProgramFiles: 'C:\\Program Files' })[key] || '' } },
    Components: { classes, interfaces: {} },
    ChromeUtils: { importESModule: () => { throw Error('Unexpected file picker'); } },
  });
  vm.runInContext(fs.readFileSync('src/remarkable.js', 'utf8'), context);
  return { api: context.RemarkableDesktop, calls, files, prefs, items, Zotero, context };
}

test('a parent uses the preferred PDF, skipping non-PDF and trashed attachments', async () => {
  const { api } = setup();
  const pdf = attachment({ id: 4 });
  const parent = attachment({
    isAttachment: () => false, isRegularItem: () => true,
    getBestAttachments: async () => [attachment({ isPDFAttachment: () => false }), attachment({ deleted: true }), pdf],
  });
  assert.equal((await api.resolvePDF([parent])).attachment, pdf);
});

test('selecting a particular attachment sends that PDF directly', async () => {
  const { api } = setup();
  const pdf = attachment();
  assert.equal((await api.resolvePDF([pdf])).attachment, pdf);
});

test('a remote stored PDF is downloaded through Zotero and rechecked', async () => {
  const { api, calls } = setup();
  const pdf = attachment({ getFilePathAsync: async () => calls.downloads.length ? 'C:\\local.pdf' : false });
  assert.equal((await api.resolvePDF([pdf])).path, 'C:\\local.pdf');
  assert.deepEqual(calls.downloads, [1]);
});

test('a broken linked file produces an error without downloading or launching', async () => {
  const { api, calls } = setup();
  const pdf = attachment({ getFilePathAsync: async () => false, isStoredFileAttachment: () => false });
  assert.equal(await api.send([pdf], {}), false);
  assert.match(calls.alerts[0], /linked file/);
  assert.deepEqual(calls.downloads, []);
  assert.deepEqual(calls.launched, []);
});

test('an unsuccessful sync download cannot report a successful send', async () => {
  const { api, calls } = setup();
  assert.equal(await api.send([attachment({ getFilePathAsync: async () => false })], {}), false);
  assert.equal(calls.downloads.length, 1);
  assert.equal(calls.notices, 0);
  assert.equal(calls.launched.length, 0);
});

test('Unicode, spaces and shell metacharacters remain a single literal process argument', async () => {
  const { api, calls } = setup();
  const path = 'C:\\מאמרים\\O\'Brien & $(test) `quote` paper.pdf';
  assert.equal(await api.send([attachment({ getFilePathAsync: async () => path })], {}), true);
  assert.deepEqual(calls.launched, [{ exe: 'C:\\Program Files\\reMarkable\\reMarkable.exe', blocking: false, args: [path], count: 1 }]);
  assert.equal(calls.notices, 1);
});

test('no-PDF, deleted and multiple selections do not launch', async () => {
  for (const selection of [[], [attachment(), attachment()], [attachment({ deleted: true })], [attachment({ isPDFAttachment: () => false })]]) {
    const { api, calls } = setup();
    assert.equal(await api.send(selection, {}), false);
    assert.equal(calls.launched.length, 0);
    assert.equal(calls.alerts.length, 1);
  }
});

test('menu eligibility rejects notes, missing PDFs, deleted items and multiple selections', () => {
  const { api, items, Zotero } = setup();
  const pdf = attachment();
  items.set(pdf.id, pdf);
  const parent = attachment({ isAttachment: () => false, isRegularItem: () => true, getAttachments: () => [1] });
  assert.equal(api.canSend([parent]), true);
  assert.equal(api.canSend([pdf]), true);
  assert.equal(api.canSend([parent, pdf]), false);
  assert.equal(api.canSend([attachment({ isAttachment: () => false, isRegularItem: () => false })]), false);
  pdf.deleted = true;
  assert.equal(api.canSend([parent]), false);
  Zotero.isWin = false;
  assert.equal(api.canSend([parent]), false);
});

test('saved custom executable is preferred; a stale path falls back to auto-detection', () => {
  const { api, prefs, files } = setup();
  const custom = 'D:\\Apps\\reMarkable.exe';
  prefs.set(api.pathPref, custom);
  files.add(custom);
  assert.equal(api.findExecutable(), custom);
  files.delete(custom);
  assert.equal(api.findExecutable(), 'C:\\Program Files\\reMarkable\\reMarkable.exe');
  assert.equal(api.isExecutable('C:\\Windows\\System32\\cmd.exe'), false);
});

test('app detection supports another drive, Unicode folders, and per-user installs', () => {
  for (const [variable, base, suffix] of [
    ['ProgramW6432', 'R:\\Applications', '\\reMarkable\\reMarkable.exe'],
    ['ProgramFiles(x86)', 'S:\\Apps with spaces', '\\reMarkable\\reMarkable.exe'],
    ['LOCALAPPDATA', 'T:\\Profiles\\Example Person\\Local', '\\Programs\\reMarkable\\reMarkable.exe'],
    ['LOCALAPPDATA', 'U:\\פרופיל\\Local', '\\reMarkable\\reMarkable.exe'],
  ]) {
    const { api, context, files } = setup();
    files.clear();
    files.add(base + suffix);
    context.Services.env.get = key => key === variable ? base : '';
    assert.equal(api.findExecutable(), base + suffix);
  }
});

test('an empty Windows environment falls back to manual selection without guessing a home path', () => {
  const { api, context } = setup();
  context.Services.env.get = () => '';
  assert.equal(api.findExecutable(), null);
});

test('cancelling app selection does not launch or show success', async () => {
  const { api, calls, files } = setup();
  files.clear();
  api.chooseExecutable = async () => null;
  assert.equal(await api.send([attachment()], {}), false);
  assert.equal(calls.notices, 0);
  assert.equal(calls.alerts.length, 0);
});

test('overlapping commands are ignored, and disabling during a download prevents launch', async () => {
  const { api, calls } = setup();
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const sending = api.send([attachment({ getFilePathAsync: () => pending })], {});
  assert.equal(await api.send([attachment()], {}), false);
  api.active = false;
  finish('C:\\paper.pdf');
  assert.equal(await sending, false);
  assert.equal(calls.launched.length, 0);
  assert.equal(api.busy, false);
});

test('OS launch failure reports an error and unlocks the command for retry', async () => {
  const { api, calls } = setup();
  api.launch = () => { throw Error('OS rejected launch'); };
  assert.equal(await api.send([attachment()], {}), false);
  assert.equal(calls.alerts[0], 'OS rejected launch');
  assert.equal(calls.notices, 0);
  assert.equal(api.busy, false);
});
