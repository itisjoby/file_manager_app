const electron = require("electron");
const url = require("url");
const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, Menu, ipcMain, Tray } = electron;
const file_Manager = require("./controller/fileManager");

let mainWindow;
let addWindow;
let tray = null;
//listen for app ready
app.on("ready", function() {
  tray = new Tray("./assets/icon.png");
  const contextMenu = Menu.buildFromTemplate([
    { label: "Item1", type: "radio" },
    { label: "Item2", type: "radio" },
    { label: "Item3", type: "radio", checked: true }
  ]);
  tray.setToolTip("This is my application.");
  tray.setContextMenu(contextMenu);

  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    }
  });
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "./views/main_window.html"),
      protocol: "file:",
      slashes: true
    })
  );

  mainWindow.on("closed", () => {
    app.quit();
  });

  const mainMenu = Menu.buildFromTemplate(mainMenuList);
  Menu.setApplicationMenu(mainMenu);
});
//menu
const mainMenuList = [
  {
    label: "File",
    submenu: [
      {
        label: "Add Item",
        click() {
          createAddWindow();
        }
      },
      {
        label: "Dialog",
        click() {
          createDialog();
        }
      },
      { label: "Clear Item" },
      {
        label: "Quit",
        accelerator: process.platform == "darwin" ? "Command+Q" : "Ctrl+Q",
        click() {
          app.quit();
        }
      }
    ]
  }
];

if (process.platform == "darwin") {
  mainMenuList.unshift({});
}

function createDialog() {
  const { Notification } = require("electron");
  if (Notification.isSupported()) {
    let not = new Notification({ title: "hello", body: "test content" });
    not.show();
  }
  console.log();
}

function createAddWindow() {
  addWindow = new BrowserWindow({
    width: 300,
    height: 200,
    title: "add item"
  });
  addWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "add_window.html"),
      protocol: "file:",
      slashes: true
    })
  );

  addWindow.on("close", () => {
    addWindow = null;
  });
}

if (process.env.NODE_ENV !== "production") {
  mainMenuList.push({
    label: "developer tools",
    submenu: [
      {
        label: "toggle dev tools",
        accelerator: process.platform == "darwin" ? "Command+I" : "Ctrl+I",
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      },
      {
        role: "reload"
      }
    ]
  });
}

//first call from main window to get filemanager screen
ipcMain.on("open_file_manager", (event, data) => {
  file_Manager.data.findPartitions();
});
//load the folders and files from selected drive
ipcMain.on("drive_choosed", (event, data, is_not_drive) => {
  let drive = data;
  file_Manager.data.listDriveData(drive, is_not_drive);
});
//start duplicate scaning
ipcMain.on("scan_duplicate", (event, data, is_not_drive) => {
  let drive = data;
  file_Manager.data.scanDuplicate(drive, is_not_drive);
});

file_Manager.data.em.on("partitions", function(partitions) {
  mainWindow.webContents.send("partitions", partitions);
});
file_Manager.data.em.on("scaning_files", function(scan_results) {
  mainWindow.webContents.send("scaning_files", scan_results);
});

file_Manager.data.em.on("seperating_duplicates", function(scan_results) {
  mainWindow.webContents.send("seperating_duplicates", scan_results);
});

file_Manager.data.em.on("list_drive_data_available", function(files) {
  let length = Object.keys(files).length;
  if (length > 1000) {
    const chunk_size = 100,
      chunks = [];
    for (const cols = Object.entries(files); cols.length; ) {
      chunks.push(
        cols.splice(0, chunk_size).reduce((o, [k, v]) => ((o[k] = v), o), {})
      );
    }
    let entry = 0;
    for (let packets of chunks) {
      if (entry == 0) {
        mainWindow.webContents.send("list_drive_data_available", packets);
      } else {
        mainWindow.webContents.send(
          "list_drive_partial_data_available",
          packets
        );
      }
      entry++;
    }
  } else {
    mainWindow.webContents.send("list_drive_data_available", files);
  }
});

file_Manager.data.em.on("duplicate_handled", function(data) {
  mainWindow.webContents.send("duplicate_handled", data);
});
file_Manager.data.em.on("percentage_completed", function(data) {
  mainWindow.webContents.send("percentage_completed", data);
});
file_Manager.data.em.on("duplicate_found", function(data) {
  mainWindow.webContents.send("duplicate_found", data);
});
