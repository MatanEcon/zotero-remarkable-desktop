/* global Zotero, Services, APP_SHUTDOWN */
var pluginScope;
var registeredMenu;
var loadedWindows = new Set();

function install() {}
function uninstall() {}

async function startup({ id, rootURI }) {
  pluginScope = { Zotero, Services, Components, ChromeUtils };
  Services.scriptloader.loadSubScript(rootURI + 'remarkable.js', pluginScope, 'UTF-8');
  for (const window of Zotero.getMainWindows()) onMainWindowLoad({ window });
  registeredMenu = Zotero.MenuManager.registerMenu({
    menuID: 'remarkable-desktop-send',
    pluginID: id,
    target: 'main/library/item',
    menus: [{
      menuType: 'menuitem',
      l10nID: 'remarkable-desktop-send',
      icon: rootURI + 'icon.svg',
      onShowing(_event, context) {
        const items = context.items || [];
        context.setVisible(Zotero.isWin && items.length > 0);
        context.setEnabled(pluginScope?.RemarkableDesktop.canSend(items) || false);
      },
      onCommand(event, context) {
        const window = context.menuElem?.ownerGlobal || event.target.ownerGlobal || Zotero.getMainWindow();
        // Snapshot the selected item before the asynchronous download/launch.
        void pluginScope?.RemarkableDesktop.send([...(context.items || [])], window);
      },
    }],
  });
}

function onMainWindowLoad({ window }) {
  if (loadedWindows.has(window)) return;
  window.MozXULElement.insertFTLIfNeeded('remarkable-desktop.ftl');
  loadedWindows.add(window);
}

function onMainWindowUnload({ window }) {
  loadedWindows.delete(window);
}

function shutdown(_data, reason) {
  if (pluginScope) pluginScope.RemarkableDesktop.active = false;
  if (reason === APP_SHUTDOWN) return;
  if (registeredMenu) Zotero.MenuManager.unregisterMenu(registeredMenu);
  for (const window of loadedWindows) {
    window.document.querySelector('link[href="remarkable-desktop.ftl"]')?.remove();
  }
  loadedWindows.clear();
  registeredMenu = null;
  pluginScope = null;
}
