/* global Zotero, Services, Components */
var RemarkableDesktop = {
  busy: false,
  active: true,
  pathPref: 'extensions.remarkable-desktop.executable',

  canSend(items) {
    if (!Zotero.isWin || items?.length !== 1 || this.busy) return false;
    const item = items[0];
    if (item.deleted) return false;
    if (item.isAttachment()) return item.isPDFAttachment();
    if (!item.isRegularItem()) return false;
    return item.getAttachments().some(id => {
      const attachment = Zotero.Items.get(id);
      return attachment && !attachment.deleted && attachment.isPDFAttachment();
    });
  },

  async resolvePDF(items) {
    if (!Zotero.isWin) throw new Error('This extension requires the reMarkable Windows desktop app.');
    if (items?.length !== 1) throw new Error('Select one PDF or one library item with a PDF attachment.');
    const item = items[0];
    if (item.deleted) throw new Error('Restore this item from the trash before sending it.');
    let attachment;
    if (item.isAttachment() && item.isPDFAttachment()) attachment = item;
    else if (item.isRegularItem()) {
      attachment = (await item.getBestAttachments()).find(a => !a.deleted && a.isPDFAttachment());
    }
    if (!attachment) throw new Error('This item has no PDF attachment. Attach a PDF first.');

    let path = await attachment.getFilePathAsync();
    if (!path && attachment.isStoredFileAttachment()) {
      // Let Zotero use the library's own sync settings and credentials.
      await Zotero.Sync.Runner.downloadFile(attachment);
      path = await attachment.getFilePathAsync();
    }
    if (!path) {
      throw new Error('The PDF is not available on this computer. Download it in Zotero, or repair its linked file, then try again.');
    }
    return { attachment, path };
  },

  makeFile(path) {
    const file = Components.classes['@mozilla.org/file/local;1']
      .createInstance(Components.interfaces.nsIFile);
    file.initWithPath(path);
    return file;
  },

  isExecutable(path) {
    if (!path || !/(?:^|[\\/])reMarkable\.exe$/i.test(path)) return false;
    try {
      const file = this.makeFile(path);
      return file.exists() && file.isFile() && file.isExecutable();
    }
    catch (_) { return false; }
  },

  findExecutable() {
    const paths = [Zotero.Prefs.get(this.pathPref, true)];
    for (const name of ['ProgramW6432', 'ProgramFiles', 'ProgramFiles(x86)']) {
      const base = Services.env.get(name);
      if (base) paths.push(`${base}\\reMarkable\\reMarkable.exe`);
    }
    const local = Services.env.get('LOCALAPPDATA');
    if (local) {
      paths.push(`${local}\\Programs\\reMarkable\\reMarkable.exe`);
      paths.push(`${local}\\reMarkable\\reMarkable.exe`);
    }
    return paths.find(path => this.isExecutable(path)) || null;
  },

  async chooseExecutable(window) {
    const { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
    const picker = new FilePicker();
    picker.init(window, 'Locate the reMarkable desktop app (reMarkable.exe)', picker.modeOpen);
    picker.appendFilter('reMarkable desktop app', 'reMarkable.exe');
    if (await picker.show() !== picker.returnOK) return null;
    if (!this.isExecutable(picker.file)) throw new Error('Choose the installed reMarkable.exe desktop application.');
    Zotero.Prefs.set(this.pathPref, picker.file, true);
    return picker.file;
  },

  launch(executable, path) {
    const process = Components.classes['@mozilla.org/process/util;1']
      .createInstance(Components.interfaces.nsIProcess);
    process.init(this.makeFile(executable));
    // Pass the exact Unicode path as one argument, with no command shell.
    // The app stays open on a cold launch, so do not wait for it to exit.
    process.runw(false, [path], 1);
  },

  showNotice() {
    const progress = new Zotero.ProgressWindow({ closeOnClick: true });
    progress.changeHeadline('Sent to reMarkable desktop');
    progress.addDescription('The desktop app imports the PDF into My files and handles syncing to your tablet.');
    progress.show();
    progress.startCloseTimer(5000);
  },

  async send(items, window) {
    if (this.busy || !this.active) return false;
    this.busy = true;
    try {
      const { path } = await this.resolvePDF(items);
      const executable = this.findExecutable() || await this.chooseExecutable(window);
      if (!executable || !this.active) return false;
      this.launch(executable, path);
      this.showNotice();
      return true;
    }
    catch (error) {
      Zotero.logError(error);
      Zotero.alert(window, 'Send to reMarkable', error.message || String(error));
      return false;
    }
    finally { this.busy = false; }
  },
};
