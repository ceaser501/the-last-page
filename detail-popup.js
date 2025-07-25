// 전역 변수
let currentIndex = 0;
let currentMediaList = [];
let currentImageIndex = 0;
let currentAllSrc = [];
let currentMedia = null; // 현재 미디어 저장용

// 슬라이드쇼 상태
let slideshowInterval = null;
let isSlideshowPlaying = false;

// 수정 모드 상태
let isEditMode = false;

// 상세 팝업 열기
function openDetailPopup(media, mediaList) {
  console.log("✅ [디버그] 상세 팝업 호출됨:", media);
  console.log("✅ media.media_files:", media.media_files);
  console.log("🎵 음악 정보:", media.music);

  currentMediaList = mediaList;
  currentIndex = mediaList.indexOf(media);
  currentImageIndex = 0;
  currentMedia = media; // 현재 미디어 저장
  isEditMode = false; // 수정 모드 초기화

  // 로그인 상태 확인하여 수정 버튼 표시/숨김
  const editBtn = document.getElementById("popup-edit-btn");
  const afterLogin = document.getElementById("after-login");
  if (afterLogin && afterLogin.style.display === "flex") {
    editBtn.style.display = "block";
  } else {
    editBtn.style.display = "none";
  }

  const overlay = document.getElementById("popup-overlay");
  const mainImgContainer = document.getElementById(
    "popup-main-image-container"
  );
  const musicWrapper = document.querySelector(".music-wrapper");
  const thumbList = document.getElementById("popup-thumbnails");

  // 텍스트 정보 세팅
  document.getElementById("popup-title").textContent = media.title || "";
  document.getElementById("popup-thumbnail-title").textContent =
    media.thumbnail_title || "";
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

  // 음악 플레이어 초기화
  resetMusicPlayer();

  // 음악 정보 불러오기ss
  fetchMusicByMemoryId(media.id).then((music) => {
    if (music) {
      musicWrapper.style.display = "flex"; // 플레이어 보이기

      // 음악 제목과 아티스트 설정
      $("#track-name").text(music.music_title || "제목 없음");
      $("#album-name").text(music.artist_name || "아티스트 없음");

      // 자켓 이미지 설정
      const albumImg = $("#album-art img");
      const coverUrl = music.album_cover_url || "data/default-cover.jpg";
      albumImg.attr("src", coverUrl);
      $("#album-art .active").removeClass("active"); // 기존 active 제거
      albumImg.first().addClass("active"); // 첫번째 이미지에 active 추가
      $("#player-bg-artwork").css("background-image", `url(${coverUrl})`);

      // 음악 재생 경로 설정
      if (music.music_url) {
        window.audio.src = music.music_url;
        window.audio.load();

        // duration은 metadata가 로드된 후 설정하는 것이 가장 정확함
        window.audio.onloadedmetadata = () => {
          const totalDurationEl = document.getElementById("track-length");
          const duration = window.audio.duration;
          const minutes = Math.floor(duration / 60);
          const seconds = String(Math.floor(duration % 60)).padStart(2, "0");
          totalDurationEl.textContent = `${minutes}:${seconds}`;
        };
      }
    } else {
      musicWrapper.style.display = "none"; // 플레이어 숨기기
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

// 본문 미디어 렌더링
function renderMainMedia(src) {
  const mainImgContainer = document.getElementById(
    "popup-main-image-container"
  );
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

// 썸네일 하이라이트
function highlightThumbnail(index) {
  const thumbs = document.querySelectorAll(".popup-thumb");
  thumbs.forEach((thumb, i) => {
    thumb.classList.toggle("selected-thumb", i === index);
  });
}

// 닫기 버튼
document.getElementById("popup-close-btn").addEventListener("click", () => {
  closeDetailPopup();
});

function closeDetailPopup() {
  const overlay = document.getElementById("popup-overlay");
  if (overlay.style.display === "none") return;

  overlay.style.display = "none";

  // 🎵 음악 플레이어 초기화
  resetMusicPlayer();

  // 🎞️ 슬라이드쇼 정지
  if (isSlideshowPlaying) {
    clearInterval(slideshowInterval);
    isSlideshowPlaying = false;
    document.getElementById("popup-slideshow-btn").textContent = "▶";
  }

  // 전체화면 해제
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
}

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
document.getElementById("popup-slideshow-btn").addEventListener("click", () => {
  if (!isSlideshowPlaying) {
    isSlideshowPlaying = true;
    document.getElementById("popup-slideshow-btn").textContent = "⏸";
    slideshowInterval = setInterval(() => {
      if (currentIndex < currentMediaList.length - 1) {
        openDetailPopup(currentMediaList[currentIndex + 1], currentMediaList);
      } else {
        clearInterval(slideshowInterval);
        isSlideshowPlaying = false;
        document.getElementById("popup-slideshow-btn").textContent = "▶";
      }
    }, 3000);
  } else {
    clearInterval(slideshowInterval);
    isSlideshowPlaying = false;
    document.getElementById("popup-slideshow-btn").textContent = "▶";
  }
});

// 수정 버튼 클릭 이벤트
document.getElementById("popup-edit-btn").addEventListener("click", () => {
  toggleEditMode();
});

/*******/
/* 음악 플레이어 UI 로직 (jQuery) */
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
    buffInterval = null;

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

  function initPlayer() {
    window.audio = new Audio(); // 전역화
    window.buffInterval = null; // 전역화

    audio.loop = false;

    playPauseButton.on("click", playPause);

    sArea.mousemove(function (event) {
      showHover(event);
    });

    sArea.mouseout(hideHover);

    sArea.on("click", playFromClickedPos);

    $(audio).on("timeupdate", updateCurrTime);

    // 이전/다음 버튼은 메모리 이동으로 대체되었으므로 비활성화 또는 다른 기능 할당 가능
    playPreviousTrackButton.on("click", function () {
      // 이전 메모리로 이동하는 기능 호출
      document.getElementById("popup-prev-btn").click();
    });
    playNextTrackButton.on("click", function () {
      // 다음 메모리로 이동하는 기능 호출
      document.getElementById("popup-next-btn").click();
    });
  }

  initPlayer();
});

function resetMusicPlayer() {
  if (!window.audio) return;

  window.audio.pause();
  window.audio.src = ""; // 소스 제거

  // UI 초기화
  $("#play-pause-button i").attr("class", "fas fa-play");
  $("#player-track").removeClass("active");
  $("#album-art").removeClass("active buffering");
  $("#track-name").text("제목 없음");
  $("#album-name").text("아티스트 없음");
  $("#current-time").text("00:00");
  $("#track-length").text("00:00");
  $("#seek-bar").width(0);
  $("#album-art img").attr("src", "data/default-cover.jpg");
  $("#player-bg-artwork").css("background-image", "none");

  if (window.buffInterval) {
    clearInterval(window.buffInterval);
  }
}

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

// 수정 모드 토글
function toggleEditMode() {
  isEditMode = !isEditMode;
  const editBtn = document.getElementById("popup-edit-btn");

  if (isEditMode) {
    editBtn.textContent = "✓"; // 저장 아이콘
    editBtn.title = "저장";
    enableEditMode();
  } else {
    editBtn.textContent = "✎"; // 수정 아이콘
    editBtn.title = "수정";
    saveChanges();
  }
}

// 수정 모드 활성화
function enableEditMode() {
  // 폼 너비를 위한 컨테이너 너비 계산
  const contentWrapper = document.getElementById("popup-content-wrapper");
  const wrapperWidth = contentWrapper.offsetWidth;
  const inputWidth = `calc(100% - 10px)`; // 스크롤 방지를 위한 여유

  // 제목을 input으로 변경
  const titleEl = document.getElementById("popup-title");

  const titleWrapper = document.createElement("div");
  titleWrapper.style.marginBottom = "15px";
  titleWrapper.style.display = "flex";
  titleWrapper.style.alignItems = "center";
  titleWrapper.style.gap = "10px";

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "제목";
  titleLabel.style.fontWeight = "bold";
  titleLabel.style.minWidth = "50px";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = titleEl.textContent;
  titleInput.id = "popup-title-input";
  titleInput.className = "popup-edit-input";
  titleInput.style.flex = "1";
  titleInput.style.fontSize = titleEl.style.fontSize || "inherit";
  titleInput.style.fontFamily = titleEl.style.fontFamily || "inherit";

  titleWrapper.appendChild(titleLabel);
  titleWrapper.appendChild(titleInput);
  titleEl.parentNode.replaceChild(titleWrapper, titleEl);

  // 설명을 textarea로 변경
  const descEl = document.getElementById("popup-description");

  const descWrapper = document.createElement("div");
  descWrapper.style.marginBottom = "15px";
  descWrapper.style.display = "flex";
  descWrapper.style.alignItems = "flex-start";
  descWrapper.style.gap = "10px";

  const descLabel = document.createElement("label");
  descLabel.textContent = "내용";
  descLabel.style.fontWeight = "bold";
  descLabel.style.minWidth = "50px";
  descLabel.style.marginTop = "5px";

  const descTextarea = document.createElement("textarea");
  descTextarea.value = descEl.textContent;
  descTextarea.id = "popup-description-input";
  descTextarea.className = "popup-edit-textarea";
  descTextarea.rows = 15;
  descTextarea.style.flex = "1";
  descTextarea.style.resize = "vertical";
  descTextarea.style.minHeight = "300px";
  descTextarea.style.maxHeight = "calc(80vh - 250px)";

  descWrapper.appendChild(descLabel);
  descWrapper.appendChild(descTextarea);
  descEl.parentNode.replaceChild(descWrapper, descEl);

  // 날짜를 input[type="date"]로 변경
  const dateEl = document.getElementById("popup-date");
  const dateText = dateEl.textContent.replace("📅", "").trim();

  dateEl.innerHTML = "";
  dateEl.style.marginBottom = "15px";
  dateEl.style.display = "flex";
  dateEl.style.alignItems = "center";
  dateEl.style.gap = "10px";

  const dateLabel = document.createElement("label");
  dateLabel.textContent = "날짜";
  dateLabel.style.fontWeight = "bold";
  dateLabel.style.minWidth = "50px";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = dateText;
  dateInput.id = "popup-date-input";
  dateInput.className = "popup-edit-input";
  dateInput.style.flex = "1";

  dateEl.appendChild(dateLabel);
  dateEl.appendChild(dateInput);

  // 장소를 input으로 변경
  const locationEl = document.getElementById("popup-location");
  const locationText = locationEl.querySelector("span")?.textContent || "";
  locationEl.innerHTML = "";
  locationEl.style.marginBottom = "15px";
  locationEl.style.display = "flex";
  locationEl.style.alignItems = "center";
  locationEl.style.gap = "10px";

  const locationLabel = document.createElement("label");
  locationLabel.textContent = "장소";
  locationLabel.style.fontWeight = "bold";
  locationLabel.style.minWidth = "50px";

  const locationInput = document.createElement("input");
  locationInput.type = "text";
  locationInput.value = locationText;
  locationInput.id = "popup-location-input";
  locationInput.className = "popup-edit-input";
  locationInput.style.flex = "1";

  locationEl.appendChild(locationLabel);
  locationEl.appendChild(locationInput);

  // 노출 순서 input 추가
  const orderEl = document.createElement("div");
  orderEl.style.marginBottom = "15px";
  orderEl.style.display = "flex";
  orderEl.style.alignItems = "center";
  orderEl.style.gap = "10px";

  const orderLabel = document.createElement("label");
  orderLabel.textContent = "노출순서";
  orderLabel.style.minWidth = "50px";

  const orderInput = document.createElement("input");
  orderInput.type = "number";
  orderInput.value = currentMedia.order; // 현재 아이템의 노출 순서
  orderInput.id = "popup-order-input";
  orderInput.className = "popup-edit-input";
  orderInput.style.flex = "1";

  orderEl.appendChild(orderLabel);
  orderEl.appendChild(orderInput);
  locationEl.parentNode.insertBefore(orderEl, locationEl.nextSibling);

  // 태그 편집 가능하게 변경
  const tagsContainer = document.getElementById("popup-tags");
  const currentTags = Array.from(
    tagsContainer.querySelectorAll(".popup-tag")
  ).map((tag) => tag.textContent);

  tagsContainer.innerHTML = "";
  tagsContainer.style.display = "flex";
  tagsContainer.style.alignItems = "center";
  tagsContainer.style.gap = "10px";

  const tagsLabel = document.createElement("label");
  tagsLabel.textContent = "태그";
  tagsLabel.style.minWidth = "50px";

  const tagsInput = document.createElement("input");
  tagsInput.type = "text";
  tagsInput.value = currentTags.join(" ");
  tagsInput.id = "popup-tags-input";
  tagsInput.className = "popup-edit-input";
  tagsInput.placeholder = "태그를 스페이스로 구분하여 입력";
  tagsInput.style.flex = "1";

  tagsContainer.appendChild(tagsLabel);
  tagsContainer.appendChild(tagsInput);
}

// 변경사항 저장
async function saveChanges() {
  const titleInput = document.getElementById("popup-title-input");
  const descInput = document.getElementById("popup-description-input");
  const dateInput = document.getElementById("popup-date-input");
  const locationInput = document.getElementById("popup-location-input");
  const tagsInput = document.getElementById("popup-tags-input");
  const orderInput = document.getElementById("popup-order-input");

  if (!titleInput || !currentMedia) return;

  // 업데이트할 데이터
  const updatedData = {
    title: titleInput.value,
    description: descInput.value,
    date: dateInput.value,
    location: locationInput.value,
    tags: tagsInput.value,
    order: parseInt(orderInput.value, 10),
  };

  try {
    // 디버깅용 로그
    console.log("업데이트할 데이터:", updatedData);
    console.log("현재 미디어 ID:", currentMedia.id);
    console.log("Supabase 클라이언트:", supabase);

    // 현재 데이터 먼저 조회
    const { data: currentData, error: selectError } = await supabase
      .from("memories")
      .select("*")
      .eq("id", currentMedia.id)
      .single();

    console.log("현재 DB 데이터:", currentData);

    if (selectError) {
      console.error("데이터 조회 에러:", selectError);
      alert("데이터 조회 중 오류가 발생했습니다.");
      return;
    }

    // Supabase 업데이트
    const { data, error } = await supabase
      .from("memories")
      .update(updatedData)
      .eq("id", currentMedia.id)
      .select();

    if (error) {
      console.error("Supabase 업데이트 에러:", error);
      console.error("에러 상세:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      alert("저장 중 오류가 발생했습니다: " + error.message);
      return;
    }

    console.log("업데이트 결과:", data);

    // 업데이트 후 다시 조회하여 확인
    const { data: verifyData, error: verifyError } = await supabase
      .from("memories")
      .select("*")
      .eq("id", currentMedia.id)
      .single();

    console.log("업데이트 후 검증 데이터:", verifyData);

    // 현재 미디어 객체 업데이트
    Object.assign(currentMedia, updatedData);

    // UI를 다시 읽기 모드로 변경
    restoreViewMode(updatedData);

    // 성공 메시지
    alert("수정사항이 저장되었습니다!");
  } catch (err) {
    console.error("저장 실패:", err);
    alert("저장 중 오류가 발생했습니다.");
  }
}

// 읽기 모드로 복원
function restoreViewMode(data) {
  // 제목 복원
  const titleWrapper = document.getElementById("popup-title-input").parentNode;
  const titleEl = document.createElement("div");
  titleEl.id = "popup-title";
  titleEl.className = "popup-meta-title";
  titleEl.textContent = data.title;
  titleWrapper.parentNode.replaceChild(titleEl, titleWrapper);

  // 설명 복원
  const descWrapper = document.getElementById(
    "popup-description-input"
  ).parentNode;
  const descEl = document.createElement("div");
  descEl.id = "popup-description";
  descEl.className = "popup-meta-description";
  descEl.textContent = data.description;
  descWrapper.parentNode.replaceChild(descEl, descWrapper);

  // 날짜 복원
  const dateEl = document.getElementById("popup-date");
  dateEl.innerHTML = "";
  const icon = document.createElement("i");
  icon.className = "icon";
  icon.textContent = "📅";
  dateEl.appendChild(icon);
  dateEl.appendChild(document.createTextNode(data.date));

  // 장소 복원
  const locationEl = document.getElementById("popup-location");
  locationEl.innerHTML = "";
  const iconImg = document.createElement("img");
  iconImg.src = "data/location-marker.png";
  iconImg.className = "location-icon";
  iconImg.alt = "장소 아이콘";
  const span = document.createElement("span");
  span.textContent = data.location;
  locationEl.appendChild(iconImg);
  locationEl.appendChild(span);

  // 노출순서 요소 제거 (뷰 모드에서는 표시하지 않음)
  const orderEl = document.getElementById("popup-order-input")?.parentNode;
  if (orderEl) {
    orderEl.remove();
  }

  // 태그 복원
  const tagsContainer = document.getElementById("popup-tags");
  tagsContainer.innerHTML = "";
  if (data.tags) {
    const tagList = data.tags.split(" ").filter((t) => t.trim() !== "");
    tagList.forEach((tag) => {
      const tagElem = document.createElement("span");
      tagElem.className = "popup-tag";
      tagElem.textContent = tag;
      tagsContainer.appendChild(tagElem);
    });
  }
}
