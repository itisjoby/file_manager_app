let active_notification = 0;
clientListTable = {};
// populating drive list begins
ipcRenderer.on("partitions", function(event, data) {
  let options = '<option value="" disabled selected hidden>Select...</option>';
  for (key in data) {
    let html = `
    <option value='${data[key]}'>${data[key]}</option>
            `;
    options += html;
  }
  $(".partition_container").html(options);
});
//populating drive list ends

//file data
ipcRenderer.on("list_drive_data_available", function(event, data) {
  all_html = ""; //<script src="../third_party/videosub/videosub.js"></script>
  let looped = 0;
  for (key in data) {
    looped++;
    let value = data[key];
    //listing fetched folders and files
    all_html += createHtml(value);
    //listing heading breadcrumbs
    if (looped == Object.keys(data).length) {
      createBreadCrumbs(value);
    }
  }
  $(".file_list_wrapper").html(all_html);

  paginator({
    table: $("table")[0],
    box: document.getElementById("index_native"),
    active_class: "color_page",
    rows_per_page: 50
  });

  var interval = {};

  /*---------------------------------------------------
*show a preview of video on mouse over
-----------------------------------------------------*/
  $(document).on("mouseover", function(e) {
    e.stopImmediatePropagation();
    if (e.target.tagName == "VIDEO") {
      let vid = e.target;
      if ($(vid).find("source").length == 0) {
        //lazy loading
        let link = $(vid)
          .closest(".row")
          .find("input[name='file_name']")
          .val();

        let src = `<source src="${link}" type="video/mp4">`;
        $(vid).append(src);
      }
    }
  });

  $(document).on("click", ".preview-btn", function(e) {
    e.stopImmediatePropagation();
    let vid = $(e.target)
      .closest("td")
      .find("video");
    vid = vid[0];
    if ($(vid).find("source").length == 0) {
      //lazy loading
      let link = $(vid)
        .closest(".row")
        .find("input[name='file_name']")
        .val();

      let src = `<source src="${link}" type="video/mp4">`;
      $(vid).append(src);
    }

    let screenshot_interval = setInterval(() => {
      if (!isNaN(vid.duration)) {
        vid.currentTime = (18 / 100) * vid.duration;
        setTimeout(() => {
          grabScreenshot(vid);
          vid.currentTime = (43 / 100) * vid.duration;
          setTimeout(() => {
            grabScreenshot(vid);
            vid.currentTime = (67 / 100) * vid.duration;
            setTimeout(() => {
              grabScreenshot(vid);
              vid.currentTime = (97 / 100) * vid.duration;
              setTimeout(() => {
                grabScreenshot(vid);
                vid.currentTime = 0;
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);
        clearInterval(screenshot_interval);
      }
    }, 100);
  });
  /*--------------------------------------------
  * play video
  ----------------------------------------------*/
  $(document).on("click", ".play_link", function(e) {
    e.stopImmediatePropagation();
    clearInterval(interval);

    var video = $(this)
      .closest(".row")
      .find("video");
    $(video)[0].requestFullscreen();
  });
});

/*---------------------------------------------------
* onchange of directory, getting all folders
-----------------------------------------------------*/

$(document).on("change", ".partition_container", function(e) {
  e.stopImmediatePropagation();
  ipcRenderer.send("drive_choosed", $(this).val());
});
/*---------------------------------------------------
* onselection of directory, getting all folders
-----------------------------------------------------*/
$(document).on("click", ".directory_container", function(e) {
  e.stopImmediatePropagation();
  let choosed_dir = $(this)
    .find("input[name='file_name']")
    .val();
  ipcRenderer.send("drive_choosed", choosed_dir, true);
  $("body").addClass("waiting");
});

Object.defineProperty(HTMLMediaElement.prototype, "playing", {
  get: function() {
    return !!(
      this.currentTime > 0 &&
      !this.paused &&
      !this.ended &&
      this.readyState > 2
    );
  }
});

function grabScreenshot(video) {
  var ssContainer = $(document)
    .find(video)
    .closest(".row")
    .find("#screenShots");
  if ($(ssContainer).find("img").length <= 4) {
    var canvas = $(document)
      .find(video)
      .closest(".row")
      .find("#canvas");

    var ctx = canvas[0].getContext("2d");
    videoHeight = video.videoHeight;
    videoWidth = video.videoWidth;
    canvas[0].width = videoWidth;
    canvas[0].height = videoHeight;
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    var img = new Image();
    img.src = canvas[0].toDataURL("image/png");
    img.width = 120;
    ssContainer[0].appendChild(img);
  }
}
//partial loading if amount of dat is more it is recieved part by part

ipcRenderer.on("list_drive_partial_data_available", function(event, data) {
  all_html = "";
  for (key in data) {
    let value = data[key];
    //listing all files and folders
    all_html += createHtml(value);
  }
  $(".file_list_wrapper").append(all_html);
  paginator({
    table: $("table")[0],
    box: document.getElementById("index_native"),
    active_class: "color_page",
    rows_per_page: 50
  });
});

$(document).on("click", ".duplicate_scan", function(e) {
  e.stopImmediatePropagation();
  startAnimation();
  let choosed_dir = $("[name='current_path'").val();
  ipcRenderer.send("scan_duplicate", choosed_dir, true);
});

function updateLoadingPercent(percent) {
  percent = percent.toFixed(2);
  $(".progress-bar").attr("aria-valuenow", percent);
  $(".progress-bar").text(percent + "%");
  $(".progress-bar").css("width", percent + "%");
}

function endAnimation() {
  $(".progress").toggleClass("hideNotification");
  $(".progress-bar").attr("aria-valuenow", 0);
  $(".progress-bar").text("0%");
  $(".progress-bar").css("width", "0%");
}
function startAnimation() {
  $(".progress").toggleClass("hideNotification");
}
function showToast(msg, alert_type) {
  active_notification++;
  if (alert_type == 1) {
    $(".notification-box").css("background-color", "#55de55");
  } else {
    $(".notification-box").css("background-color", "red");
  }
  $(".notification-box")
    .text(msg)
    .removeClass("hideNotification");
}

ipcRenderer.on("duplicate_handled", function(event, data) {
  showToast("Dupicate Record search finished!", 1);
  setTimeout(() => {
    hideToast();
  }, 3000);
  endAnimation();
  ipcRenderer.send("drive_choosed", data.destination);
});
ipcRenderer.on("percentage_completed", function(event, data) {
  updateLoadingPercent(data.percent);
});
ipcRenderer.on("duplicate_found", function(event, data) {
  let msg = data.duplicate_counter || "1 new ";

  showToast(msg + " duplicate file found", 0);
  setTimeout(() => {
    hideToast();
  }, 3000);
});
ipcRenderer.on("scaning_files", function(event, data) {
  let msg = `scanning ${data.scanned} out of ${data.total}...`;
  $(".progress-label-box").html(msg);
});

ipcRenderer.on("seperating_duplicates", function(event, data) {
  let msg = `seperating duplicates ${data.scanned} out of ${data.total}...`;
  $(".progress-label-box").html(msg);
});

function hideToast() {
  active_notification--;
  if (active_notification == 0) {
    $(".notification-box").addClass("hideNotification");
  }
}

function createHtml(value) {
  let html = "";
  if (value["was_directory"]) {
    //if directory just a box with directory name

    html += `
            <tr class="directory_container">
            <td>
              <input type="hidden" name="file_name" value="${value["path"]}"/>
              ${value["name"]}
              </td>
            </tr>
        `;
  } else {
    //if file show the file
    subtitle_html = "";
    for (subtitle_path of value.subtitle_path) {
      subtitle_html = `<track label="English" kind="subtitles" srclang="en" src="${subtitle_path}" default>`;
      break;
    }

    html += `
        <tr class="">
        <td>
            <div class="row ">
              <div class="col-sm-6">
                  <input type="hidden" name="file_name" value="${value["path"]}"/>
                  <video width="100%" height="250px" controls class="iamvideo">
                    
                    ${subtitle_html}
                    Your browser does not support HTML5 video.
                  </video>
              </div>
              <div class="col-sm-6 play_link" style="font-weight:bold">
                ${value["name"]}<div class="preview-btn">Preview</div>
                <canvas id="canvas" 
                      width="1920px" height="1080px"
                      style="display:none;">
                </canvas>
                <div class="col-sm-12" id="screenShots"></div>
              </div>
          
            </div>
            </td>
        </tr>
        `;
  }
  return html;
}

function createBreadCrumbs(value) {
  let directories = value["path"].toString().split("//");
  directories.pop();
  let entry = 0;
  let directory_html = "";
  let directory_route = "";
  for (let directory of directories) {
    entry++;
    directory_route = directory_route + directory + "//";
    if (entry == directories.length) {
      //if end
      directory_html += `
                  <li class="breadcrumb-item active">${directory}</li>
                `;
    } else {
      directory_html += `
                      <li class="breadcrumb-item">
                      <a href="#" class="directory_container">
                      <input type="hidden" name="file_name" value="${directory_route}"/>
                      ${directory}
                      </a>
                      </li>
                    `;
    }
    $("ol.history").html(directory_html);
  }
  $("[name='current_path'").val(directory_route);
}
