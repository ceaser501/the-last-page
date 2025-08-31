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

// 🔥 성능 최적화: 메모리 캐싱 시스템
let mediaDataCache = new Map(); // 로드한 미디어 데이터 캐시
let thumbnailTimeouts = []; // 썸네일 타이머 관리
let thumbnailQueue = []; // 썸네일 로딩 큐
let isLoadingThumbnails = false; // 썸네일 로딩 상태

// 이미지 확대/축소 및 패닝(이동) 상태 변수
let zoomLevel = 1;
let isDragging = false;
let startPos = { x: 0, y: 0 };
let imgPos = { x: 0, y: 0 };
const ZOOM_STEP = 0.2;
const MAX_ZOOM = 3;
const MIN_ZOOM = 1;

// 기본 앨범 커버 URL (Supabase에서 전체 경로 가져오기)
const { data: defaultCoverData } = window.supabaseClient.storage
  .from("media")
  .getPublicUrl("album/default-cover.jpg");
const DEFAULT_ALBUM_COVER_URL = defaultCoverData.publicUrl;

// 상세 팝업 열기
async function openDetailPopup(media, mediaList) {
  // 메인 음악 일시정지
  if (typeof pauseMainMusic === "function") {
    pauseMainMusic();
  }

  // 🎵 기존 팝업 음악 정지 (슬라이드 전환 시 중복 재생 방지)
  if (window.audio) {
    window.audio.pause();
    window.audio.currentTime = 0;
    console.log("🎵 기존 팝업 음악 정지");
  }

  // 🔥 기존 썸네일 로딩 작업 정리 (네트워크 리소스 절약)
  clearThumbnailQueue();

  currentMediaList = mediaList;
  // ID 기반으로 인덱스 찾기 (객체 참조 문제 해결)
  currentIndex = mediaList.findIndex(m => m.id === media.id);
  currentImageIndex = 0;
  currentMedia = media;
  isEditMode = false;

  console.log("🔍 팝업 열기 - media.id:", media.id, "currentIndex:", currentIndex);

  try {
    let fullMedia;

    // 🚀 캐시 확인 - 이미 로드한 데이터가 있으면 DB 쿼리 생략
    if (mediaDataCache.has(media.id)) {
      console.log("🔄 캐시에서 데이터 로드:", media.id);
      fullMedia = mediaDataCache.get(media.id);
    } else {
      console.log("📡 DB에서 새 데이터 로드:", media.id);
      // 상세 팝업에서 전체 미디어 데이터 로드
      const { data, error } = await window.supabaseClient
        .from("memories")
        .select("*, media_files(order:file_order, media_url, is_main, file_order)")
        .eq("id", media.id)
        .single();

      if (error) {
        console.error("상세 미디어 로드 실패:", error);
        alert("미디어 정보를 불러오는데 실패했습니다.");
        return;
      }

      fullMedia = data;
      // 🗄️ 캐시에 저장 (최대 50개까지만 저장하여 메모리 관리)
      if (mediaDataCache.size >= 50) {
        const firstKey = mediaDataCache.keys().next().value;
        mediaDataCache.delete(firstKey);
      }
      mediaDataCache.set(media.id, fullMedia);
    }

    // 팝업 내용 렌더링 (로딩 메시지 없이 바로 표시)
    await renderDetailPopupContent(fullMedia);
    
    // 팝업 표시
    const overlay = document.getElementById("popup-overlay");
    overlay.style.display = "flex";
    
    // 🔮 인접 슬라이드 프리로드 (백그라운드에서)
    preloadAdjacentSlides();
    
  } catch (error) {
    console.error("상세 팝업 로드 중 오류:", error);
    alert("미디어 정보를 불러오는데 실패했습니다.");
  }
}

// 🔮 인접 슬라이드 프리로딩 (백그라운드에서 다음/이전 슬라이드 데이터 미리 로드)
async function preloadAdjacentSlides() {
  if (!currentMediaList || currentMediaList.length <= 1) return;
  
  const preloadTasks = [];
  
  // 이전 슬라이드 프리로드
  if (currentIndex > 0) {
    const prevMedia = currentMediaList[currentIndex - 1];
    if (!mediaDataCache.has(prevMedia.id)) {
      preloadTasks.push(preloadSingleSlide(prevMedia.id));
    }
  }
  
  // 다음 슬라이드 프리로드
  if (currentIndex < currentMediaList.length - 1) {
    const nextMedia = currentMediaList[currentIndex + 1];
    if (!mediaDataCache.has(nextMedia.id)) {
      preloadTasks.push(preloadSingleSlide(nextMedia.id));
    }
  }
  
  // 백그라운드에서 실행 (에러가 발생해도 메인 기능에 영향 없음)
  Promise.all(preloadTasks).catch(error => {
    console.log("🔮 프리로드 중 일부 실패 (무시됨):", error);
  });
}

// 단일 슬라이드 프리로딩
async function preloadSingleSlide(mediaId) {
  try {
    console.log("🔮 프리로드 시작:", mediaId);
    const { data, error } = await window.supabaseClient
      .from("memories")
      .select("*, media_files(order:file_order, media_url, is_main, file_order)")
      .eq("id", mediaId)
      .single();
      
    if (!error) {
      mediaDataCache.set(mediaId, data);
      console.log("✅ 프리로드 완료:", mediaId);
    }
  } catch (error) {
    console.log("❌ 프리로드 실패:", mediaId, error);
  }
}

// 상세 팝업 내용 렌더링
async function renderDetailPopupContent(media) {
  currentMedia = media;

  // 🎵 기존 음악 플레이어 정리 (HTML 재생성 전에 정리)
  resetMusicPlayer();

  // 팝업 HTML 구조 복원 (원본 구조 유지)
  const overlay = document.getElementById("popup-overlay");
  overlay.innerHTML = `
    <!-- 네비게이션 버튼들을 overlay 레벨에 배치 -->
    <button id="popup-prev-btn" class="popup-nav">‹</button>
    <button id="popup-next-btn" class="popup-nav">›</button>

    <div class="detail-popup">
      <div class="popup-controls">
        <button id="popup-slideshow-btn" title="슬라이드쇼">▶</button>
        <button id="popup-fullscreen-btn" title="전체화면">⛶</button>
        <button id="popup-close-btn" title="닫기">✕</button>
      </div>

      <div class="popup-left">
        <div id="popup-main-image-container" src=""></div>
        <div id="popup-thumbnails" class="thumbnail-list"></div>
      </div>
      <div class="popup-right">
        <!-- 팝업 내부 우측 [음악 플레이어]-->
        <div class="music-wrapper" style="display: none;">
          <div class="music-player-container">
            <div id="player-bg-artwork"></div>
            <div id="player-bg-layer"></div>
            <div id="player-container">
              <div id="player">
                <div id="player-track">
                  <span id="album-name"></span>
                  <span id="track-name"></span>
                  <div id="track-time">
                    <div id="current-time"></div>
                    <div id="track-length"></div>
                  </div>
                  <div id="seek-bar-container">
                    <div id="seek-time"></div>
                    <div id="s-hover"></div>
                    <div id="seek-bar"></div>
                  </div>
                </div>
                <div id="player-content">
                  <div id="album-art">
                    <img src="" class="active" id="_1" />
                    <div id="buffer-box">Buffering ...</div>
                  </div>
                  <div id="player-controls">
                    <div class="control">
                      <div class="button" id="play-previous">
                        <i class="fas fa-backward"></i>
                      </div>
                    </div>
                    <div class="control">
                      <div class="button" id="play-pause-button">
                        <i class="fas fa-play"></i>
                      </div>
                    </div>
                    <div class="control">
                      <div class="button" id="play-next">
                        <i class="fas fa-forward"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="info-texts">
          <div id="popup-content-wrapper">
            <!-- 팝업 내부 우측 [썸네일 제목] (숨김) -->
            <div id="popup-thumbnail-title" class="popup-meta-thumbnail" style="display: none"></div>
            <!-- 팝업 내부 우측 [제목]과 버튼들 -->
            <div class="popup-title-row">
              <div id="popup-title" class="popup-meta-title"></div>
              <div class="popup-action-buttons">
                <button id="popup-music-change-btn" class="auth-btn control-btn-group primary" style="display: none">
                  음악변경
                </button>
                <button id="popup-add-media-btn" class="auth-btn control-btn-group primary" style="display: none">
                  파일업로드
                </button>
                <button id="popup-edit-btn" class="auth-btn control-btn-group primary" style="display: none">
                  수정
                </button>
                <button id="popup-delete-btn" class="auth-btn control-btn-group secondary" style="display: none">
                  삭제
                </button>
              </div>
            </div>
            <!-- 팝업 내부 우측 [내용]-->
            <div id="popup-description" class="popup-meta-description"></div>
            <!-- 팝업 내부 우측 [달력/날짜]-->
            <div id="popup-date" class="popup-meta">
              <i class="icon">📅</i>
            </div>
            <!-- 팝업 내부 우측 [장소]-->
            <div id="popup-location" class="popup-meta"></div>
            <!-- 팝업 내부 우측 [태그]-->
            <div id="popup-tags" class="popup-tags"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 이벤트 리스너 재설정
  setupPopupEventListeners();

  // 음악 플레이어 초기화 (HTML이 새로 생성되었으므로 다시 초기화 필요)
  initPlayer();

  // 폴라로이드 번호 계산 (배열 인덱스 + 1)
  const polaroidNumber = currentIndex + 1;

  // 로그인 상태 확인하여 수정/삭제/미디어 추가/음악변경 버튼 표시/숨김
  const editBtn = document.getElementById("popup-edit-btn");
  const addMediaBtn = document.getElementById("popup-add-media-btn");
  const deleteBtn = document.getElementById("popup-delete-btn");
  const musicChangeBtn = document.getElementById("popup-music-change-btn");
  const afterLogin = document.getElementById("after-login");
  if (afterLogin && afterLogin.style.display === "flex") {
    editBtn.style.display = "block";
    addMediaBtn.style.display = "block";
    deleteBtn.style.display = "block";
    musicChangeBtn.style.display = "block";
  } else {
    editBtn.style.display = "none";
    addMediaBtn.style.display = "none";
    deleteBtn.style.display = "none";
    musicChangeBtn.style.display = "none";
  }

  const mainImgContainer = document.getElementById("popup-main-image-container");
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

      // 음악 제목과 아티스트 설정 (위치 수정: album-name에 제목, track-name에 가수)
      $("#album-name").text(music.music_title || "제목 없음");
      $("#track-name").text(music.artist_name || "아티스트 없음");

      // 자켓 이미지 설정
      const albumImg = $("#album-art img");
      const coverUrl = music.album_cover_url || DEFAULT_ALBUM_COVER_URL;
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

          console.log(
            "🎵 [디버그] 팝업 음악 메타데이터 로드 완료 (자동 재생 안 함)"
          );
          // 자동 재생하지 않음 - 사용자가 재생 버튼을 클릭할 때만 재생
          
          // UI 업데이트 (일시정지 상태로 표시)
          $("#play-pause-button i").attr("class", "fas fa-play");
          $("#player-track").removeClass("active");
          $("#album-art").removeClass("active");
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

  // 미디어 리스트 추출 및 file_order로 정렬
  let mediaFiles = media.media_files || [];

  // 현재 폴라로이드 번호를 기준으로 예상 접두사 설정
  let expectedPrefix = polaroidNumber.toString();

  // 기존 파일에서 접두사를 확인하여 일치하는지 검증
  if (mediaFiles.length > 0) {
    const firstFile = mediaFiles[0];
    if (firstFile && firstFile.media_url) {
      const firstFileName = firstFile.media_url.split("/").pop();
      const match = firstFileName.match(/^(\d+)_/);
      if (match) {
        const detectedPrefix = match[1];
        if (detectedPrefix !== expectedPrefix) {
          // 기존 파일의 접두사를 우선 사용 (호환성 위해)
          expectedPrefix = detectedPrefix;
        }
      }
    }
  }

  // 동일한 접두사를 가진 파일들만 유지 (다른 메모리 파일 제거)
  mediaFiles = mediaFiles.filter((file) => {
    const fileName = file.media_url.split("/").pop();
    return fileName.startsWith(expectedPrefix + "_");
  });

  // file_order 순서대로 정렬 (대표이미지는 맨 앞)
  const sortedMediaFiles = mediaFiles.sort((a, b) => {
    // 대표이미지는 무조건 맨 앞
    if (a.is_main && !b.is_main) return -1;
    if (!a.is_main && b.is_main) return 1;

    // file_order로 정렬 (숫자 비교)
    const aOrder = a.file_order || 0;
    const bOrder = b.file_order || 0;
    return aOrder - bOrder;
  });

  const allSrc = sortedMediaFiles.map((file) => file.media_url).filter(Boolean);
  currentAllSrc = allSrc;

  thumbList.innerHTML = "";
  mainImgContainer.innerHTML = "";

  // 썸네일 생성
  allSrc.forEach((src, idx) => {
    // 비디오 썸네일 캡처
    if (src.match(/\.(mp4|webm|ogg)$/i)) {
      // 비디오용 컨테이너 생성
      const videoContainer = document.createElement("div");
      videoContainer.className = "popup-thumb-video-container";
      videoContainer.style.position = "relative";
      videoContainer.style.display = "block";
      videoContainer.style.width = "48px";
      //videoContainer.style.height = "48px";
      videoContainer.style.flexShrink = "0";

      const thumb = document.createElement("img");
      thumb.className = "popup-thumb";
      thumb.loading = "lazy";
      if (idx === 0) thumb.classList.add("selected-thumb");

      // 비디오 썸네일 플레이스홀더 설정
      thumb.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='53' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23f0f0f0'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-family='Arial' font-size='8'>로딩중</text></svg>";
      thumb.setAttribute("data-video-src", src);
      thumb.setAttribute("data-video-thumbnail", "pending");

      // 플레이 아이콘 생성
      const playIcon = document.createElement("div");
      playIcon.className = "popup-thumb-play-icon";
      playIcon.innerHTML = "▶";
      playIcon.style.position = "absolute";
      playIcon.style.top = "50%";
      playIcon.style.left = "55%";
      playIcon.style.transform = "translate(-50%, -55%)";
      playIcon.style.fontSize = "20px";
      playIcon.style.color = "white";
      playIcon.style.textShadow = "1px 1px 3px black";
      playIcon.style.pointerEvents = "none";
      playIcon.style.zIndex = "1";

      videoContainer.appendChild(thumb);
      videoContainer.appendChild(playIcon);

      videoContainer.addEventListener("click", () => {
        renderMainMedia(src);
        currentImageIndex = idx;
        highlightThumbnail(idx);
      });

      thumbList.appendChild(videoContainer);

      // 🔥 우선순위 기반 썸네일 로딩 큐에 추가
      // 처음 3개는 높은 우선순위(0-2), 나머지는 낮은 우선순위
      const priority = idx < 3 ? idx : idx + 10;
      addToThumbnailQueue(thumb, priority);
    } else {
      // 이미지용 썸네일
      const thumb = document.createElement("img");
      thumb.className = "popup-thumb";
      thumb.loading = "lazy"; // 지연 로딩 추가
      if (idx === 0) thumb.classList.add("selected-thumb");

      thumb.addEventListener("click", () => {
        renderMainMedia(src);
        currentImageIndex = idx;
        highlightThumbnail(idx);
      });

      // 🔥 썸네일 이미지 에러 핸들링 추가
      thumb.addEventListener("error", (e) => {
        console.error("❌ 팝업 썸네일 이미지 로딩 실패:", src);
        console.error("🔍 썸네일 에러 상세:", {
          url: src,
          index: idx,
          naturalWidth: thumb.naturalWidth,
          naturalHeight: thumb.naturalHeight,
          complete: thumb.complete,
          currentSrc: thumb.currentSrc
        });
        
        thumb.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='53' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23ffebee'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23c62828' font-family='Arial' font-size='7'>실패</text></svg>";
      });

      thumb.src = src;
      thumbList.appendChild(thumb);
    }
  });

  renderMainMedia(allSrc[0]);
}

// 팝업용 비디오 썸네일 생성 함수 - 개선된 에러 핸들링 및 타이머 관리
function generatePopupVideoThumbnail(thumbnailImg, retryCount = 0) {
  const videoSrc = thumbnailImg.getAttribute("data-video-src");
  if (!videoSrc) return;
  
  thumbnailImg.setAttribute("data-video-thumbnail", "loading");
  
  const videoForThumb = document.createElement("video");
  videoForThumb.src = videoSrc;
  videoForThumb.crossOrigin = "anonymous";
  videoForThumb.muted = true;
  videoForThumb.playsInline = true;
  videoForThumb.preload = "metadata";
  videoForThumb.style.display = "none";

  let isCompleted = false;
  let timeoutId = null;

  // 🔥 타임아웃 설정 (15초 후 강제 실패 - 재시도 시 더 긴 시간)
  const timeout = 15000 + (retryCount * 5000); // 재시도마다 5초씩 추가
  timeoutId = setTimeout(() => {
    if (!isCompleted) {
      console.warn(`⏰ 비디오 썸네일 생성 타임아웃 (시도 ${retryCount + 1}):`, videoSrc);
      handleThumbnailError();
    }
  }, timeout);

  function cleanup() {
    isCompleted = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    try {
      videoForThumb.remove();
    } catch (e) {
      // 이미 제거된 경우 무시
    }
  }

  function handleThumbnailError() {
    cleanup();
    
    // 🔄 재시도 로직 (최대 3회)
    if (retryCount < 3) {
      console.log(`🔄 썸네일 생성 재시도 (${retryCount + 1}/3):`, videoSrc);
      
      // 지수적 백오프로 재시도 (1초, 2초, 4초)
      const delay = 1000 * Math.pow(2, retryCount);
      setTimeout(() => {
        generatePopupVideoThumbnail(thumbnailImg, retryCount + 1);
      }, delay);
      return;
    }

    // 최종 실패 - 재시도 가능한 에러 이미지 표시
    thumbnailImg.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='53' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23ffebee'/><text x='50%25' y='45%25' text-anchor='middle' dy='.3em' fill='%23c62828' font-family='Arial' font-size='7'>재시도</text></svg>";
    thumbnailImg.setAttribute("data-video-thumbnail", "error");
    thumbnailImg.style.cursor = "pointer";
    
    // 클릭 시 재시도
    thumbnailImg.onclick = function() {
      console.log("👆 수동 재시도:", videoSrc);
      thumbnailImg.style.cursor = "default";
      thumbnailImg.onclick = null;
      generatePopupVideoThumbnail(thumbnailImg, 0); // 재시도 카운트 리셋
    };
  }

  videoForThumb.addEventListener("loadedmetadata", () => {
    if (!isCompleted) {
      videoForThumb.currentTime = 0.1;
    }
  });

  videoForThumb.addEventListener("seeked", () => {
    if (isCompleted) return;
    
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 53;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoForThumb, 0, 0, canvas.width, canvas.height);
      const dataURL = canvas.toDataURL("image/jpeg", 0.8);
      thumbnailImg.src = dataURL;
      thumbnailImg.setAttribute("data-video-thumbnail", "loaded");
      
      console.log("✅ 비디오 썸네일 생성 완료:", videoSrc);
      cleanup();
    } catch (error) {
      console.error("❌ Canvas 렌더링 실패:", error);
      handleThumbnailError();
    }
  });

  videoForThumb.addEventListener("error", (e) => {
    console.error("❌ 비디오 로딩 실패:", videoSrc, e);
    handleThumbnailError();
  });

  // 🔥 네트워크 상태 체크 추가
  videoForThumb.addEventListener("stalled", () => {
    console.warn("⚠️ 비디오 로딩 지연:", videoSrc);
  });

  videoForThumb.addEventListener("suspend", () => {
    console.warn("⚠️ 비디오 로딩 일시정지:", videoSrc);
  });

  document.body.appendChild(videoForThumb);
}

// 🔥 썸네일 로딩 큐 관리 시스템
function clearThumbnailQueue() {
  // 기존 타이머들 모두 정리
  thumbnailTimeouts.forEach(timeoutId => {
    clearTimeout(timeoutId);
  });
  thumbnailTimeouts = [];
  thumbnailQueue = [];
  isLoadingThumbnails = false;
}

function addToThumbnailQueue(thumbnailImg, priority = 0) {
  thumbnailQueue.push({ thumbnailImg, priority });
  
  // 우선순위별로 정렬 (0이 가장 높은 우선순위)
  thumbnailQueue.sort((a, b) => a.priority - b.priority);
  
  if (!isLoadingThumbnails) {
    processThumbnailQueue();
  }
}

function processThumbnailQueue() {
  if (thumbnailQueue.length === 0) {
    isLoadingThumbnails = false;
    return;
  }
  
  isLoadingThumbnails = true;
  const { thumbnailImg } = thumbnailQueue.shift();
  
  // 썸네일이 여전히 pending 상태인지 확인
  if (thumbnailImg.getAttribute("data-video-thumbnail") === "pending") {
    generatePopupVideoThumbnail(thumbnailImg);
  }
  
  // 500ms 후 다음 썸네일 처리 (네트워크 부하 분산)
  const timeoutId = setTimeout(() => {
    processThumbnailQueue();
  }, 500);
  
  thumbnailTimeouts.push(timeoutId);
}

// 팝업 이벤트 리스너 설정
function setupPopupEventListeners() {
  // 닫기 버튼
  document.getElementById("popup-close-btn").addEventListener("click", () => {
    closeDetailPopup();
  });

  // 좌우 이동
  document.getElementById("popup-prev-btn").addEventListener("click", () => {
    console.log("🔍 이전 버튼 클릭 - currentIndex:", currentIndex, "mediaList length:", currentMediaList.length);
    if (currentIndex > 0) {
      const prevMedia = currentMediaList[currentIndex - 1];
      console.log("🔍 이전 미디어로 이동:", prevMedia.id, "index:", currentIndex - 1);
      openDetailPopup(prevMedia, currentMediaList);
    }
  });

  document.getElementById("popup-next-btn").addEventListener("click", () => {
    console.log("🔍 다음 버튼 클릭 - currentIndex:", currentIndex, "mediaList length:", currentMediaList.length);
    if (currentIndex < currentMediaList.length - 1) {
      const nextMedia = currentMediaList[currentIndex + 1];
      console.log("🔍 다음 미디어로 이동:", nextMedia.id, "index:", currentIndex + 1);
      openDetailPopup(nextMedia, currentMediaList);
    }
  });

  // 전체화면
  document.getElementById("popup-fullscreen-btn").addEventListener("click", () => {
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

  // 수정/삭제/미디어 추가/음악변경 버튼
  document.getElementById("popup-edit-btn").addEventListener("click", () => {
    toggleEditMode();
  });

  document.getElementById("popup-delete-btn").addEventListener("click", () => {
    deleteMemory();
  });

  document.getElementById("popup-add-media-btn").addEventListener("click", () => {
    showMediaUploadModal();
  });

  document.getElementById("popup-music-change-btn").addEventListener("click", () => {
    showMusicChangeModal();
  });
}

// 본문 미디어 렌더링
function renderMainMedia(src) {
  const mainImgContainer = document.getElementById(
    "popup-main-image-container"
  );
  mainImgContainer.innerHTML = "";
  if (!src) return;

  // 줌/패닝 상태 초기화
  zoomLevel = 1;
  imgPos = { x: 0, y: 0 };

  if (src.match(/\.(mp4|webm|ogg)$/i)) {
    const video = document.createElement("video");
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.preload = "none"; // 사용자가 재생을 원할 때만 로드
    video.style.width = "416px"; // 썸네일 라인과 맞춤
    video.style.height = "555px"; // 비율에 맞게 조정
    video.style.margin = "0 auto"; // 가운데 정렬
    video.style.display = "block";
    video.style.borderRadius = "16px";
    video.style.objectFit = "cover"; // cover로 변경하여 지정된 크기를 꽉 채우도록
    mainImgContainer.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.id = "popup-main-image";
    img.loading = "lazy"; // 지연 로딩 추가
    
    // 🔥 팝업 메인 이미지 로딩 에러 핸들링 추가
    img.addEventListener("error", (e) => {
      console.error("❌ 팝업 메인 이미지 로딩 실패:", src);
      console.error("🔍 에러 상세 정보:", {
        url: src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        currentSrc: img.currentSrc,
        error: e
      });
      
      // URL 검증
      if (src && src.includes('supabase')) {
        console.log("🌐 Supabase URL 테스트 중...");
        fetch(src, { method: 'HEAD' })
          .then(response => {
            console.log(`🔍 URL 응답: ${response.status} ${response.statusText}`);
            console.log(`📁 Content-Type: ${response.headers.get('content-type')}`);
            console.log(`📏 Content-Length: ${response.headers.get('content-length')}`);
          })
          .catch(fetchError => {
            console.error("🚨 URL 접근 실패:", fetchError);
          });
      }
      
      img.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23ffebee'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23c62828' font-family='Arial' font-size='16'>이미지를 불러올 수 없습니다</text></svg>";
    });
    
    img.addEventListener("load", () => {
      console.log("✅ 팝업 메인 이미지 로딩 완료:", src);
    });
    
    img.src = src;

    // 확대/축소 컨트롤 추가
    const zoomControls = document.createElement("div");
    zoomControls.className = "zoom-controls";

    const zoomInBtn = document.createElement("button");
    zoomInBtn.textContent = "+";
    zoomInBtn.title = "확대";

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.textContent = "−";
    zoomOutBtn.title = "축소";

    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(zoomInBtn);

    mainImgContainer.appendChild(img);
    mainImgContainer.appendChild(zoomControls);

    // 이미지 변환(transform) 업데이트 함수
    const updateTransform = () => {
      img.style.transform = `translate(${imgPos.x}px, ${imgPos.y}px) scale(${zoomLevel})`;
      img.style.cursor = zoomLevel > 1 ? "grab" : "default";
    };

    // 줌 인/아웃 이벤트 리스너
    zoomInBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (zoomLevel < MAX_ZOOM) {
        zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
        updateTransform();
      }
    });

    zoomOutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (zoomLevel > MIN_ZOOM) {
        zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
        // 줌 레벨이 1로 돌아오면 이미지 위치를 초기화합니다.
        if (zoomLevel === 1) {
          imgPos = { x: 0, y: 0 };
        }
        updateTransform();
      }
    });

    // 이미지 드래그(패닝)를 위한 이벤트 리스너
    const onMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      imgPos.x = e.clientX - startPos.x;
      imgPos.y = e.clientY - startPos.y;
      updateTransform();
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      img.style.cursor = "grab";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    img.addEventListener("mousedown", (e) => {
      if (zoomLevel <= 1) return; // 확대된 상태에서만 드래그 가능
      e.preventDefault();
      isDragging = true;
      startPos.x = e.clientX - imgPos.x;
      startPos.y = e.clientY - imgPos.y;
      img.style.cursor = "grabbing";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
}

// 썸네일 하이라이트
function highlightThumbnail(index) {
  const thumbs = document.querySelectorAll(".popup-thumb");
  thumbs.forEach((thumb, i) => {
    thumb.classList.toggle("selected-thumb", i === index);
  });
}


function closeDetailPopup() {
  const overlay = document.getElementById("popup-overlay");
  if (overlay.style.display === "none") return;

  // 팝업 닫기 완료 후 경로 복원을 위해 플래그 설정
  document.body.classList.remove("modal-open");
  overlay.style.display = "none";

  // 🎬 영상 재생 중지
  const mainImgContainer = document.getElementById(
    "popup-main-image-container"
  );
  const videos = mainImgContainer.querySelectorAll("video");
  videos.forEach((video) => {
    video.pause();
    video.currentTime = 0;
  });

  overlay.style.display = "none";

  // 🎵 음악 플레이어 초기화
  resetMusicPlayer();

  // 메인 음악 재시작
  if (typeof resumeMainMusic === "function") {
    resumeMainMusic();
  }

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

  // 팝업을 닫을 때는 갤러리를 다시 로드하지 않음
  console.log("🛤️ 팝업 닫기 완료 - 갤러리 유지");
  
  // 🛤️ 저장된 발자취 경로 복원
  console.log("🔍 팝업 닫기 - restoreSavedPath 존재 여부:", typeof window.restoreSavedPath);
  if (typeof window.restoreSavedPath === "function") {
    console.log("🔍 300ms 후 경로 복원 예정");
    setTimeout(() => {
      console.log("🔍 경로 복원 실행");
      window.restoreSavedPath();
    }, 300); // DOM이 완전히 안정화된 후 복원
  } else {
    console.log("⚠️ restoreSavedPath 함수를 찾을 수 없음");
  }
}


// 키보드 방향키 탐색
document.addEventListener("keydown", (e) => {
  const overlay = document.getElementById("popup-overlay");
  const isVisible = window.getComputedStyle(overlay).display !== "none";

  if (!isVisible) return;

  // 수정 모드에서 input에 포커스 되어 있을 때는 키보드 이동을 막습니다.
  if (
    isEditMode &&
    (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
  ) {
    return;
  }

  // 키보드 좌우 방향키로 팝업 내 썸네일(이미지/영상)을 탐색합니다.
  if (e.key === "ArrowRight") {
    if (currentImageIndex < currentAllSrc.length - 1) {
      currentImageIndex++;
      renderMainMedia(currentAllSrc[currentImageIndex]);
      highlightThumbnail(currentImageIndex);
    }
  } else if (e.key === "ArrowLeft") {
    if (currentImageIndex > 0) {
      currentImageIndex--;
      renderMainMedia(currentAllSrc[currentImageIndex]);
      highlightThumbnail(currentImageIndex);
    }
  }
});



// 메모리 삭제 함수
// Supabase 작업 재시도 함수
async function retrySupabaseOperation(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 시도 ${attempt}/${maxRetries}`);
      const result = await operation();

      // 504 에러나 JSON 파싱 에러 체크
      if (result && result.error) {
        const errorMessage = result.error.message || "";
        if (
          errorMessage.includes("504") ||
          errorMessage.includes("Gateway") ||
          errorMessage.includes("JSON") ||
          errorMessage.includes("Unexpected token")
        ) {
          throw new Error(`서버 오류 (${errorMessage})`);
        }
      }

      return result;
    } catch (error) {
      console.warn(`⚠️ 시도 ${attempt} 실패:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // 지수적 백오프: 1초, 2초, 4초
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`⏳ ${waitTime}ms 대기 후 재시도...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}

async function deleteMemory() {
  if (!currentMedia) {
    alert("삭제할 메모리가 선택되지 않았습니다.");
    return;
  }

  // 이중 확인
  if (
    !confirm(
      `정말로 "${currentMedia.title}" 메모리를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!`
    )
  ) {
    return;
  }

  if (
    !confirm(
      "삭제하면 모든 사진, 동영상, 음악이 영구적으로 제거됩니다.\n\n정말 삭제하시겠습니까?"
    )
  ) {
    return;
  }

  try {
    // 로딩 표시
    const overlay = document.getElementById("popup-overlay");
    const originalContent = overlay.innerHTML;
    overlay.innerHTML = `
      <div style="
        display: flex; 
        align-items: center; 
        justify-content: center; 
        height: 100vh; 
        color: white; 
        font-size: 18px;
        background: rgba(0,0,0,0.8);
      ">
        메모리 삭제 중...
      </div>
    `;

    console.log("🗑️ 삭제 시작 - Memory ID:", currentMedia.id);

    // 1. media_files에서 파일 목록 가져오기
    console.log("📂 media_files 조회 중...");
    const { data: mediaFiles, error: mediaFilesError } =
      await retrySupabaseOperation(() =>
        window.sbClient
          .from("media_files")
          .select("media_url")
          .eq("memory_id", currentMedia.id)
      );

    if (mediaFilesError) {
      console.error("❌ media_files 조회 오류:", mediaFilesError);
      throw mediaFilesError;
    }
    console.log(
      "✅ media_files 조회 성공:",
      mediaFiles ? mediaFiles.length : 0,
      "개 파일"
    );

    // 2. Storage에서 파일들 삭제
    if (mediaFiles && mediaFiles.length > 0) {
      const filePaths = mediaFiles.map((file) => {
        const fileName = file.media_url.split("/").pop();
        return `uploads/${fileName}`;
      });
      console.log("📁 삭제할 Storage 파일 경로:", filePaths);

      const { data: removeData, error: storageError } =
        await retrySupabaseOperation(() =>
          window.sbClient.storage.from("media").remove(filePaths)
        );

      if (storageError) {
        console.error("❌ Storage 파일 삭제 오류:", storageError);
      } else {
        console.log("✅ Storage 파일 삭제 성공:", removeData);
      }
    }

    // 3. memory_music에서 음악 파일도 삭제
    console.log("🎵 memory_music 조회 중...");
    const { data: musicData, error: musicSelectError } =
      await retrySupabaseOperation(() =>
        window.sbClient
          .from("memory_music")
          .select("music_path, album_path")
          .eq("memory_id", currentMedia.id)
          .single()
      );

    if (musicSelectError && musicSelectError.code !== "PGRST116") {
      // PGRST116은 "not found" 에러
      console.error("❌ memory_music 조회 오류:", musicSelectError);
    } else if (musicData) {
      console.log("✅ memory_music 조회 성공:", musicData);
      const musicFilesToDelete = [];
      if (musicData.music_path) musicFilesToDelete.push(musicData.music_path);
      if (musicData.album_path) musicFilesToDelete.push(musicData.album_path);

      if (musicFilesToDelete.length > 0) {
        console.log("🎵 삭제할 음악 파일:", musicFilesToDelete);
        const { data: musicRemoveData, error: musicStorageError } =
          await retrySupabaseOperation(() =>
            window.sbClient.storage.from("media").remove(musicFilesToDelete)
          );

        if (musicStorageError) {
          console.error("❌ 음악 파일 삭제 오류:", musicStorageError);
        } else {
          console.log("✅ 음악 파일 삭제 성공:", musicRemoveData);
        }
      }
    } else {
      console.log("ℹ️ 삭제할 음악 파일 없음");
    }

    // 4. DB에서 관련 데이터 삭제 (순서 중요: 외래키 제약 때문에 자식 테이블부터 삭제)

    // media_files 삭제
    console.log("🗄️ media_files 테이블에서 삭제 중...");
    const { data: mediaFilesDeleteData, error: mediaFilesDeleteError } =
      await retrySupabaseOperation(() =>
        window.sbClient
          .from("media_files")
          .delete()
          .eq("memory_id", currentMedia.id)
      );

    if (mediaFilesDeleteError) {
      console.error("❌ media_files 삭제 오류:", mediaFilesDeleteError);
      throw mediaFilesDeleteError;
    }
    console.log("✅ media_files 삭제 성공:", mediaFilesDeleteData);

    // memory_music 삭제
    console.log("🗄️ memory_music 테이블에서 삭제 중...");
    const { data: musicDeleteData, error: musicDeleteError } =
      await retrySupabaseOperation(() =>
        window.sbClient
          .from("memory_music")
          .delete()
          .eq("memory_id", currentMedia.id)
      );

    if (musicDeleteError) {
      console.error("❌ memory_music 삭제 오류:", musicDeleteError);
      throw musicDeleteError;
    }
    console.log("✅ memory_music 삭제 성공:", musicDeleteData);

    // memories 삭제
    console.log("🗄️ memories 테이블에서 삭제 중...");
    const { data: memoryDeleteData, error: memoryDeleteError } =
      await retrySupabaseOperation(() =>
        window.sbClient.from("memories").delete().eq("id", currentMedia.id)
      );

    if (memoryDeleteError) {
      console.error("❌ memories 삭제 오류:", memoryDeleteError);
      throw memoryDeleteError;
    }
    console.log("✅ memories 삭제 성공:", memoryDeleteData);

    console.log("🎉 메모리 삭제 완료:", currentMedia.id);

    // 성공 시 팝업 닫고 페이지 새로고침
    closeDetailPopup();
    alert("메모리가 성공적으로 삭제되었습니다.");
    location.reload();
  } catch (error) {
    console.error("💥 메모리 삭제 오류:", error);
    alert("메모리 삭제 중 오류가 발생했습니다: " + error.message);

    // 오류 시 원래 내용 복원
    const overlay = document.getElementById("popup-overlay");
    overlay.innerHTML = originalContent;
  }
}

/*******/
/* 음악 플레이어 UI 로직 (jQuery) */
const currentTime = document.getElementById("current-time");
const totalTime = document.getElementById("track-length");

// 전역 스코프에서 접근 가능하도록 initPlayer 함수를 밖으로 이동
function initPlayer() {
    // jQuery 선택자들을 함수 내부에서 새로 가져오기
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

    window.audio = new Audio(); // 전역화
    window.buffInterval = null; // 전역화

    audio.loop = false;

    function playPause() {
      setTimeout(function () {
        if (audio.paused) {
          playerTrack.addClass("active");
          albumArt.addClass("active");
          checkBuffering();
          i.attr("class", "fas fa-pause");
          pauseMainMusicForDetailMusic();
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

// DOM 로딩 완료 시 초기 설정
$(function () {
  // 초기 로딩 시에만 필요한 설정이 있다면 여기에 추가
});

function resetMusicPlayer() {
  if (!window.audio) return;

  console.log("🎵 음악 플레이어 리셋");
  window.audio.pause();
  window.audio.currentTime = 0; // 재생 위치도 초기화
  window.audio.src = ""; // 소스 제거
  window.audio.load(); // 완전히 새로고침

  // UI 초기화
  $("#play-pause-button i").attr("class", "fas fa-play");
  $("#player-track").removeClass("active");
  $("#album-art").removeClass("active buffering");
  $("#track-name").text("제목 없음");
  $("#album-name").text("아티스트 없음");
  $("#current-time").text("00:00");
  $("#track-length").text("00:00");
  $("#seek-bar").width(0);
  $("#album-art img").attr("src", DEFAULT_ALBUM_COVER_URL);
  $("#player-bg-artwork").css("background-image", "none");

  if (window.buffInterval) {
    clearInterval(window.buffInterval);
    window.buffInterval = null;
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
    editBtn.textContent = "수정"; // 항상 수정 텍스트 유지
    editBtn.title = "저장";
    enableEditMode();
  } else {
    editBtn.textContent = "수정"; // 항상 수정 텍스트 유지
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

// ========================================
// 미디어 업로드 기능
// ========================================

let selectedFiles = []; // 선택된 파일들
let currentFileCount = 0; // 현재 메모리의 파일 개수

// 미디어 업로드 모달 표시
async function showMediaUploadModal() {
  if (!currentMedia) {
    alert("메모리가 선택되지 않았습니다.");
    return;
  }

  // 현재 파일 개수 확인
  await checkCurrentFileCount();

  const modal = document.getElementById("media-upload-modal");
  const form = document.getElementById("media-upload-form");

  // 폼 초기화
  form.reset();
  selectedFiles = [];
  updateFilePreview();
  updateFileCountInfo();

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  document.body.classList.add("modal-open");

  // 모달 이벤트 리스너 설정
  setupMediaUploadEvents();
}

// 현재 파일 개수 확인
async function checkCurrentFileCount() {
  try {
    const { data: mediaFiles, error } = await window.supabaseClient
      .from("media_files")
      .select("id, media_url")
      .eq("memory_id", currentMedia.id);

    if (error) {
      console.error("파일 개수 확인 실패:", error);
      currentFileCount = 0;
    } else {
      currentFileCount = mediaFiles ? mediaFiles.length : 0;
    }

    console.log(
      `🔍 현재 메모리 ${currentMedia.id}의 파일 개수: ${currentFileCount}`
    );
    console.log("🔍 파일 개수 확인 - 전체 파일 목록:", mediaFiles);
    console.log(
      "🔍 파일 개수 확인 - 파일별 상세:",
      mediaFiles?.map((f) => ({
        id: f.id,
        url: f.media_url?.split("/").pop() || "URL없음",
        fullUrl: f.media_url,
      }))
    );

    // currentMedia에서도 파일 개수 확인
    if (currentMedia && currentMedia.media_files) {
      console.log(
        `currentMedia에서 확인한 파일 개수: ${currentMedia.media_files.length}`
      );
      console.log("currentMedia 파일 목록:", currentMedia.media_files);
    }
  } catch (error) {
    console.error("파일 개수 확인 중 오류:", error);
    currentFileCount = 0;
  }
}

// 파일 개수 정보 업데이트
function updateFileCountInfo() {
  const currentInfo = document.getElementById("current-files-info");
  const remainingInfo = document.getElementById("remaining-slots-info");

  const totalSelected = selectedFiles.length;
  const remaining = Math.max(0, 21 - currentFileCount - totalSelected);

  currentInfo.textContent = `현재 저장된 파일: ${currentFileCount}개`;

  if (remaining > 0) {
    remainingInfo.textContent = `추가 가능: ${remaining}개 (선택됨: ${totalSelected}개)`;
    remainingInfo.style.color = "var(--description-color)";
  } else {
    remainingInfo.textContent = "더 이상 추가할 수 없습니다 (최대 21개)";
    remainingInfo.style.color = "#f44";
  }
}

// 미디어 업로드 이벤트 설정
function setupMediaUploadEvents() {
  const fileInput = document.getElementById("media-files");
  const form = document.getElementById("media-upload-form");
  const cancelBtn = document.getElementById("media-upload-cancel");
  const modal = document.getElementById("media-upload-modal");

  // 파일 선택 이벤트
  fileInput.onchange = (e) => {
    handleFileSelection(e.target.files);
  };

  // 폼 제출 이벤트
  form.onsubmit = async (e) => {
    e.preventDefault();
    await handleMediaUpload();
  };

  // 취소 버튼
  cancelBtn.onclick = () => {
    closeMediaUploadModal();
  };

  // 모달 배경 클릭
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeMediaUploadModal();
    }
  };

  // ESC 키
  const escHandler = (e) => {
    if (e.key === "Escape") {
      closeMediaUploadModal();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);
}

// 파일 선택 처리
function handleFileSelection(files) {
  const fileArray = Array.from(files);
  const availableSlots = Math.max(0, 21 - currentFileCount);

  if (fileArray.length > availableSlots) {
    alert(`최대 ${availableSlots}개의 파일만 추가할 수 있습니다.`);
    return;
  }

  // 파일 검증
  const validFiles = [];
  const supportedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/mov",
    "video/avi",
    "video/webm",
  ];

  for (const file of fileArray) {
    if (!supportedTypes.includes(file.type)) {
      alert(`지원하지 않는 파일 형식입니다: ${file.name}`);
      continue;
    }

    // 파일 크기 제한 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert(`파일 크기가 너무 큽니다 (50MB 초과): ${file.name}`);
      continue;
    }

    validFiles.push(file);
  }

  selectedFiles = validFiles;
  updateFilePreview();
  updateFileCountInfo();
}

// 파일 미리보기 업데이트
function updateFilePreview() {
  const preview = document.getElementById("selected-files-preview");

  if (selectedFiles.length === 0) {
    preview.classList.remove("show");
    return;
  }

  preview.classList.add("show");
  preview.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-preview-item";

    const isVideo = file.type.startsWith("video/");
    const icon = isVideo ? "🎬" : "📷";
    const sizeText = formatFileSize(file.size);

    item.innerHTML = `
      <div class="file-preview-info">
        <span class="file-preview-icon">${icon}</span>
        <div>
          <div class="file-preview-name">${file.name}</div>
          <div class="file-preview-size">${sizeText}</div>
        </div>
      </div>
      <button type="button" class="file-preview-remove" data-index="${index}">✕</button>
    `;

    // 제거 버튼 이벤트
    item.querySelector(".file-preview-remove").onclick = () => {
      selectedFiles.splice(index, 1);
      updateFilePreview();
      updateFileCountInfo();
    };

    preview.appendChild(item);
  });
}

// 파일 크기 포맷
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 다음 파일 번호 계산 (polaroidNumber_xxx.jpg 형식에서 xxx 부분)
async function getNextFileNumber(polaroidNumber) {
  try {
    const { data: mediaFiles, error } = await window.supabaseClient
      .from("media_files")
      .select("media_url")
      .eq("memory_id", currentMedia.id);

    if (error) {
      console.error("기존 파일 목록 조회 실패:", error);
      return 1;
    }

    let maxNumber = 0;

    if (mediaFiles && mediaFiles.length > 0) {
      const expectedPrefix = polaroidNumber.toString();
      mediaFiles.forEach((file) => {
        const fileName = file.media_url.split("/").pop();
        const match = fileName.match(/^(\d+)_(\d+)\./);
        if (match) {
          const prefix = match[1];
          const number = parseInt(match[2], 10);

          // 현재 폴라로이드 번호와 일치하는 파일만 처리
          if (prefix === expectedPrefix && number > maxNumber) {
            maxNumber = number;
          }
        }
      });
    }

    return maxNumber + 1;
  } catch (error) {
    console.error("다음 파일 번호 계산 중 오류:", error);
    return 1;
  }
}

// 미디어 업로드 처리
async function handleMediaUpload() {
  if (selectedFiles.length === 0) {
    alert("파일을 선택해주세요.");
    return;
  }

  const submitBtn = document.getElementById("media-upload-submit");
  const originalText = submitBtn.textContent;

  try {
    // UI 비활성화
    submitBtn.textContent = "업로드 중...";
    submitBtn.disabled = true;

    // 현재 폴라로이드 번호 계산
    const polaroidNumber = currentIndex + 1;

    // 시작 번호 가져오기
    let nextNumber = await getNextFileNumber(polaroidNumber);

    // 각 파일 업로드
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileNumber = String(nextNumber + i).padStart(3, "0");
      const fileExtension = file.name.split(".").pop().toLowerCase();

      // 파일명 생성 (동적 폴라로이드 번호 사용)
      const fileName = `${polaroidNumber}_${fileNumber}.${fileExtension}`;

      submitBtn.textContent = `업로드 중... (${i + 1}/${selectedFiles.length})`;

      // Supabase Storage에 업로드
      const { data: uploadData, error: uploadError } =
        await window.supabaseClient.storage
          .from("media")
          .upload(`uploads/${fileName}`, file);

      if (uploadError) {
        console.error("파일 업로드 실패:", uploadError);
        throw new Error(`파일 업로드 실패: ${file.name}`);
      }

      // 업로드된 파일의 URL 생성
      const { data: urlData } = window.supabaseClient.storage
        .from("media")
        .getPublicUrl(`uploads/${fileName}`);

      // media_files 테이블에 레코드 추가
      const { data: dbData, error: dbError } = await window.supabaseClient
        .from("media_files")
        .insert({
          memory_id: currentMedia.id,
          media_url: urlData.publicUrl,
          file_order: nextNumber + i,
          is_main: false,
        });

      if (dbError) {
        console.error("DB 레코드 추가 실패:", dbError);
        throw new Error(`DB 레코드 추가 실패: ${file.name}`);
      }

      console.log(`파일 업로드 완료: ${fileName}`);
    }

    alert(`${selectedFiles.length}개의 파일이 성공적으로 업로드되었습니다!`);

    // 모달 닫기
    closeMediaUploadModal();

    // 팝업 새로고침 (썸네일 목록 업데이트)
    await refreshPopupContent();
  } catch (error) {
    console.error("업로드 처리 중 오류:", error);
    alert("업로드 중 오류가 발생했습니다: " + error.message);
  } finally {
    // UI 복구
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

// 팝업 내용 새로고침 (썸네일 목록 업데이트)
async function refreshPopupContent() {
  try {
    // 현재 메모리의 최신 데이터 가져오기
    const { data: refreshedMemory, error } = await window.supabaseClient
      .from("memories")
      .select(
        "*, media_files(order:file_order, media_url, is_main, file_order)"
      )
      .eq("id", currentMedia.id)
      .single();

    if (error) {
      console.error("메모리 데이터 새로고침 실패:", error);
      return;
    }

    // currentMedia 업데이트
    currentMedia = refreshedMemory;

    // 미디어 리스트에서도 업데이트
    const memoryIndex = currentMediaList.findIndex(
      (m) => m.id === currentMedia.id
    );
    if (memoryIndex !== -1) {
      currentMediaList[memoryIndex] = refreshedMemory;
    }

    // file_order 순서대로 정렬 (대표이미지는 맨 앞)
    let mediaFiles = refreshedMemory.media_files || [];

    // 현재 폴라로이드 번호를 기준으로 예상 접두사 설정
    const polaroidNumber = currentIndex + 1;
    let expectedPrefix = polaroidNumber.toString();

    // 기존 파일에서 접두사를 확인하여 일치하는지 검증
    if (mediaFiles.length > 0) {
      const firstFile = mediaFiles[0];
      if (firstFile && firstFile.media_url) {
        const firstFileName = firstFile.media_url.split("/").pop();
        const match = firstFileName.match(/^(\d+)_/);
        if (match) {
          const detectedPrefix = match[1];
          if (detectedPrefix === expectedPrefix) {
          } else {
            // 기존 파일의 접두사를 우선 사용 (호환성 위해)
            expectedPrefix = detectedPrefix;
          }
        }
      }
    }

    // 동일한 접두사를 가진 파일들만 유지 (다른 메모리 파일 제거)
    mediaFiles = mediaFiles.filter((file) => {
      const fileName = file.media_url.split("/").pop();
      return fileName.startsWith(expectedPrefix + "_");
    });

    const sortedMediaFiles = mediaFiles.sort((a, b) => {
      // 대표이미지는 무조건 맨 앞
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;

      // file_order로 정렬 (숫자 비교)
      const aOrder = a.file_order || 0;
      const bOrder = b.file_order || 0;
      return aOrder - bOrder;
    });

    console.log(
      "새로고침 - file_order로 정렬 후:",
      sortedMediaFiles.map((f) => ({
        url: f.media_url.split("/").pop(),
        file_order: f.file_order,
        is_main: f.is_main,
      }))
    );

    const allSrc = sortedMediaFiles
      .map((file) => file.media_url)
      .filter(Boolean);
    currentAllSrc = allSrc;

    // 썸네일 목록 다시 렌더링
    const thumbList = document.getElementById("popup-thumbnails");
    thumbList.innerHTML = "";

    allSrc.forEach((src, idx) => {
      if (src.match(/\.(mp4|webm|ogg)$/i)) {
        // 비디오 썸네일
        const videoContainer = document.createElement("div");
        videoContainer.className = "popup-thumb-video-container";
        videoContainer.style.position = "relative";
        videoContainer.style.display = "block";
        videoContainer.style.width = "48px";
        videoContainer.style.height = "48px";
        videoContainer.style.flexShrink = "0";

        const thumb = document.createElement("img");
        thumb.className = "popup-thumb";
        thumb.loading = "lazy";
        if (idx === currentImageIndex) thumb.classList.add("selected-thumb");

        const playIcon = document.createElement("div");
        playIcon.className = "popup-thumb-play-icon";
        playIcon.innerHTML = "▶";
        playIcon.style.position = "absolute";
        playIcon.style.top = "50%";
        playIcon.style.left = "55%";
        playIcon.style.transform = "translate(-50%, -55%)";
        playIcon.style.fontSize = "20px";
        playIcon.style.color = "white";
        playIcon.style.textShadow = "1px 1px 3px black";
        playIcon.style.pointerEvents = "none";
        playIcon.style.zIndex = "1";

        videoContainer.appendChild(thumb);
        videoContainer.appendChild(playIcon);

        videoContainer.addEventListener("click", () => {
          renderMainMedia(src);
          currentImageIndex = idx;
          highlightThumbnail(idx);
        });

        const video = document.createElement("video");
        video.src = src;
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.style.display = "none";

        video.addEventListener("loadedmetadata", () => {
          video.currentTime = 0.1;
        });

        video.addEventListener("seeked", () => {
          const canvas = document.createElement("canvas");
          canvas.width = 40;
          canvas.height = 53;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumb.src = canvas.toDataURL("image/jpeg");
          video.remove();
        });

        document.body.appendChild(video);
        thumbList.appendChild(videoContainer);
      } else {
        // 이미지 썸네일
        const thumb = document.createElement("img");
        thumb.className = "popup-thumb";
        thumb.loading = "lazy";
        if (idx === currentImageIndex) thumb.classList.add("selected-thumb");

        thumb.addEventListener("click", () => {
          renderMainMedia(src);
          currentImageIndex = idx;
          highlightThumbnail(idx);
        });

        // 🔥 새로고침된 썸네일 이미지 에러 핸들링 추가
        thumb.addEventListener("error", () => {
          console.error("❌ 새로고침된 팝업 썸네일 이미지 로딩 실패:", src);
          thumb.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='53' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23ffebee'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23c62828' font-family='Arial' font-size='7'>실패</text></svg>";
        });

        thumb.src = src;
        thumbList.appendChild(thumb);
      }
    });

    console.log("팝업 콘텐츠 새로고침 완료");
  } catch (error) {
    console.error("팝업 새로고침 중 오류:", error);
  }
}

// 미디어 업로드 모달 닫기
function closeMediaUploadModal() {
  const modal = document.getElementById("media-upload-modal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
  document.body.classList.remove("modal-open");

  // 선택된 파일들 초기화
  selectedFiles = [];
  document.getElementById("media-upload-form").reset();
}

// ==================== 음악변경 기능 ====================

// 음악변경 모달 표시
function showMusicChangeModal() {
  const modal = document.getElementById("music-change-modal");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  document.body.classList.add("modal-open");

  // 폼 리셋
  document.getElementById("music-change-form").reset();
  document.getElementById("music-change-title").value = "";
  document.getElementById("music-change-artist").value = "";
}

// 음악변경 모달 닫기
function closeMusicChangeModal() {
  const modal = document.getElementById("music-change-modal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
  document.body.classList.remove("modal-open");
}

// 음악변경 취소 버튼 이벤트
const musicChangeCancelBtn = document.getElementById("music-change-cancel");
if (musicChangeCancelBtn) {
  musicChangeCancelBtn.addEventListener("click", () => {
    closeMusicChangeModal();
  });
}

// 음악 파일 메타데이터 추출
const musicChangeFileInput = document.getElementById("music-change-file");
if (musicChangeFileInput) {
  musicChangeFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // musicmetadata.js를 사용하여 메타데이터 추출
      const metadata = await new Promise((resolve, reject) => {
        window.musicmetadata(file, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      document.getElementById("music-change-title").value =
        metadata.title || file.name.replace(/\.[^/.]+$/, "");
      document.getElementById("music-change-artist").value =
        metadata.artist?.[0] || "알 수 없는 아티스트";
    } catch (error) {
      console.error("메타데이터 추출 실패:", error);
      // 파일명에서 추출 시도
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      if (fileName.includes(" - ")) {
        const parts = fileName.split(" - ");
        document.getElementById("music-change-artist").value = parts[0].trim();
        document.getElementById("music-change-title").value = parts[1].trim();
      } else {
        document.getElementById("music-change-title").value = fileName;
        document.getElementById("music-change-artist").value =
          "알 수 없는 아티스트";
      }
    }
  });
}

// 음악변경 폼 제출 처리
const musicChangeForm = document.getElementById("music-change-form");
if (musicChangeForm) {
  musicChangeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleMusicChange();
  });
}

// 음악변경 처리 함수
async function handleMusicChange() {
  const fileInput = document.getElementById("music-change-file");
  const file = fileInput.files[0];

  if (!file) {
    alert("음악 파일을 선택해주세요.");
    return;
  }

  const submitBtn = document.getElementById("music-change-submit");
  const originalText = submitBtn.textContent;

  try {
    // UI 비활성화
    submitBtn.textContent = "변경 중...";
    submitBtn.disabled = true;

    const musicTitle = document.getElementById("music-change-title").value;
    const artistName = document.getElementById("music-change-artist").value;

    // 파일명 생성 (admin.js와 동일한 패턴 사용)
    const fileName = `music_${Date.now()}.mp3`;
    const filePath = `music/${fileName}`;

    // Supabase Storage에 음악 파일 업로드 (admin.js와 동일한 옵션 사용)
    const { data: uploadData, error: uploadError } =
      await window.supabaseClient.storage.from("media").upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: "audio/mpeg",
      });

    if (uploadError) {
      console.error("음악 파일 업로드 실패:", uploadError);
      throw new Error("음악 파일 업로드에 실패했습니다.");
    }

    // 음악 파일 URL 생성
    const { data: urlData } = window.supabaseClient.storage
      .from("media")
      .getPublicUrl(filePath);

    // memory_music 테이블에서 기존 음악 데이터 확인
    const { data: existingMusic } = await window.supabaseClient
      .from("memory_music")
      .select("*")
      .eq("memory_id", currentMedia.id)
      .single();

    let dbError;
    if (existingMusic) {
      // 기존 음악 데이터 업데이트
      const { error } = await window.supabaseClient
        .from("memory_music")
        .update({
          music_title: musicTitle,
          artist_name: artistName,
          music_path: filePath,
        })
        .eq("memory_id", currentMedia.id);
      dbError = error;
    } else {
      // 새 음악 데이터 삽입
      const { error } = await window.supabaseClient
        .from("memory_music")
        .insert({
          memory_id: currentMedia.id,
          music_title: musicTitle,
          artist_name: artistName,
          music_path: filePath,
          duration_seconds: 0, // 기본값 설정
          album_path: null, // 앨범 커버는 일단 null로
        });
      dbError = error;
    }

    if (dbError) {
      console.error("음악 데이터베이스 저장 실패:", dbError);
      throw new Error("음악 정보 저장에 실패했습니다.");
    }

    alert("음악이 성공적으로 변경되었습니다!");

    // 모달 닫기
    closeMusicChangeModal();

    // 팝업 새로고침 (음악 플레이어 업데이트)
    await refreshPopupContent();
  } catch (error) {
    console.error("음악변경 처리 중 오류:", error);
    alert("음악 변경 중 오류가 발생했습니다: " + error.message);
  } finally {
    // UI 복구
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}
