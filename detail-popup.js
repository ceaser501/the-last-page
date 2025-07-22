// 전역 변수
let currentIndex = 0;
let currentMediaList = [];
let currentImageIndex = 0;
let currentAllSrc = [];

// 상세 팝업 열기
function openDetailPopup(media, mediaList) {
  console.log("✅ [디버그] 상세 팝업 호출됨:", media);
  console.log("✅ media.media_files:", media.media_files);
  console.log("🎵 음악 정보:", media.music);

  currentMediaList = mediaList;
  currentIndex = mediaList.indexOf(media);
  currentImageIndex = 0;

  const overlay = document.getElementById("popup-overlay");
  const mainImgContainer = document.getElementById(
    "popup-main-image-container"
  );
  const thumbList = document.getElementById("popup-thumbnails");

  // 텍스트 정보 세팅
  document.getElementById("popup-title").textContent = media.title || "";
  document.getElementById("popup-date").textContent = media.date || "";
  //document.getElementById("popup-location").textContent = media.location || "";

  const locationText = (media.location || "").replace(/\n/g, " ").trim();

  const locationEl = document.getElementById("popup-location");
  locationEl.innerHTML = ""; // 기존 내용을 지우고

  const iconImg = document.createElement("img");
  iconImg.src = "data/location-marker.png";
  iconImg.className = "location-icon";
  iconImg.alt = "장소 아이콘";

  const span = document.createElement("span");
  span.textContent = locationText;

  locationEl.appendChild(iconImg);
  locationEl.appendChild(span);

  document.getElementById("popup-description").textContent =
    media.description || "";

  // 태그 노출
  const tagsContainer = document.getElementById("popup-tags");
  tagsContainer.innerHTML = ""; // 초기화

  // 음악 정보 불러오기
  fetchMusicByMemoryId(media.id).then((music) => {
    if (music) {
      // 음악 제목과 아티스트 설정
      $("#track-name").text(music.music_title || "제목 없음");
      $("#album-name").text(music.artist_name || "아티스트 없음");

      // 자켓 이미지 설정
      const albumImg = $("#album-art img");
      if (albumImg.length > 0) {
        const coverUrl = music.album_cover_url || "data/default-cover.jpg";
        albumImg.attr("src", coverUrl).addClass("active");
        $("#player-bg-artwork").css("background-image", `url(${coverUrl})`);
      }

      // 음악 재생 경로 설정
      if (music && music.music_url) {
        window.audio.src = music.music_url;
        window.audio.load();

        // ✅ duration 처리
        window.audio.onloadedmetadata = () => {
          const totalDurationEl = document.getElementById("track-length");
          const duration = window.audio.duration;
          const minutes = Math.floor(duration / 60);
          const seconds = String(Math.floor(duration % 60)).padStart(2, "0");
          totalDurationEl.textContent = `${minutes}:${seconds}`;
        };
      } else {
        console.warn(
          "⛔ music_url이 비어 있거나 잘못됨:",
          music ? music.music_url : "music 없음"
        );
      }

      // 재생시간 설정
      if (music && music.duration_seconds) {
        const totalDurationEl = document.getElementById("track-length");
        const minutes = Math.floor(music.duration_seconds / 60);
        const seconds = String(music.duration_seconds % 60).padStart(2, "0");
        totalDurationEl.textContent = `${minutes}:${seconds}`;
      }
    } else {
      console.log("🎵 이 기억에는 음악이 등록되어 있지 않습니다.");
    }
  });

  if (media.tags) {
    const tagList = media.tags.split(" ").filter((t) => t.trim() !== "");
    tagList.forEach((tag) => {
      const tagElem = document.createElement("span");
      tagElem.className = "popup-tag";
      tagElem.textContent = tag;
      tagsContainer.appendChild(tagElem);
    });
  }

  // 미디어 리스트 추출
  const mediaFiles = media.media_files || [];
  const allSrc = mediaFiles.map((file) => file.media_url).filter(Boolean);
  currentAllSrc = allSrc;

  thumbList.innerHTML = "";
  mainImgContainer.innerHTML = "";

  // 썸네일 개수에 따라 정렬 방식 설정
  //   if (allSrc.length <= 1) {
  //     thumbList.classList.add("single");
  //   } else {
  //     thumbList.classList.remove("single");
  //   }

  // 본문 미디어 렌더링
  function renderMainMedia(src) {
    mainImgContainer.innerHTML = "";
    if (!src) return;

    if (src.match(/\.(mp4|webm|ogg)$/i)) {
      const video = document.createElement("video");
      video.src = src;
      video.controls = true;
      video.autoplay = true;
      video.style.maxWidth = "100%";
      video.style.borderRadius = "16px";
      video.style.objectFit = "cover";
      mainImgContainer.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = src;
      img.id = "popup-main-image";
      mainImgContainer.appendChild(img);
    }
  }

  // 썸네일 생성
  allSrc.forEach((src, idx) => {
    const thumb = document.createElement("img");
    thumb.className = "popup-thumb";
    if (idx === 0) thumb.classList.add("selected-thumb");

    thumb.addEventListener("click", () => {
      renderMainMedia(src);
      currentImageIndex = idx;
      highlightThumbnail(idx);
    });

    // 비디오 썸네일 캡처
    if (src.match(/\.(mp4|webm|ogg)$/i)) {
      const video = document.createElement("video");
      video.src = src;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.style.display = "none";

      video.addEventListener("loadedmetadata", () => {
        video.currentTime = 0.1;
      });

      video.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 150;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumb.src = canvas.toDataURL("image/jpeg");
        video.remove();
      });

      document.body.appendChild(video);
    } else {
      thumb.src = src;
    }

    thumbList.appendChild(thumb);
  });

  renderMainMedia(allSrc[0]);
  overlay.style.display = "flex";
}

// 썸네일 하이라이트
function highlightThumbnail(index) {
  const thumbs = document.querySelectorAll(".popup-thumb");
  thumbs.forEach((thumb, i) => {
    thumb.classList.toggle("selected-thumb", i === index);
  });
}

// 닫기 버튼
document.getElementById("popup-close-btn").addEventListener("click", () => {
  document.getElementById("popup-overlay").style.display = "none";

  // 🎵 음악 정지
  if (window.audio && !window.audio.paused) {
    window.audio.pause();

    // 재생 아이콘으로 변경
    $("#play-pause-button i").attr("class", "fas fa-play");

    // 시각 효과 제거
    $("#player-track").removeClass("active");
    $("#album-art").removeClass("active buffering");

    // 버퍼링 간격 제거
    if (window.buffInterval) {
      clearInterval(window.buffInterval);
    }
  }
});

// 좌우 이동
document.getElementById("popup-prev-btn").addEventListener("click", () => {
  if (currentIndex > 0) {
    openDetailPopup(currentMediaList[currentIndex - 1], currentMediaList);
  }
});

document.getElementById("popup-next-btn").addEventListener("click", () => {
  if (currentIndex < currentMediaList.length - 1) {
    openDetailPopup(currentMediaList[currentIndex + 1], currentMediaList);
  }
});

// 전체화면
document
  .getElementById("popup-fullscreen-btn")
  .addEventListener("click", () => {
    const container = document.getElementById("popup-main-image-container");
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    }
  });

// 키보드 방향키 탐색
document.addEventListener("keydown", (e) => {
  const overlay = document.getElementById("popup-overlay");
  const isVisible = window.getComputedStyle(overlay).display !== "none";
  const isFullscreen = !!document.fullscreenElement;

  if (!isVisible) return;

  if (isFullscreen) {
    if (
      e.key === "ArrowRight" &&
      currentImageIndex < currentAllSrc.length - 1
    ) {
      currentImageIndex++;
      renderMainMedia(currentAllSrc[currentImageIndex]);
      highlightThumbnail(currentImageIndex);
    } else if (e.key === "ArrowLeft" && currentImageIndex > 0) {
      currentImageIndex--;
      renderMainMedia(currentAllSrc[currentImageIndex]);
      highlightThumbnail(currentImageIndex);
    }
  } else {
    if (e.key === "ArrowRight" && currentIndex < currentMediaList.length - 1) {
      openDetailPopup(currentMediaList[currentIndex + 1], currentMediaList);
    } else if (e.key === "ArrowLeft" && currentIndex > 0) {
      openDetailPopup(currentMediaList[currentIndex - 1], currentMediaList);
    }
  }
});

// 슬라이드쇼
let slideshowInterval = null;
let isPlaying = false;

document.getElementById("popup-slideshow-btn").addEventListener("click", () => {
  if (!isPlaying) {
    isPlaying = true;
    document.getElementById("popup-slideshow-btn").textContent = "⏸";
    slideshowInterval = setInterval(() => {
      if (currentIndex < currentMediaList.length - 1) {
        openDetailPopup(currentMediaList[currentIndex + 1], currentMediaList);
      } else {
        clearInterval(slideshowInterval);
        isPlaying = false;
        document.getElementById("popup-slideshow-btn").textContent = "▶";
      }
    }, 3000);
  } else {
    clearInterval(slideshowInterval);
    isPlaying = false;
    document.getElementById("popup-slideshow-btn").textContent = "▶";
  }
});

/*******/
const currentTime = document.getElementById("current-time");
const totalTime = document.getElementById("track-length");

$(function () {
  const playerTrack = $("#player-track");
  const bgArtwork = $("#player-bg-artwork");
  const albumName = $("#album-name");
  const trackName = $("#track-name");
  const albumArt = $("#album-art");
  const sArea = $("#seek-bar-container");
  const seekBar = $("#seek-bar");
  const trackTime = $("#track-time");
  const seekTime = $("#seek-time");
  const sHover = $("#s-hover");
  const playPauseButton = $("#play-pause-button");
  const tProgress = $("#current-time");
  const tTime = $("#track-length");
  const playPreviousTrackButton = $("#play-previous");
  const playNextTrackButton = $("#play-next");
  const albums = [
    "Me & You",
    "Dawn",
    "Electro Boy",
    "Home",
    "Proxy (Original Mix)",
  ];
  const trackNames = [
    "Alex Skrindo - Me & You",
    "Skylike - Dawn",
    "Kaaze - Electro Boy",
    "Jordan Schor - Home",
    "Martin Garrix - Proxy",
  ];
  const albumArtworks = ["_1", "_2", "_3", "_4", "_5"];
  const trackUrl = [
    "https://singhimalaya.github.io/Codepen/assets/music/1.mp3",
    "https://singhimalaya.github.io/Codepen/assets/music/2.mp3",
    "https://singhimalaya.github.io/Codepen/assets/music/3.mp3",
    "https://singhimalaya.github.io/Codepen/assets/music/4.mp3",
    "https://singhimalaya.github.io/Codepen/assets/music/5.mp3",
  ];

  let bgArtworkUrl,
    i = playPauseButton.find("i"),
    seekT,
    seekLoc,
    seekBarPos,
    cM,
    ctMinutes,
    ctSeconds,
    curMinutes,
    curSeconds,
    durMinutes,
    durSeconds,
    playProgress,
    bTime,
    nTime = 0,
    buffInterval = null,
    tFlag = false,
    currIndex = -1;

  function playPause() {
    setTimeout(function () {
      if (audio.paused) {
        playerTrack.addClass("active");
        albumArt.addClass("active");
        checkBuffering();
        i.attr("class", "fas fa-pause");
        audio.play();
      } else {
        playerTrack.removeClass("active");
        albumArt.removeClass("active");
        clearInterval(buffInterval);
        albumArt.removeClass("buffering");
        i.attr("class", "fas fa-play");
        audio.pause();
      }
    }, 300);
  }

  function showHover(event) {
    seekBarPos = sArea.offset();
    seekT = event.clientX - seekBarPos.left;
    seekLoc = audio.duration * (seekT / sArea.outerWidth());

    sHover.width(seekT);

    cM = seekLoc / 60;

    ctMinutes = Math.floor(cM);
    ctSeconds = Math.floor(seekLoc - ctMinutes * 60);

    if (ctMinutes < 0 || ctSeconds < 0) return;

    if (ctMinutes < 0 || ctSeconds < 0) return;

    if (ctMinutes < 10) ctMinutes = "0" + ctMinutes;
    if (ctSeconds < 10) ctSeconds = "0" + ctSeconds;

    if (isNaN(ctMinutes) || isNaN(ctSeconds)) seekTime.text("--:--");
    else seekTime.text(ctMinutes + ":" + ctSeconds);

    seekTime.css({ left: seekT, "margin-left": "-21px" }).fadeIn(0);
  }

  function hideHover() {
    sHover.width(0);
    seekTime
      .text("00:00")
      .css({ left: "0px", "margin-left": "0px" })
      .fadeOut(0);
  }

  function playFromClickedPos() {
    audio.currentTime = seekLoc;
    seekBar.width(seekT);
    hideHover();
  }

  function updateCurrTime() {
    nTime = new Date();
    nTime = nTime.getTime();

    if (!tFlag) {
      tFlag = true;
      trackTime.addClass("active");
    }

    curMinutes = Math.floor(audio.currentTime / 60);
    curSeconds = Math.floor(audio.currentTime - curMinutes * 60);

    durMinutes = Math.floor(audio.duration / 60);
    durSeconds = Math.floor(audio.duration - durMinutes * 60);

    playProgress = (audio.currentTime / audio.duration) * 100;

    if (curMinutes < 10) curMinutes = "0" + curMinutes;
    if (curSeconds < 10) curSeconds = "0" + curSeconds;

    if (durMinutes < 10) durMinutes = "0" + durMinutes;
    if (durSeconds < 10) durSeconds = "0" + durSeconds;

    if (isNaN(curMinutes) || isNaN(curSeconds)) tProgress.text("00:00");
    else tProgress.text(curMinutes + ":" + curSeconds);

    if (isNaN(durMinutes) || isNaN(durSeconds)) tTime.text("00:00");
    else tTime.text(durMinutes + ":" + durSeconds);

    if (
      isNaN(curMinutes) ||
      isNaN(curSeconds) ||
      isNaN(durMinutes) ||
      isNaN(durSeconds)
    )
      trackTime.removeClass("active");
    else trackTime.addClass("active");

    seekBar.width(playProgress + "%");

    if (playProgress == 100) {
      i.attr("class", "fa fa-play");
      seekBar.width(0);
      tProgress.text("00:00");
      albumArt.removeClass("buffering").removeClass("active");
      clearInterval(buffInterval);
    }
  }

  function checkBuffering() {
    clearInterval(buffInterval);
    buffInterval = setInterval(function () {
      if (nTime == 0 || bTime - nTime > 1000) albumArt.addClass("buffering");
      else albumArt.removeClass("buffering");

      bTime = new Date();
      bTime = bTime.getTime();
    }, 100);
  }

  function selectTrack(flag) {
    if (flag == 0 || flag == 1) ++currIndex;
    else --currIndex;

    if (currIndex > -1 && currIndex < albumArtworks.length) {
      if (flag == 0) i.attr("class", "fa fa-play");
      else {
        albumArt.removeClass("buffering");
        i.attr("class", "fa fa-pause");
      }

      seekBar.width(0);
      trackTime.removeClass("active");
      tProgress.text("00:00");
      tTime.text("00:00");

      currAlbum = albums[currIndex];
      currTrackName = trackNames[currIndex];
      currArtwork = albumArtworks[currIndex];

      audio.src = trackUrl[currIndex];

      nTime = 0;
      bTime = new Date();
      bTime = bTime.getTime();

      if (flag != 0) {
        audio.play();
        playerTrack.addClass("active");
        albumArt.addClass("active");

        clearInterval(buffInterval);
        checkBuffering();
      }

      albumName.text(currAlbum);
      trackName.text(currTrackName);
      albumArt.find("img.active").removeClass("active");
      $("#" + currArtwork).addClass("active");

      bgArtworkUrl = $("#" + currArtwork).attr("src");

      bgArtwork.css({ "background-image": "url(" + bgArtworkUrl + ")" });
    } else {
      if (flag == 0 || flag == 1) --currIndex;
      else ++currIndex;
    }
  }

  function initPlayer() {
    window.audio = new Audio(); // 전역화
    window.buffInterval = null; // 전역화

    selectTrack(0);

    audio.loop = false;

    playPauseButton.on("click", playPause);

    sArea.mousemove(function (event) {
      showHover(event);
    });

    sArea.mouseout(hideHover);

    sArea.on("click", playFromClickedPos);

    $(audio).on("timeupdate", updateCurrTime);

    playPreviousTrackButton.on("click", function () {
      selectTrack(-1);
    });
    playNextTrackButton.on("click", function () {
      selectTrack(1);
    });
  }

  initPlayer();
});

// memory-music 에서 데이터 불러오기
async function fetchMusicByMemoryId(memoryId) {
  const { data, error } = await supabase
    .from("memory_music")
    .select("*")
    .eq("memory_id", memoryId)
    .single();

  if (error) {
    console.error("🎵 음악 정보 불러오기 실패:", error);
    return null;
  }

  let musicUrl = null;
  let albumUrl = null;

  // music_path가 있을 경우, bucket: media, folder: music
  if (data.music_path) {
    const { data: musicData } = supabase.storage
      .from("media")
      .getPublicUrl(data.music_path);
    musicUrl = musicData?.publicUrl;
  }

  // album_path가 있을 경우, bucket: media, folder: album
  if (data.album_path) {
    const cleanPath = data.album_path.trim();
    const { data: albumData } = supabase.storage
      .from("media")
      .getPublicUrl(cleanPath);
    albumUrl = albumData?.publicUrl;
  }

  return {
    ...data,
    music_url: musicUrl,
    album_cover_url: albumUrl,
  };
}
