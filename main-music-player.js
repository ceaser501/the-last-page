// 메인 음악 플레이어 전역 변수
let mainAudio = null;
let mainMusicMinimized = false;
let isPopupOpen = false;
let detailMusicWasPlayed = false; // 상세팝업에서 실제로 음악이 재생되었는지 추적

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
  mainAudio.loop = false; // 플레이리스트 재생을 위해 false로 변경
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
    setTimeout(function () {
      if (mainAudio.paused) {
        mainPlayerTrack.addClass("active");
        mainAlbumArt.addClass("active");
        $("#main-music-player").addClass("playing");
        mainCheckBuffering();
        mainPlayPauseButton.find("i").attr("class", "fas fa-pause");
        mainAudio.play().then(() => {
          // 모바일에서 토글 스위치 ON으로 설정
          if (window.innerWidth <= 768) {
            const musicToggle = document.getElementById('music-toggle-input');
            if (musicToggle) {
              musicToggle.checked = true;
            }
          }
        }).catch(error => console.log("메인 음악 재생 실패:", error));
      } else {
        mainPlayerTrack.removeClass("active");
        mainAlbumArt.removeClass("active");
        $("#main-music-player").removeClass("playing");
        clearInterval(mainBuffInterval);
        mainAlbumArt.removeClass("buffering");
        mainPlayPauseButton.find("i").attr("class", "fas fa-play");
        mainAudio.pause();
        
        // 모바일에서 토글 스위치 OFF로 설정
        if (window.innerWidth <= 768) {
          const musicToggle = document.getElementById('music-toggle-input');
          if (musicToggle) {
            musicToggle.checked = false;
          }
        }
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

    // 첫 번째 곡 로드 및 자동 재생 시도
    loadTrackByIndex(0, true);

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
  const trackNameElement = $("#main-track-name");
  trackNameElement.text(musicData.music_title || "알 수 없는 제목");

  // 텍스트가 넘치는지 체크하여 롤링 애니메이션 적용
  setTimeout(() => {
    const element = trackNameElement[0];
    if (element && element.scrollWidth > element.clientWidth) {
      trackNameElement.addClass("marquee-enabled");
    } else {
      trackNameElement.removeClass("marquee-enabled");
    }
  }, 100);

  $("#main-album-name").text(musicData.artist_name || "알 수 없는 가수");
  $("#main-album-img").attr("src", albumUrl || DEFAULT_MAIN_ALBUM_COVER_URL);
  $("#main-player-bg-artwork").css("background-image", `url(${albumUrl || DEFAULT_MAIN_ALBUM_COVER_URL})`);

  // 오디오 설정
  const wasPlaying = !mainAudio.paused;
  mainAudio.src = musicUrl;
  mainAudio.load();
  
  // 플레이리스트가 1곡만 있으면 루프 설정
  if (playlist.length === 1) {
    mainAudio.loop = true;
  } else {
    mainAudio.loop = false;
  }

  mainAudio.onloadedmetadata = () => {
    const duration = mainAudio.duration;
    const minutes = Math.floor(duration / 60);
    const seconds = String(Math.floor(duration % 60)).padStart(2, "0");
    $("#main-track-length").text(`${minutes}:${seconds}`);

    // 자동 재생 요청이 있는 경우 재생 시도 (페이지 로드 시 자동재생 포함)
    if (shouldAutoPlay && !isPopupOpen) {
      // 브라우저 자동재생 정책으로 인해 실패할 수 있음
      mainAudio.play().then(() => {
        $("#main-player-track").addClass("active");
        $("#main-album-art").addClass("active");
        $("#main-play-pause-button i").attr("class", "fas fa-pause");
        $("#main-music-player").addClass("playing");
        console.log("🎵 자동 재생 성공:", musicData.music_title);
      }).catch((error) => {
        console.log("🔇 자동 재생 실패 (브라우저 정책):", error.name);
        console.log("💡 사용자가 직접 재생 버튼을 눌러주세요.");
        
        // 자동재생 실패 시 UI 설정
        $("#main-player-track").removeClass("active");
        $("#main-album-art").removeClass("active");
        $("#main-play-pause-button i").attr("class", "fas fa-play");
        $("#main-music-player").removeClass("playing");
        
        // 자동재생 실패 - 조용히 로그만 출력
      });
    } else {
      // 자동재생 안 할 때는 정지 상태로 UI 설정
      $("#main-player-track").removeClass("active");
      $("#main-album-art").removeClass("active");
      $("#main-play-pause-button i").attr("class", "fas fa-play");
      $("#main-music-player").removeClass("playing");
    }
  };

  // 곡이 끝나면 자동으로 다음 곡 재생 (1곡일 때는 loop가 처리함)
  mainAudio.onended = () => {
    if (playlist.length > 1) {
      console.log("🎵 곡 재생 완료 - 다음 곡 자동 재생");
      playNextTrack(true); // autoPlay = true로 다음 곡 자동 재생
    }
  };

  console.log("✅ 트랙 로드:", musicData.music_title);
}

// 이전 곡 재생
function playPreviousTrack() {
  if (playlist.length === 0) return;
  
  // 플레이리스트가 1개만 있어도 다시 재생 (처음부터)
  if (playlist.length === 1) {
    loadTrackByIndex(0, false); // 자동재생 안함
    return;
  }
  
  const prevIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : playlist.length - 1;
  loadTrackByIndex(prevIndex, false); // 자동재생 안함
}

// 다음 곡 재생
function playNextTrack(autoPlay = false) {
  if (playlist.length === 0) return;

  // 플레이리스트가 1개만 있어도 다시 재생 (처음부터)
  if (playlist.length === 1) {
    loadTrackByIndex(0, autoPlay);
    return;
  }

  const nextIndex = currentTrackIndex < playlist.length - 1 ? currentTrackIndex + 1 : 0;
  loadTrackByIndex(nextIndex, autoPlay);
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
      <div class="playlist-item ${isCurrentTrack ? 'playing' : ''}" data-index="${index}" draggable="true">
        <div class="playlist-item-drag-handle">≡</div>
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

    // 클릭 이벤트 (드래그 핸들 제외)
    item.on("click", function(e) {
      if ($(e.target).hasClass("playlist-item-drag-handle")) return;
      const clickedIndex = parseInt($(this).data("index"));
      loadTrackByIndex(clickedIndex, true); // 플레이리스트에서 선택 시 자동재생
      renderPlaylist(); // 현재 재생 곡 표시 업데이트
    });

    // 드래그 이벤트
    item.on("dragstart", function(e) {
      e.originalEvent.dataTransfer.setData("text/plain", index);
      $(this).addClass("dragging");
    });

    item.on("dragend", function() {
      $(this).removeClass("dragging");
      $(".playlist-item").removeClass("drag-over");
    });

    item.on("dragover", function(e) {
      e.preventDefault();
      $(this).addClass("drag-over");
    });

    item.on("dragleave", function() {
      $(this).removeClass("drag-over");
    });

    item.on("drop", function(e) {
      e.preventDefault();
      $(this).removeClass("drag-over");

      const fromIndex = parseInt(e.originalEvent.dataTransfer.getData("text/plain"));
      const toIndex = parseInt($(this).data("index"));

      if (fromIndex !== toIndex) {
        // 플레이리스트 순서 변경
        const movedItem = playlist.splice(fromIndex, 1)[0];
        playlist.splice(toIndex, 0, movedItem);

        // 현재 재생 중인 트랙 인덱스 업데이트
        if (currentTrackIndex === fromIndex) {
          currentTrackIndex = toIndex;
        } else if (fromIndex < currentTrackIndex && toIndex >= currentTrackIndex) {
          currentTrackIndex--;
        } else if (fromIndex > currentTrackIndex && toIndex <= currentTrackIndex) {
          currentTrackIndex++;
        }

        console.log(`🎵 플레이리스트 순서 변경: ${fromIndex} → ${toIndex}`);
        renderPlaylist();
      }
    });

    playlistContainer.append(item);
  });
}

// 팝업 상태 업데이트 함수들 - 스마트 음악 전환
let wasPlayingBeforeDetailMusic = false; // 상세팝업 음악 재생 전 배경음악 상태 저장

function pauseMainMusic() {
  console.log("🎵 pauseMainMusic 호출 - 상세팝업 열기 (배경음악은 계속 재생)");
  isPopupOpen = true;
  detailMusicWasPlayed = false; // 팝업이 새로 열릴 때마다 초기화
  
  // 팝업이 열리기만 해서는 배경음악을 정지하지 않음
  console.log("🎵 배경음악 계속 재생 중 - 상세팝업 음악 재생 시에만 일시정지됩니다");
}

// 상세팝업에서 음악이 실제로 재생되었을 때 호출되는 함수
function pauseMainMusicForDetailMusic() {
  console.log("🔇 상세팝업 음악 재생으로 인한 배경음악 일시정지");
  detailMusicWasPlayed = true;
  
  // 현재 배경음악 재생 상태를 저장
  wasPlayingBeforeDetailMusic = mainAudio && mainAudio.src && !mainAudio.paused;
  
  if (wasPlayingBeforeDetailMusic) {
    console.log("🔇 배경음악 일시정지 실행 중...");
    mainAudio.pause();
    $("#main-player-track").removeClass("active");
    $("#main-album-art").removeClass("active");
    $("#main-play-pause-button i").attr("class", "fas fa-play");
    $("#main-music-player").removeClass("playing");
    console.log("🔇 배경음악 일시정지 완료 (상세팝업 닫으면 재개됩니다)");
  } else {
    console.log("🎵 배경음악이 재생 중이 아니었으므로 상태 유지");
  }
}

function resumeMainMusic() {
  console.log("🎵 resumeMainMusic 호출 - 팝업 닫기 시 배경음악 재개");
  isPopupOpen = false;
  
  if (mainAudio && mainAudio.src) {
    // 상세팝업에서 음악이 재생되어 배경음악이 일시정지되었다면 재개
    if (detailMusicWasPlayed && wasPlayingBeforeDetailMusic) {
      console.log("🎵 팝업 닫기 - 상세팝업 음악으로 일시정지된 배경음악 재개");
      mainAudio.play().then(() => {
        $("#main-player-track").addClass("active");
        $("#main-album-art").addClass("active");
        $("#main-play-pause-button i").attr("class", "fas fa-pause");
        $("#main-music-player").addClass("playing");
        console.log("✅ 배경음악 재생 재개 완료");
      }).catch((error) => {
        console.log("🔇 배경음악 재개 실패:", error.name);
        // 재생 실패 시 UI를 정지 상태로 설정
        $("#main-player-track").removeClass("active");
        $("#main-album-art").removeClass("active");
        $("#main-play-pause-button i").attr("class", "fas fa-play");
        $("#main-music-player").removeClass("playing");
      });
    } else if (detailMusicWasPlayed && !wasPlayingBeforeDetailMusic) {
      console.log("🎵 상세팝업 음악 재생 전에 배경음악이 정지 상태였으므로 정지 상태 유지");
    } else {
      console.log("🎵 상세팝업에서 음악이 재생되지 않았으므로 배경음악 상태는 그대로 유지");
    }
  } else {
    console.log("🔇 메인 오디오가 없거나 소스가 설정되지 않음");
  }
  
  // 상태 초기화
  detailMusicWasPlayed = false;
  wasPlayingBeforeDetailMusic = false;
}

// 자동재생 알림 함수 제거됨

// 전역 함수로 명시적으로 등록
window.pauseMainMusic = pauseMainMusic;
window.pauseMainMusicForDetailMusic = pauseMainMusicForDetailMusic;
window.resumeMainMusic = resumeMainMusic;

// 사용자 첫 상호작용 시 자동재생 시작
let userHasInteracted = false;

function startMusicOnFirstInteraction() {
  if (!userHasInteracted && mainAudio && mainAudio.src && mainAudio.paused) {
    userHasInteracted = true;
    console.log('🎵 사용자 상호작용 감지 - 배경음악 자동 시작');
    
    mainAudio.play().then(() => {
      $("#main-player-track").addClass("active");
      $("#main-album-art").addClass("active");
      $("#main-play-pause-button i").attr("class", "fas fa-pause");
      $("#main-music-player").addClass("playing");
      
      // 모바일에서 토글 스위치 ON으로 설정
      if (window.innerWidth <= 768) {
        const musicToggle = document.getElementById('music-toggle-input');
        if (musicToggle) {
          musicToggle.checked = true;
        }
      }
      
      // 플레이어는 고정하지 않음 - 오직 음표 아이콘 클릭에만 고정/해제
      console.log('✅ 배경음악 자동 시작 성공! (플레이어 고정 안됨)');
    }).catch((error) => {
      console.log('🔇 자동 시작 실패:', error.name);
    });
  }
}

// DOM 로드 후 초기화
$(document).ready(function() {
  initMainMusicPlayer();
  loadMainMusic();
  
  // index.html에서 YES 버튼을 통해 왔는지 확인
  const fromIndex = sessionStorage.getItem('fromIndex');
  const userInteracted = sessionStorage.getItem('userInteracted');
  
  if (fromIndex === 'true' && userInteracted === 'true') {
    // index에서 온 경우 즉시 자동재생 시도
    console.log("🎵 index.html에서 사용자 상호작용 후 이동 - 자동재생 시도");
    setTimeout(() => {
      startMusicOnFirstInteraction();
      // 모바일에서 토글 스위치 ON으로 설정
      if (window.innerWidth <= 768) {
        const musicToggle = document.getElementById('music-toggle-input');
        if (musicToggle) {
          musicToggle.checked = true;
        }
      }
      // 한 번 사용 후 삭제
      sessionStorage.removeItem('fromIndex');
    }, 500);
  }
  
  // 사용자 첫 상호작용 감지 (클릭, 터치, 키보드)
  const interactionEvents = ['click', 'touchstart', 'keydown'];
  interactionEvents.forEach(event => {
    document.addEventListener(event, startMusicOnFirstInteraction, { once: true });
  });
  
  // 음표 아이콘 hover 및 클릭 이벤트 처리
  const musicIcon = $("#music-icon");
  const musicPlayer = $("#main-music-player");
  const musicToggle = $("#music-toggle-input"); // 토글 스위치
  let hoverTimeout;
  let isPlayerPinned = false; // 고정 상태 추적
  
  // 모바일 체크
  const isMobile = window.innerWidth <= 768;
  
  // 모바일 토글 스위치 이벤트
  if (isMobile && musicToggle.length) {
    musicToggle.on("change", function() {
      if (mainAudio && mainAudio.src) {
        if (this.checked) {
          // ON - 음악 재생
          mainAudio.play().then(() => {
            $("#main-player-track").addClass("active");
            $("#main-album-art").addClass("active");
            $("#main-play-pause-button i").attr("class", "fas fa-pause");
            $("#main-music-player").addClass("playing");
            console.log("🎵 토글 ON - 음악 재생");
          }).catch((error) => {
            console.log("🔇 재생 실패:", error.name);
            this.checked = false; // 실패 시 토글 OFF
          });
        } else {
          // OFF - 음악 정지
          mainAudio.pause();
          $("#main-player-track").removeClass("active");
          $("#main-album-art").removeClass("active");
          $("#main-play-pause-button i").attr("class", "fas fa-play");
          $("#main-music-player").removeClass("playing");
          console.log("⏸️ 토글 OFF - 음악 정지");
        }
      }
    });
  }
  
  // 클릭으로 고정/해제
  musicIcon.on("click", function(e) {
    e.stopPropagation();
    
    if (isMobile) {
      // 모바일: 플레이어 표시 없이 음악만 재생/정지
      if (mainAudio && mainAudio.src) {
        if (mainAudio.paused) {
          mainAudio.play().then(() => {
            $("#main-player-track").addClass("active");
            $("#main-album-art").addClass("active");
            $("#main-play-pause-button i").attr("class", "fas fa-pause");
            $("#main-music-player").addClass("playing");
            // 아이콘 색상 변경으로 재생 상태 표시
            musicIcon.find("i").css("color", "#ff8fa3");
            
            // 토글 스위치 ON으로 설정
            const musicToggle = document.getElementById('music-toggle-input');
            if (musicToggle) {
              musicToggle.checked = true;
            }
            
            console.log("🎵 모바일 음악 재생");
          }).catch((error) => {
            console.log("🔇 재생 실패:", error.name);
          });
        } else {
          mainAudio.pause();
          $("#main-player-track").removeClass("active");
          $("#main-album-art").removeClass("active");
          $("#main-play-pause-button i").attr("class", "fas fa-play");
          $("#main-music-player").removeClass("playing");
          // 아이콘 색상 원래대로
          musicIcon.find("i").css("color", "");
          
          // 토글 스위치 OFF로 설정
          const musicToggle = document.getElementById('music-toggle-input');
          if (musicToggle) {
            musicToggle.checked = false;
          }
          
          console.log("⏸️ 모바일 음악 정지");
        }
      }
    } else {
      // PC: 기존대로 플레이어 표시/숨김
      isPlayerPinned = !isPlayerPinned;
      
      if (isPlayerPinned) {
        // 플레이어 고정하고 음악 재생 시작
        clearTimeout(hoverTimeout);
        musicPlayer.css({
          "opacity": "1",
          "transform": "translateX(0)",
          "pointer-events": "auto"
        });
        
        // 플레이어 고정하고 자동재생 시작
        if (mainAudio && mainAudio.src && mainAudio.paused) {
          mainAudio.play().then(() => {
            $("#main-player-track").addClass("active");
            $("#main-album-art").addClass("active");
            $("#main-play-pause-button i").attr("class", "fas fa-pause");
            $("#main-music-player").addClass("playing");
            console.log("🎵 음표 아이콘 클릭 - 자동재생 시작");
          }).catch((error) => {
            console.log("🔇 재생 실패:", error.name);
          });
        }
      } else {
        // 플레이어 숨김
        musicPlayer.css({
          "opacity": "0",
          "transform": "translateX(-20px)",
          "pointer-events": "none"
        });
      }
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
  
  // 자동재생 기능 활성화됨
  console.log("🎵 자동재생 기능 활성화 - index.html 진입 시 자동 시작");
  
  console.log("✅ 메인 음악 플레이어 초기화 완료");
});