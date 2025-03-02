const electron = require('electron'); // eslint-disable-line
const isDev = require('electron-is-dev');
const unhandled = require('electron-unhandled');
const i18n = require('i18next');
const debounce = require('lodash/debounce');
const yargsParser = require('yargs-parser');
const JSON5 = require('json5');


const menu = require('./menu');
const configStore = require('./configStore');

const { checkNewVersion } = require('./update-checker');

require('./i18n');

const { app } = electron;
const { BrowserWindow } = electron;

// https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse = true;

unhandled({
  showDialog: true,
});

app.name = 'LosslessCut';

let filesToOpen;
let openFileInitial;
let fileOpened = false;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

let askBeforeClose = false;
let rendererReady = false;
let newVersion;

const openFiles = (paths) => mainWindow.webContents.send('openFiles', paths);


// https://github.com/electron/electron/issues/526#issuecomment-563010533
function getSizeOptions() {
  const bounds = configStore.get('windowBounds');
  const options = {};
  if (bounds) {
    const area = electron.screen.getDisplayMatching(bounds).workArea;
    // If the saved position still valid (the window is entirely inside the display area), use it.
    if (
      bounds.x >= area.x
      && bounds.y >= area.y
      && bounds.x + bounds.width <= area.x + area.width
      && bounds.y + bounds.height <= area.y + area.height
    ) {
      options.x = bounds.x;
      options.y = bounds.y;
    }
    // If the saved size is still valid, use it.
    if (bounds.width <= area.width || bounds.height <= area.height) {
      options.width = bounds.width;
      options.height = bounds.height;
    }
  }
  return options;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...getSizeOptions(),
    darkTheme: true,
    webPreferences: {
      enableRemoteModule: true,
      contextIsolation: false,
      nodeIntegration: true,
      // https://github.com/electron/electron/issues/5107
      webSecurity: !isDev,
    },
  });

  if (isDev) mainWindow.loadURL('http://localhost:3001');
  // Need to useloadFile for special characters https://github.com/mifi/lossless-cut/issues/40
  else mainWindow.loadFile('build/index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // https://stackoverflow.com/questions/39574636/prompt-to-save-quit-before-closing-window/47434365
  mainWindow.on('close', (e) => {
    if (!askBeforeClose) return;

    const choice = electron.dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: i18n.t('Confirm quit'),
      message: i18n.t('Are you sure you want to quit?'),
    });
    if (choice === 1) {
      e.preventDefault();
    }
  });

  const debouncedSaveWindowState = debounce(() => {
    if (!mainWindow) return;
    const { x, y, width, height } = mainWindow.getNormalBounds();
    configStore.set('windowBounds', { x, y, width, height });
  }, 500);

  mainWindow.on('resize', debouncedSaveWindowState);
  mainWindow.on('move', debouncedSaveWindowState);
}

function updateMenu() {
  menu(app, mainWindow, newVersion);
}


// https://github.com/electron/electron/issues/3657
// https://github.com/mifi/lossless-cut/issues/357
// https://github.com/mifi/lossless-cut/issues/639
// https://github.com/mifi/lossless-cut/issues/591
function parseCliArgs() {
  const ignoreFirstArgs = isDev ? 2 : 1;
  // production: First arg is the LosslessCut executable
  // dev: First 2 args are electron and the electron.js
  const argsWithoutAppName = process.argv.length > ignoreFirstArgs ? process.argv.slice(ignoreFirstArgs) : [];

  return yargsParser(argsWithoutAppName);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // https://github.com/electron/electron/issues/23757
  // https://github.com/electron/electron/pull/28489
  // TODO I think this can be removed when we are on electron 12 or 14
  if (isDev) {
    electron.protocol.registerFileProtocol('file', (request, callback) => {
      const pathname = decodeURIComponent(request.url.replace('file:///', ''));
      callback(pathname);
    });
  }

  await configStore.init();

  const argv = parseCliArgs();
  console.log('CLI arguments', argv);
  filesToOpen = argv._;
  const { settingsJson } = argv;

  if (settingsJson != null) {
    console.log('initializing settings', settingsJson);
    Object.entries(JSON5.parse(settingsJson)).forEach(([key, value]) => {
      configStore.set(key, value);
    });
  }

  if (isDev) {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer'); // eslint-disable-line global-require,import/no-extraneous-dependencies

    installExtension(REACT_DEVELOPER_TOOLS)
      .then(name => console.log('Added Extension', name))
      .catch(err => console.log('Failed to add extension', err));
  }

  createWindow();
  updateMenu();

  if (!process.windowsStore && !process.mas) {
    newVersion = await checkNewVersion();
    // newVersion = '1.2.3';
    if (newVersion) updateMenu();
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

function openFilesOnce(files) {
  if (fileOpened) return;
  fileOpened = true;
  openFiles(files);
}

electron.ipcMain.on('renderer-ready', () => {
  rendererReady = true;

  if (filesToOpen.length > 0) openFilesOnce(filesToOpen);
  else if (openFileInitial) openFilesOnce([openFileInitial]);
});

// Mac OS open with LosslessCut
app.on('open-file', (event, path) => {
  if (rendererReady) openFilesOnce([path]);
  else openFileInitial = path;
});

electron.ipcMain.on('setAskBeforeClose', (e, val) => {
  askBeforeClose = val;
});

electron.ipcMain.on('setLanguage', (e, language) => {
  i18n.changeLanguage(language).then(() => updateMenu()).catch(console.error);
});

function focusWindow() {
  try {
    app.focus({ steal: true });
  } catch (err) {
    console.error('Failed to focus window', err);
  }
}

module.exports = { focusWindow };
