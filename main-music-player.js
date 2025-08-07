// 메인 음악 플레이어 전역 변수
let mainAudio = null;
let mainMusicMinimized = false;
let isPopupOpen = false;

// 플레이리스트 관련 변수
let playlist = [];
let currentTrackIndex = 0;

// 기본 앨범 커버 URL (detail-popup.js와 동일)
const { data: defaultMainCoverData } = window.supabaseClient.storage
  .from("media")
  .getPublicUrl("album/default-cover.jpg");
const DEFAULT_MAIN_ALBUM_COVER_URL = defaultMainCoverData.publicUrl;

// 메인 음악 플레이어 초기화
function initMainMusicPlayer() {
  mainAudio = new Audio();
  mainAudio.loop = true;
  mainAudio.volume = 0.7;

  // jQuery 요소 선택
  const mainPlayerTrack = $("#main-player-track");
  const mainAlbumArt = $("#main-album-art");
  const mainSeekArea = $("#main-seek-bar-container");
  const mainSeekBar = $("#main-seek-bar");
  const mainSeekTime = $("#main-seek-time");
  const mainSHover = $("#main-s-hover");
  const mainPlayPauseButton = $("#main-play-pause-button");
  const mainCurrentTime = $("#main-current-time");
  const mainTrackLength = $("#main-track-length");
  const mainMusicToggle = $("#main-music-toggle");
  const mainPrevButton = $("#main-prev-button");
  const mainNextButton = $("#main-next-button");
  const mainPlaylistButton = $("#main-playlist-button");

  let mainSeekBarPos, mainSeekT, mainSeekLoc, mainBuffInterval = null;

  // 메인 음악 재생/일시정지 함수
  function mainPlayPause() {
    if (isPopupOpen) return;
    
    setTimeout(function () {
      if (mainAudio.paused) {
        mainPlayerTrack.addClass("active");
        mainAlbumArt.addClass("active");
        $("#main-music-player").addClass("playing");
        mainCheckBuffering();
        mainPlayPauseButton.find("i").attr("class", "fas fa-pause");
        mainAudio.play().catch(error => console.log("메인 음악 재생 실패:", error));
      } else {
        mainPlayerTrack.removeClass("active");
        mainAlbumArt.removeClass("active");
        $("#main-music-player").removeClass("playing");
        clearInterval(mainBuffInterval);
        mainAlbumArt.removeClass("buffering");
        mainPlayPauseButton.find("i").attr("class", "fas fa-play");
        mainAudio.pause();
      }
    }, 300);
  }

  // 시크바 호버 표시
  function mainShowHover(event) {
    if (mainAudio.duration === 0) return;
    
    mainSeekBarPos = mainSeekArea.offset();
    mainSeekT = event.clientX - mainSeekBarPos.left;
    mainSeekLoc = mainAudio.duration * (mainSeekT / mainSeekArea.outerWidth());

    mainSHover.width(mainSeekT);

    const minutes = Math.floor(mainSeekLoc / 60);
    const seconds = Math.floor(mainSeekLoc - minutes * 60);
    
    if (minutes >= 0 && seconds >= 0) {
      const displayMinutes = minutes < 10 ? "0" + minutes : minutes;
      const displaySeconds = seconds < 10 ? "0" + seconds : seconds;
      mainSeekTime.text(displayMinutes + ":" + displaySeconds);
    } else {
      mainSeekTime.text("--:--");
    }

    mainSeekTime.css({ left: mainSeekT, "margin-left": "-21px" }).fadeIn(0);
  }

  // 시크바 호버 숨김
  function mainHideHover() {
    mainSHover.width(0);
    mainSeekTime.text("00:00").css({ left: "0px", "margin-left": "0px" }).fadeOut(0);
  }

  // 시크바 클릭 위치로 재생
  function mainPlayFromClickedPos() {
    if (mainAudio.duration === 0) return;
    mainAudio.currentTime = mainSeekLoc;
    mainSeekBar.width(mainSeekT);
    mainHideHover();
  }

  // 현재 시간 업데이트
  function mainUpdateCurrTime() {
    if (!mainAudio || mainAudio.duration === 0) return;

    const curMinutes = Math.floor(mainAudio.currentTime / 60);
    const curSeconds = Math.floor(mainAudio.currentTime - curMinutes * 60);
    const durMinutes = Math.floor(mainAudio.duration / 60);
    const durSeconds = Math.floor(mainAudio.duration - durMinutes * 60);
    const playProgress = (mainAudio.currentTime / mainAudio.duration) * 100;

    const displayCurMin = curMinutes < 10 ? "0" + curMinutes : curMinutes;
    const displayCurSec = curSeconds < 10 ? "0" + curSeconds : curSeconds;
    const displayDurMin = durMinutes < 10 ? "0" + durMinutes : durMinutes;
    const displayDurSec = durSeconds < 10 ? "0" + durSeconds : durSeconds;

    mainCurrentTime.text(displayCurMin + ":" + displayCurSec);
    mainTrackLength.text(displayDurMin + ":" + displayDurSec);
    mainSeekBar.width(playProgress + "%");

    if (playProgress >= 100) {
      mainPlayPauseButton.find("i").attr("class", "fas fa-play");
      mainSeekBar.width(0);
      mainCurrentTime.text("00:00");
      mainAlbumArt.removeClass("buffering").removeClass("active");
      clearInterval(mainBuffInterval);
    }
  }

  // 버퍼링 체크
  function mainCheckBuffering() {
    clearInterval(mainBuffInterval);
    mainBuffInterval = setInterval(function () {
      // 간단한 버퍼링 체크 로직
      if (mainAudio.readyState < 3) {
        mainAlbumArt.addClass("buffering");
      } else {
        mainAlbumArt.removeClass("buffering");
      }
    }, 100);
  }

  // 이벤트 리스너 등록
  mainPlayPauseButton.on("click", mainPlayPause);
  mainSeekArea.mousemove(mainShowHover);
  mainSeekArea.mouseout(mainHideHover);
  mainSeekArea.on("click", mainPlayFromClickedPos);
  $(mainAudio).on("timeupdate", mainUpdateCurrTime);

  // 음악 음소거 토글 (첫 클릭 시 unmute하여 소리 활성화)
  mainMusicToggle.on("click", function() {
    if (mainAudio.muted) {
      // 음소거 해제 (첫 사용자 상호작용으로 소리 활성화)
      mainAudio.muted = false;
      mainMusicToggle.find("i").attr("class", "fas fa-volume-up");
      $("#main-music-player").removeClass("music-disabled");
      console.log("🔊 음소거 해제 - 소리 활성화");
    } else {
      // 음소거 활성화
      mainAudio.muted = true;
      mainMusicToggle.find("i").attr("class", "fas fa-volume-mute");
      $("#main-music-player").addClass("music-disabled");
      console.log("🔇 음소거 활성화");
    }
  });

  // 모든 최소화 관련 기능 제거됨

  // 이전 곡
  mainPrevButton.on("click", function() {
    playPreviousTrack();
  });

  // 다음 곡
  mainNextButton.on("click", function() {
    playNextTrack();
  });

  // 플레이리스트 모달
  mainPlaylistButton.on("click", function() {
    showPlaylistModal();
  });

  console.log("✅ 메인 음악 플레이어 초기화 완료");
}

// 메인 음악 플레이리스트 로드
async function loadMainMusic() {
  try {
    // 메인 BGM용 memories 찾기 (여러개) - created_at 기준으로 정렬
    const { data: mainMemories, error: memoriesError } = await window.supabaseClient
      .from("memories")
      .select("id, created_at")
      .eq("tags", "#MAIN_BGM_ONLY")
      .order("created_at", { ascending: false });
      
    if (memoriesError) {
      console.error("BGM memories 조회 오류:", memoriesError);
      $("#main-music-player").hide();
      return;
    }
      
    if (!mainMemories || mainMemories.length === 0) {
      console.log("메인 BGM memory 없음 - #MAIN_BGM_ONLY 태그를 가진 memory가 없습니다");
      $("#main-music-player").hide();
      return;
    }
    
    console.log(`✅ BGM memories 발견: ${mainMemories.length}개`, mainMemories);

    // 모든 BGM 데이터 로드
    const playlistData = [];
    for (const memory of mainMemories) {
      const { data: musicData, error } = await window.supabaseClient
        .from("memory_music")
        .select("*")
        .eq("memory_id", memory.id);

      if (error) {
        console.error(`Memory ${memory.id}의 음악 데이터 조회 오류:`, error);
        continue;
      }

      if (musicData && musicData.length > 0) {
        console.log(`Memory ${memory.id}에서 ${musicData.length}개 음악 발견:`, musicData);
        playlistData.push(...musicData);
      } else {
        console.log(`Memory ${memory.id}에 음악 데이터 없음`);
      }
    }

    if (playlistData.length === 0) {
      console.log("❌ 메인 음악 데이터 없음 - memory_music 테이블에 해당하는 데이터가 없습니다");
      $("#main-music-player").hide();
      return;
    }

    playlist = playlistData;
    currentTrackIndex = 0;

    // 첫 번째 곡 로드
    loadTrackByIndex(0);

    // 항상 고정된 형태로 표시
    $("#main-music-player").removeClass("minimized").show();
    mainMusicMinimized = false;
    
    console.log(`✅ 플레이리스트 로드 완료: ${playlist.length}곡`);

  } catch (error) {
    console.error("메인 음악 로드 실패:", error);
    $("#main-music-player").hide();
  }
}

// 특정 인덱스의 트랙 로드
function loadTrackByIndex(index, shouldAutoPlay = false) {
  if (index < 0 || index >= playlist.length) return;

  currentTrackIndex = index;
  const musicData = playlist[index];

  let musicUrl = null;
  let albumUrl = null;

  // 음악 URL 생성
  if (musicData.music_path) {
    const { data: musicUrlData } = window.supabaseClient.storage
      .from("media")
      .getPublicUrl(musicData.music_path);
    musicUrl = musicUrlData?.publicUrl;
  }

  // 앨범 커버 URL 생성
  if (musicData.album_path) {
    const { data: albumUrlData } = window.supabaseClient.storage
      .from("media")
      .getPublicUrl(musicData.album_path);
    albumUrl = albumUrlData?.publicUrl;
  }

  if (!musicUrl) {
    console.log("음악 URL 없음");
    return;
  }

  // UI 업데이트
  $("#main-track-name").text(musicData.music_title || "알 수 없는 제목");
  $("#main-album-name").text(musicData.artist_name || "알 수 없는 가수");
  $("#main-album-img").attr("src", albumUrl || DEFAULT_MAIN_ALBUM_COVER_URL);
  $("#main-player-bg-artwork").css("background-image", `url(${albumUrl || DEFAULT_MAIN_ALBUM_COVER_URL})`);

  // 오디오 설정
  const wasPlaying = !mainAudio.paused;
  mainAudio.src = musicUrl;
  mainAudio.load();

  mainAudio.onloadedmetadata = () => {
    const duration = mainAudio.duration;
    const minutes = Math.floor(duration / 60);
    const seconds = String(Math.floor(duration % 60)).padStart(2, "0");
    $("#main-track-length").text(`${minutes}:${seconds}`);

    // 이미 재생 중이었던 경우만 계속 재생 (트랙 변경 시)
    if (wasPlaying && !isPopupOpen) {
      mainAudio.play().then(() => {
        $("#main-player-track").addClass("active");
        $("#main-album-art").addClass("active");
        $("#main-play-pause-button i").attr("class", "fas fa-pause");
        $("#main-music-player").addClass("playing");
        console.log("🎵 트랙 변경 후 재생 계속:", musicData.music_title);
      }).catch((error) => {
        console.log("🔇 트랙 변경 후 재생 실패:", error.name);
      });
    }
  };

  // 곡이 끝나면 다음 곡으로
  mainAudio.onended = () => {
    playNextTrack();
  };

  console.log("✅ 트랙 로드:", musicData.music_title);
}

// 이전 곡 재생
function playPreviousTrack() {
  if (playlist.length <= 1) return;
  
  const prevIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : playlist.length - 1;
  loadTrackByIndex(prevIndex);
}

// 다음 곡 재생
function playNextTrack() {
  if (playlist.length <= 1) return;
  
  const nextIndex = currentTrackIndex < playlist.length - 1 ? currentTrackIndex + 1 : 0;
  loadTrackByIndex(nextIndex);
}

// 플레이리스트 모달 표시
function showPlaylistModal() {
  renderPlaylist();
  $("#playlist-modal").show();
  $("body").addClass("modal-open");

  // 모달 닫기 이벤트
  $("#playlist-close").off("click").on("click", function() {
    $("#playlist-modal").hide();
    $("body").removeClass("modal-open");
  });
}

// 플레이리스트 렌더링
function renderPlaylist() {
  const playlistContainer = $("#playlist-list");
  playlistContainer.empty();

  playlist.forEach((track, index) => {
    let albumUrl = null;
    if (track.album_path) {
      const { data: albumUrlData } = window.supabaseClient.storage
        .from("media")
        .getPublicUrl(track.album_path);
      albumUrl = albumUrlData?.publicUrl;
    }

    const duration = track.duration_seconds || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const isCurrentTrack = index === currentTrackIndex;
    const item = $(`
      <div class="playlist-item ${isCurrentTrack ? 'playing' : ''}" data-index="${index}">
        <div class="playlist-item-cover">
          <img src="${albumUrl || DEFAULT_MAIN_ALBUM_COVER_URL}" alt="앨범 커버">
        </div>
        <div class="playlist-item-info">
          <div class="playlist-item-title">${track.music_title || "알 수 없는 제목"}</div>
          <div class="playlist-item-artist">${track.artist_name || "알 수 없는 가수"}</div>
        </div>
        <div class="playlist-item-duration">${durationText}</div>
      </div>
    `);

    // 클릭 이벤트
    item.on("click", function() {
      const clickedIndex = parseInt($(this).data("index"));
      loadTrackByIndex(clickedIndex);
      renderPlaylist(); // 현재 재생 곡 표시 업데이트
    });

    playlistContainer.append(item);
  });
}

// 팝업 상태 업데이트 함수들
function pauseMainMusic() {
  console.log("🔇 pauseMainMusic 함수 호출됨");
  if (mainAudio && !mainAudio.paused) {
    mainAudio.pause();
    $("#main-player-track").removeClass("active");
    $("#main-album-art").removeClass("active");
    $("#main-play-pause-button i").attr("class", "fas fa-play");
    $("#main-music-player").removeClass("playing");
    console.log("🔇 메인 음악 일시정지 완료 (팝업 열림)");
  } else {
    console.log("🔇 메인 음악이 이미 정지되어 있거나 오디오가 없음");
  }
  isPopupOpen = true;
}

function resumeMainMusic() {
  console.log("🎵 resumeMainMusic 함수 호출됨");
  isPopupOpen = false;
  if (mainAudio && mainAudio.src) {
    // 이어서 재생 (currentTime 유지)
    mainAudio.play().then(() => {
      $("#main-player-track").addClass("active");
      $("#main-album-art").addClass("active");
      $("#main-play-pause-button i").attr("class", "fas fa-pause");
      $("#main-music-player").addClass("playing");
      console.log("🎵 메인 음악 재시작 완료");
    }).catch((error) => {
      console.log("❌ 메인 음악 재시작 실패:", error);
    });
  } else {
    console.log("🔇 메인 오디오가 없거나 소스가 설정되지 않음");
  }
}

// 전역 함수로 명시적으로 등록
window.pauseMainMusic = pauseMainMusic;
window.resumeMainMusic = resumeMainMusic;

// DOM 로드 후 초기화
$(document).ready(function() {
  initMainMusicPlayer();
  loadMainMusic();
  
  // 음표 아이콘 hover 및 클릭 이벤트 처리
  const musicIcon = $("#music-icon");
  const musicPlayer = $("#main-music-player");
  let hoverTimeout;
  let isPlayerPinned = false; // 고정 상태 추적
  
  // 클릭으로 고정/해제
  musicIcon.on("click", function(e) {
    e.stopPropagation();
    isPlayerPinned = !isPlayerPinned;
    
    if (isPlayerPinned) {
      // 플레이어 고정하고 음악 재생 시작
      clearTimeout(hoverTimeout);
      musicPlayer.css({
        "opacity": "1",
        "transform": "translateX(0)",
        "pointer-events": "auto"
      });
      
      // 음악이 일시정지 상태라면 자동으로 재생 시작
      if (mainAudio && mainAudio.paused && mainAudio.src) {
        $("#main-player-track").addClass("active");
        $("#main-album-art").addClass("active");
        $("#main-music-player").addClass("playing");
        $("#main-play-pause-button i").attr("class", "fas fa-pause");
        mainAudio.play().catch(error => console.log("음악 재생 실패:", error));
      }
    } else {
      // 플레이어 숨김
      musicPlayer.css({
        "opacity": "0",
        "transform": "translateX(-20px)",
        "pointer-events": "none"
      });
    }
  });
  
  // 마우스가 들어왔을 때 (고정되지 않은 경우에만)
  musicIcon.on("mouseenter", function() {
    if (!isPlayerPinned) {
      clearTimeout(hoverTimeout);
      musicPlayer.css({
        "opacity": "1",
        "transform": "translateX(0)",
        "pointer-events": "auto"
      });
    }
  });
  
  // 플레이어에서 마우스가 들어왔을 때
  musicPlayer.on("mouseenter", function() {
    if (!isPlayerPinned) {
      clearTimeout(hoverTimeout);
    }
  });
  
  // 음표 아이콘에서 마우스가 나갔을 때 (고정되지 않은 경우에만)
  musicIcon.on("mouseleave", function() {
    if (!isPlayerPinned) {
      hoverTimeout = setTimeout(() => {
        if (!musicPlayer.is(":hover")) {
          musicPlayer.css({
            "opacity": "0",
            "transform": "translateX(-20px)",
            "pointer-events": "none"
          });
        }
      }, 100);
    }
  });
  
  // 플레이어에서 마우스가 나갔을 때 (고정되지 않은 경우에만)
  musicPlayer.on("mouseleave", function() {
    if (!isPlayerPinned) {
      hoverTimeout = setTimeout(() => {
        if (!musicIcon.is(":hover")) {
          musicPlayer.css({
            "opacity": "0",
            "transform": "translateX(-20px)",
            "pointer-events": "none"
          });
        }
      }, 100);
    }
  });
  
  // 사용자의 첫 상호작용을 기다려서 음악 시작
  setTimeout(() => {
    if (playlist.length > 0 && mainAudio && mainAudio.src) {
      function startMusicOnFirstInteraction() {
        if (mainAudio.paused) {
          $("#main-player-track").addClass("active");
          $("#main-album-art").addClass("active");
          $("#main-music-player").addClass("playing");
          $("#main-play-pause-button i").attr("class", "fas fa-pause");
          mainAudio.play().catch(error => console.log("음악 시작 실패:", error));
        }
        
        // 이벤트 리스너 제거 (한 번만 실행)
        document.removeEventListener('click', startMusicOnFirstInteraction);
        document.removeEventListener('keydown', startMusicOnFirstInteraction);
        document.removeEventListener('touchstart', startMusicOnFirstInteraction);
      }
      
      document.addEventListener('click', startMusicOnFirstInteraction);
      document.addEventListener('keydown', startMusicOnFirstInteraction);
      document.addEventListener('touchstart', startMusicOnFirstInteraction);
    }
  }, 1000);
  
  console.log("✅ 메인 음악 플레이어 초기화 완료");
});