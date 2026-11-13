// Desktop shell (Windows / macOS / Linux). Loads the bundled site from ./www.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 640,
    backgroundColor: '#FFF8EE',
    title: 'Turtle Beach Huts Karachi',
    icon: path.join(__dirname, '..', 'www', 'images', 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  // open external links (WhatsApp, social, maps) in the real browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (/^(https?|tel|mailto):/.test(url) && !url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
