class fileManager {
  constructor() {
    this.os = require("os");
    this.fs = require("fs");
    this.p = require("path");
    this.events = require("events");
    this.util = require("util");
    this.ffmpeg = require("fluent-ffmpeg");
    this.em = new this.events.EventEmitter();
    this.path = "";
    this.video_formats = [
      ".mp4",
      ".mov",
      ".3gp",
      ".wmv",
      ".wma",
      ".webm",
      ".flv",
      ".avi",
      ".mkv",
    ];
    this.months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
  }

  findPartitions() {
    let self = this;
    this.listDrives().then((data) => self.em.emit("partitions", data));
  }
  listDrives() {
    var spawn = require("child_process").spawn,
      list = spawn("cmd");
    return new Promise((resolve, reject) => {
      list.stdout.on("data", function (data) {
        const output = String(data);
        const out = output
          .split("\r\n")
          .map((e) => e.trim())
          .filter((e) => e != "");
        if (out[0] === "Name") {
          resolve(out.slice(1));
        }
      });

      list.on("exit", function (code) {
        //console.log("child process exited with code " + code);
      });

      list.stdin.write("wmic logicaldisk get name\n");
      list.stdin.end();
    });
  }

  OSpathAdjustment(drive, is_not_drive) {
    let os = this.os;
    let platform = os.platform();
    let self = this;

    if (platform == "win32") {
      self.path = drive + "/";
    }
  }
  //get all files and folders of a drive or directory
  async listDriveData(directory, is_not_drive) {
    this.OSpathAdjustment(directory, is_not_drive);
    let self = this;
    let fs = self.fs;
    let folder = self.path;
    let filecollection = {};
    var i = 0;

    fs.readdir(folder, async (err, files) => {
      for (let file of files) {
        try {
          let temp = await this.getFileStats(file, folder);
          if (temp) {
            filecollection[i] = JSON.parse(JSON.stringify(temp));
            i++;
          }
        } catch (err) {
          console.error("Error reading file:", err);
        }
      }
      self.em.emit("list_drive_data_available", filecollection);
    });
  }

  //scanning for duplicate files
  async scanDuplicate(directory, is_not_drive) {
    this.OSpathAdjustment(directory, is_not_drive);
    let self = this;
    let filecollection = {};
    var i = 0;
    let destination = self.path + "destination/";
    if (!self.fs.existsSync(destination)) {
      self.fs.mkdirSync(destination);
    }

    self.fs.readdir(self.path, async (err, files) => {
      //looping files in directory begins

      for (let file of files) {
        //scanning files and getting info begins
        try {
          let temp = await this.getFileInfo(file, self.path);
          if (temp) {
            filecollection[i] = JSON.parse(JSON.stringify(temp));
            i++;
          }
        } catch (err) {
          console.error("failed:", err);
        }
        //scanning files and getting info begins

        //sending % begins
        let total_files = parseInt(files.length) * 2;
        let total_finished = i;
        let percent = (total_finished / total_files) * 100;
        self.em.emit("percentage_completed", {
          percent: percent,
        });
        self.em.emit("scaning_files", {
          scanned: parseInt(total_finished),
          total: parseInt(files.length),
        });
        //sending % ends
      }

      //looping files in directory ended

      let duplicate_counter = 0;
      try {
        duplicate_counter = await this.getDuplicate(
          filecollection,
          self.path,
          destination,
          self.fs,
          files
        );
      } catch (err) {
        console.error("failed:", err);
      }
      self.em.emit("duplicate_handled", {
        duplicate_counter: duplicate_counter,
        destination: destination,
      });
    });
  }
  async getDuplicate(filecollection, path, destination, fs, files) {
    let self = this;
    const rename = self.util.promisify(fs.rename);
    let duplicate_counter = 0;
    let first_vid_size_in_mb = 0;
    let second_vid_size_in_mb = 0;
    //finding duplicate files
    for (let first in filecollection) {
      if (filecollection[first].has_duplicate) {
        if (filecollection[first].has_duplicate == true) {
          continue;
        }
      }

      if (filecollection[first].has_duplicate == true) {
        continue;
      }

      if (filecollection[first].duration == 0) {
        continue;
      }

      let has_duplicate = false;
      //second loop begins
      for (let second in filecollection) {
        if (second <= first) {
          continue;
        }

        if (filecollection[second].duration == 0) {
          continue;
        }

        if (filecollection[first].duration == filecollection[second].duration) {
          first_vid_size_in_mb = parseInt(
            filecollection[first].size / (1024 * 1024)
          );
          second_vid_size_in_mb = parseInt(
            filecollection[second].size / (1024 * 1024)
          );
          //if (first_vid_size_in_mb == second_vid_size_in_mb) {
          if (first_vid_size_in_mb == second_vid_size_in_mb) {
            has_duplicate = true;
            filecollection[second].has_duplicate = true;
            filecollection[second].duplicate_of =
              first + filecollection[first].name;
          }
        }
      }
      //second loop ended
      if (has_duplicate) {
        duplicate_counter++;
        try {
          filecollection[first].has_duplicate = true;
          filecollection[first].duplicate_of =
            first + filecollection[first].name;
        } catch (err) {
          console.error("failed Error reading file:", err);
        }
        self.em.emit("duplicate_found", {
          duplicate_counter: duplicate_counter,
        });
      }
    }

    //first loop also ended

    //duplicate files moving to new location begins
    let new_destination = destination;
    let total_files = parseInt(files.length) * 2;
    for (let first in filecollection) {
      if (filecollection[first].has_duplicate) {
        if (filecollection[first].has_duplicate == true) {
          try {
            new_destination = destination;

            if (!fs.existsSync(new_destination)) {
              fs.mkdirSync(new_destination);
            }

            await rename(
              path + filecollection[first].name,
              new_destination + filecollection[first].name
            );
          } catch (err) {
            console.error("failed Error reading file:", err);
          }
        }
      }
      //duplicate files moving to new location ended

      //below percentage covers the other 50%(handling duplicate)

      let total_finished = parseInt(files.length) + parseInt(first);
      let percent = (total_finished / total_files) * 100;
      self.em.emit("percentage_completed", {
        percent: percent,
      });
      self.em.emit("seperating_duplicates", {
        scanned: parseInt(first),
        total: parseInt(files.length),
      });
    }
    //end of forloop moving
    return duplicate_counter;
  }
  async getFileInfo(file, folder) {
    let self = this;
    const stat = self.util.promisify(self.fs.stat);
    const ffmpeg_await = self.util.promisify(self.ffmpeg);
    const ffprobe_await = self.util.promisify(ffmpeg_await.ffprobe);
    let videoInfo = {};

    try {
      let stats = await stat(self.path + "/" + file);
      if (stats) {
        if (!stats.isDirectory()) {
          if (
            self.video_formats.indexOf(self.p.extname(folder + file).trim()) !==
            -1
          ) {
            //https://blog.logrocket.com/generating-video-previews-with-node-js-and-ffmpeg/

            try {
              videoInfo = await ffprobe_await(self.path + "/" + file);
            } catch (err) {
              console.error("failed:", err);
            }

            const { duration } = videoInfo.format;

            let temp = {
              name: file,
              was_directory: stats.isDirectory(),
              size: stats.size,
              duration: Math.round(duration),
              path: folder + "/" + file,
              subtitle_path: [],
              birthtime: self.timeConverter(stats["birthtimeMs"]),
            };

            return temp;
          }
        }
      }
    } catch (err) {
      console.error("failed Error reading file:", err);
    }
  }

  async getFileStats(file, folder) {
    let self = this;
    const stat = self.util.promisify(self.fs.stat);
    //const read = self.util.promisify(fs.read);
    //const open = self.util.promisify(fs.open);
    //const readdir = self.util.promisify(fs.readdir);
    try {
      let stats = await stat(self.path + "/" + file);

      if (stats) {
        if (stats.isDirectory()) {
          let temp = {
            name: file,
            was_directory: stats.isDirectory(),
            size: 0,
            duration: 0,
            path: folder + "/" + file,
            subtitle_path: [],
            birthtime: self.timeConverter(stats["birthtimeMs"]),
          };
          return temp;
        } else {
          //let subtitle_formats = [".srt"];
          if (
            self.video_formats.indexOf(self.p.extname(folder + file).trim()) !==
            -1
          ) {
            //var buff = Buffer.alloc(2000);
            try {
              //let open_data = await open(folder + file, "r");

              try {
                let movieLength = 0;
                /*
                this code take 50% performance. boosted from 2634 to 1015ms
                let readed_data = await read(open_data, buff, 0, 100, 0);

                var start =
                  readed_data.buffer.indexOf(Buffer.from("mvhd")) + 17;
                var timeScale = readed_data.buffer.readUInt32BE(start, 4);
                var duration = readed_data.buffer.readUInt32BE(start + 4, 4);
                var movieLength = Math.floor(duration / timeScale);
*/
                //search for subtitles

                let subtitle_path = [];
                /*
                this take over 20000seconds for a 2500 files folder
                let sibling_files = await readdir(folder);
                for (let sfile of sibling_files) {
                  if (
                    subtitle_formats.indexOf(
                      p.extname(folder + sfile).trim()
                    ) !== -1
                  ) {
                    if (p.parse(file).name == p.parse(sfile).name) {
                      subtitle_path.push(folder + sfile);
                    }
                  }
                }
                */
                let temp = {
                  name: file,
                  was_directory: stats.isDirectory(),
                  size: stats.size,
                  duration: movieLength,
                  path: folder + "/" + file,
                  subtitle_path: subtitle_path,
                  birthtime: self.timeConverter(stats["birthtimeMs"]),
                };

                return temp;
              } catch (err) {
                console.error("Error reading file:", err);
              }
            } catch (err) {
              console.error("Error reading file:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error reading file:", err);
      return;
    }
  }

  timeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp);
    let self = this;
    var year = a.getFullYear();
    var month = self.months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time =
      date + " " + month + " " + year + " " + hour + ":" + min + ":" + sec;
    return time;
  }
}

var file_Manager = new fileManager();

exports.data = file_Manager;
//https://ourcodeworld.com/articles/read/420/how-to-read-recursively-a-directory-in-node-js
