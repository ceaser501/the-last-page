const supabase = window.supabaseClient;
const wrapper = document.getElementById("garland-wrapper");

// 홈 버튼 클릭 이벤트 추가
document.addEventListener("DOMContentLoaded", function () {
  const homeIcon = document.getElementById("home-icon");
  if (homeIcon) {
    homeIcon.addEventListener("click", function () {
      console.log("홈 버튼 클릭됨");
      window.location.href = "index.html";
    });
  }
});

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

// 확장자 체크용 헬퍼
function isVideo(src) {
  return /\.(mp4|webm|ogg)$/i.test(src);
}

let mediaList = [];
let pathUpdateTimer = null; // 경로 업데이트 디바운싱 타이머
let rawMemories = [];
let photoPositions = []; // 발자취 경로를 위한 폴라로이드 위치 저장
let savedPathElement = null; // 저장된 발자취 경로 DOM 요소
let isAllRowsLoaded = false; // 모든 행이 로드되었는지 확인

// 발자취 경로를 그리는 함수
function createFootprintPath(saveAfterDraw = true) {
  console.log("🛤️ createFootprintPath 호출됨, saveAfterDraw:", saveAfterDraw);

  // 기존 경로 제거
  const existingPath = document.querySelector(".footprint-path");
  if (existingPath) {
    console.log("🛤️ 기존 경로 제거");
    existingPath.remove();
  }

  if (photoPositions.length < 2) return;

  // 이미지 순서대로 정렬하고 실제 DOM 위치 계산
  const sortedPositions = [...photoPositions]
    .sort((a, b) => a.index - b.index)
    .map((photo) => {
      const rect = photo.element.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();

      // wrapper 기준 상대 좌표로 계산
      const centerX = rect.left - wrapperRect.left + rect.width / 2;
      const centerY = rect.top - wrapperRect.top + rect.height / 2;

      return {
        x: centerX,
        y: centerY,
        row: photo.row,
        index: photo.index,
      };
    });

  // SVG 컨테이너 생성
  const pathContainer = document.createElement("div");
  pathContainer.className = "footprint-path";
  const wrapperHeight = wrapper.scrollHeight || 2000;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 1500 ${wrapperHeight}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMin meet");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  // 경로 데이터 생성 (부드러운 곡선)
  if (sortedPositions.length === 0) return;

  // 시작점을 첫 번째 폴라로이드보다 더 길게 왼쪽으로 이동
  const startX = sortedPositions[0].x - 250;
  const startY = sortedPositions[0].y;
  let pathData = `M ${startX} ${startY} L ${sortedPositions[0].x} ${sortedPositions[0].y}`;

  for (let i = 1; i < sortedPositions.length; i++) {
    const prev = sortedPositions[i - 1];
    const curr = sortedPositions[i];

    // 행이 바뀌는 경우 실제로 바깥쪽으로 돌아가는 경로
    if (prev.row !== curr.row) {
      const midY = (prev.y + curr.y) / 2;

      // 실제 폴라로이드 번호 기반 패턴 결정
      // 7→8번: 오른쪽→오른쪽
      // 12→13번: 왼쪽→왼쪽
      // 19→20번: 오른쪽→오른쪽 (7→8과 동일)

      // 실제 인덱스로 패턴 결정
      const transitionIndex = prev.index + 1; // 1-based index
      let shouldGoRight;

      if (transitionIndex === 7) {
        // 7→8
        shouldGoRight = true;
      } else if (transitionIndex === 12) {
        // 12→13
        shouldGoRight = false;
      } else if (transitionIndex === 19) {
        // 19→20
        shouldGoRight = true;
      } else {
        // 다른 전환은 기본 패턴 사용 (행 번호 기준)
        shouldGoRight = prev.row % 2 === 0;
      }

      if (shouldGoRight) {
        // 오른쪽 패턴: 자연스러운 S자 곡선
        const extendX = prev.x + 70; // 적당히 오른쪽으로

        // 부드러운 Quadratic Bezier 곡선으로 연결
        pathData += ` Q ${extendX} ${prev.y + 50}, ${extendX} ${midY}`;
        pathData += ` Q ${extendX} ${curr.y - 50}, ${curr.x} ${curr.y}`;

        // 발자국 이미지 추가 (중간 지점에 1개 - 아래쪽 방향)
        const footprint = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "image"
        );
        footprint.setAttribute("href", "data/footprint.png");
        footprint.setAttribute("x", "-40");
        footprint.setAttribute("y", "-60");
        footprint.setAttribute("width", "80");
        footprint.setAttribute("height", "120");
        footprint.setAttribute(
          "transform",
          `translate(${extendX}, ${midY + 40}) rotate(180)`
        ); // 위치를 40px 아래로
        footprint.setAttribute("opacity", "0.5");
        //svg.appendChild(footprint);
      } else {
        // 왼쪽 패턴: 12번째 왼쪽으로 나와서 13번째 왼쪽으로 들어가는 곡선
        const extendX = Math.min(prev.x, curr.x) - 70; // 적당히 왼쪽으로

        // 부드러운 Quadratic Bezier 곡선으로 연결
        pathData += ` Q ${extendX} ${prev.y + 50}, ${extendX} ${midY}`;
        pathData += ` Q ${extendX} ${curr.y - 50}, ${curr.x} ${curr.y}`;

        // 12→13번은 발자국 없음
      }
    } else {
      // 같은 행 내에서는 간단한 곡선으로
      const controlX = (prev.x + curr.x) / 2;
      const controlY = prev.y - 25;
      pathData += ` Q ${controlX} ${controlY}, ${curr.x} ${curr.y}`;
    }
  }

  // 마지막에 끝점 추가 (마지막 폴라로이드에서 더 길게 나가기)
  if (sortedPositions.length > 0) {
    const lastPhoto = sortedPositions[sortedPositions.length - 1];
    const endX = lastPhoto.x + 150;
    const endY = lastPhoto.y;
    pathData += ` L ${endX} ${endY}`;
  }

  path.setAttribute("d", pathData);
  svg.appendChild(path);
  pathContainer.appendChild(svg);

  // wrapper에 추가
  wrapper.appendChild(pathContainer);

  // 경로 요소 저장 (나중에 복원용) - saveAfterDraw가 true일 때만
  if (saveAfterDraw && isAllRowsLoaded) {
    savedPathElement = pathContainer;
    console.log(
      "🛤️ 발자취 경로 생성 및 저장:",
      sortedPositions.length,
      "개 지점"
    );
  } else {
    console.log(
      "🛤️ 발자취 경로 생성 (저장 안 함):",
      sortedPositions.length,
      "개 지점"
    );
  }
}

// 저장된 발자취 경로를 복원하는 함수
function restoreSavedPath() {
  console.log("🛤️ restoreSavedPath 호출됨");

  // 기존 경로 확인
  const existingPath = document.querySelector(".footprint-path");
  console.log("🛤️ 기존 경로 존재:", !!existingPath);

  if (existingPath) {
    console.log("🛤️ 기존 경로가 이미 있음 - 유지");
    return; // 이미 경로가 있으면 그대로 둠
  }

  // 저장된 경로가 있으면 복원
  if (savedPathElement) {
    // 저장된 요소를 복제하여 추가
    const clonedPath = savedPathElement.cloneNode(true);
    wrapper.appendChild(clonedPath);
    console.log("🛤️ 저장된 발자취 경로 복원 완료");
  } else {
    console.log("⚠️ 저장된 발자취 경로가 없음");
  }
}

// 전역으로 사용 가능하도록 window 객체에 추가
window.restoreSavedPath = restoreSavedPath;

async function loadMediaFromSupabase() {
  // 메인 화면에서는 대표 이미지만 먼저 로드하여 초기 로딩 성능 향상
  const { data: memories, error } = await retrySupabaseOperation(() =>
    supabase
      .from("memories")
      .select("*, media_files!inner(media_url, is_main)")
      .eq("is_public", true)
      .eq("media_files.is_main", true) // 대표 이미지만 로드
      .order("order", { ascending: true })
  );

  if (error) {
    console.error("Supabase fetch error:", error);
    return;
  }
  console.log("📦 memories data (thumbnail only):", memories);

  // 원본 데이터는 상세 팝업에서 별도로 로드하도록 변경
  rawMemories = memories;
  mediaList = memories.map((item, index) => {
    const mainMedia = item.media_files?.[0]; // 대표 이미지만 있음

    return {
      mainSrc: mainMedia?.media_url || "",
      subSrcList: [], // 메인 화면에서는 서브 미디어 정보 제거
      type: mainMedia?.media_url.match(/\.(mp4|webm|ogg)$/i)
        ? "video"
        : "image",
      title: item.title,
      thumbnail_title: item.thumbnail_title,
      description: item.description,
      date: item.date,
      location: item.location,
      index: index,
      id: item.id, // 상세 팝업에서 사용할 ID 추가
    };
  });

  setupLazyRender();
}

const rotateAngles = [-10, 15, -25, 5, 5, -8, 2, -13, -7, 2, -3];

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");

        // 비디오 썸네일 지연 생성
        const videoImg = entry.target.querySelector(
          'img[data-video-thumbnail="pending"]'
        );
        if (videoImg) {
          generateVideoThumbnail(videoImg);
        }
      }
    });
  },
  { threshold: 0.1 }
);

// 비디오 썸네일 생성 함수 - 개선된 에러 핸들링 및 타이머 관리
function generateVideoThumbnail(thumbnailImg, retryCount = 0) {
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

  // 🔥 타임아웃 설정 (8초 후 강제 실패)
  timeoutId = setTimeout(() => {
    if (!isCompleted) {
      console.warn("⏰ 메인 비디오 썸네일 생성 타임아웃:", videoSrc);
      handleThumbnailError();
    }
  }, 8000);

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

    // 🔄 재시도 로직 (최대 1회 - 메인 화면은 빠른 로딩 우선)
    if (retryCount < 1) {
      console.log(
        `🔄 메인 썸네일 생성 재시도 (${retryCount + 1}/1):`,
        videoSrc
      );

      // 1초 후 재시도
      setTimeout(() => {
        generateVideoThumbnail(thumbnailImg, retryCount + 1);
      }, 1000);
      return;
    }

    // 최종 실패 - 에러 이미지 표시
    thumbnailImg.src =
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='150' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23ffebee'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23c62828' font-family='Arial' font-size='11'>로딩실패</text></svg>";
    thumbnailImg.setAttribute("data-video-thumbnail", "error");
  }

  videoForThumb.addEventListener("loadedmetadata", () => {
    if (!isCompleted) {
      videoForThumb.currentTime = 0.1; // 첫 프레임보다 약간 뒤로
    }
  });

  videoForThumb.addEventListener("seeked", () => {
    if (isCompleted) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 150;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoForThumb, 0, 0, canvas.width, canvas.height);
      const dataURL = canvas.toDataURL("image/jpeg", 0.8); // 압축률 추가
      thumbnailImg.src = dataURL;
      thumbnailImg.setAttribute("data-video-thumbnail", "loaded");

      console.log("✅ 메인 비디오 썸네일 생성 완료:", videoSrc);
      cleanup();
    } catch (error) {
      console.error("❌ 메인 Canvas 렌더링 실패:", error);
      handleThumbnailError();
    }
  });

  videoForThumb.addEventListener("error", (e) => {
    console.error("❌ 메인 비디오 로딩 실패:", videoSrc, e);
    handleThumbnailError();
  });

  // 🔥 네트워크 상태 체크 추가
  videoForThumb.addEventListener("stalled", () => {
    console.warn("⚠️ 메인 비디오 로딩 지연:", videoSrc);
  });

  // DOM에 추가하여 로딩 시작
  document.body.appendChild(videoForThumb);
}

let pointer = 0;
let row = 0;

function generateRow() {
  if (pointer >= mediaList.length) {
    // 모든 행이 로드됨
    if (!isAllRowsLoaded) {
      isAllRowsLoaded = true;
      console.log("🛤️ 모든 행 로드 완료");

      // 모든 행이 로드된 후 최종 경로를 그리고 저장
      if (photoPositions.length > 0 && window.innerWidth > 768) {
        setTimeout(() => {
          createFootprintPath(true); // true = 저장함
        }, 500); // DOM 안정화를 위해 대기
      }
    }
    return;
  }

  // 모바일에서 월별 카테고리 처리 (한 번만 실행)
  if (window.innerWidth <= 768) {
    if (!document.querySelector(".mobile-romantic-message")) {
      generateMobileCategories();
    }
    return;
  }

  /*
  if (row === 1) {
    const flowerSticker = document.createElement("img");
    const flowerSticker2 = document.createElement("img");
    flowerSticker.src = "./data/flower.png";
    flowerSticker.alt = "flower Sticker";
    flowerSticker.style.position = "absolute";
    flowerSticker.style.top = "530px";
    flowerSticker.style.left = "calc(25% - 60px)";
    flowerSticker.style.width = "130px";
    flowerSticker.style.transform = "rotate(10deg) translateY(-1px)";
    flowerSticker.style.zIndex = "6";
    flowerSticker.style.pointerEvents = "none";

    flowerSticker2.src = "./data/flower.png";
    flowerSticker2.alt = "flower Sticker";
    flowerSticker2.style.position = "absolute";
    flowerSticker2.style.top = "530px";
    flowerSticker2.style.left = "calc(23% - 60px)";
    flowerSticker2.style.width = "130px";
    flowerSticker2.style.transform = "rotate(-6deg) translateY(-1px)";
    flowerSticker2.style.zIndex = "6";
    flowerSticker2.style.pointerEvents = "none";

    document.body.appendChild(flowerSticker);
    document.body.appendChild(flowerSticker2);
  }
    */

  if (row === 3) {
    // 중복 방지: 기존 스티커가 있는지 확인
    if (!document.querySelector(".heart-sticker-row3")) {
      const heartSticker = document.createElement("img");
      heartSticker.src = "./data/heart.png";
      heartSticker.alt = "heart Sticker";
      heartSticker.className = "heart-sticker2-row3"; // 클래스 추가로 중복 방지
      heartSticker.style.position = "absolute";
      heartSticker.style.top = "1155px";
      heartSticker.style.left = "calc(82% - 30px)";
      heartSticker.style.width = "90px";
      heartSticker.style.transform = "rotate(22deg) translateY(-25px)";
      heartSticker.style.zIndex = "6";
      heartSticker.style.pointerEvents = "none";

      document.body.appendChild(heartSticker);
    }
  }

  if (row === 4) {
    // 중복 방지: 기존 스티커가 있는지 확인
    if (
      !document.querySelector(".love-sticker-row4") &&
      !wrapper.querySelector(".date-tape")
    ) {
      const loveSticker = document.createElement("img");
      loveSticker.src = "./data/love.png";
      loveSticker.alt = "heart Sticker";
      loveSticker.className = "love-sticker-row4"; // 클래스 추가로 중복 방지
      loveSticker.style.position = "absolute";
      loveSticker.style.top = "1360px";
      loveSticker.style.left = "calc(21% - 60px)";
      loveSticker.style.width = "100px";
      loveSticker.style.transform = "rotate(0deg) translateY(-20px)";
      loveSticker.style.zIndex = "6";
      loveSticker.style.pointerEvents = "none";

      const dateTape = document.createElement("div");
      dateTape.className = "date-tape";
      dateTape.textContent = "2024.09.28 ~ 2026.04.12";
      dateTape.style.background = "#f2d9c6dc";
      dateTape.style.opacity = "0.8";
      dateTape.style.position = "absolute";
      dateTape.style.right = "500px";
      dateTape.style.margin = "10px auto -60px auto";
      dateTape.style.zIndex = "5";
      dateTape.style.fontFamily = "'Gloria Hallelujah', cursive";
      dateTape.style.fontSize = "22px";
      dateTape.style.fontWeight = "bold";
      dateTape.style.color = "#222";
      dateTape.style.transform = "translateX(180px) rotate(-2deg)";
      dateTape.style.maxWidth = "fit-content";

      wrapper.appendChild(loveSticker);
      wrapper.appendChild(dateTape);
    }
  }

  const imagesPerRow = row % 2 === 0 ? 7 : 6;
  const rowWrapper = document.createElement("div");
  rowWrapper.className = "garland-row";

  if (row % 2 === 1) {
    rowWrapper.style.marginBottom = "100px";
    rowWrapper.style.marginLeft = "70px";
    rowWrapper.style.marginTop = "50px";
  } else {
    if (row !== 0) rowWrapper.style.marginTop = "180px";
  }

  if (row == 1) {
    rowWrapper.style.marginTop = "-50px";
    rowWrapper.style.marginLeft = "90px"; // 첫 번째 줄을 더 왼쪽으로

    // couple.png 이미지 추가 (wrapper에 직접 추가)
    const existingCouple = document.querySelector(".couple-image");
    if (!existingCouple) {
      const coupleImg = document.createElement("img");
      coupleImg.src = "data/couple.png";
      coupleImg.className = "couple-image";
      wrapper.appendChild(coupleImg);
    }
  }

  const rope = document.createElement("div");
  rope.className = "garland-line";
  rowWrapper.appendChild(rope);

  const currentMedia = mediaList.slice(pointer, pointer + imagesPerRow);
  let prevDoubleTape = false; // 이전 테이프가 2개로 붙었다면, 다음엔 2개짜리가 못나옴

  currentMedia.forEach((media, j) => {
    const i = pointer + j;
    const photo = document.createElement("div"); // fancybox popup 뜨게할거면 a로 바꿔야함
    photo.className = "photo";
    // fancybox 안뜨게 임시 비활성화
    //photo.href = media.mainSrc;
    //photo.setAttribute("data-fancybox", "gallery");
    /*
    photo.setAttribute(
      "data-caption",
      `
        <h3>${media.title}</h3>
        <p>${media.description}</p>
        <p><strong>날짜:</strong> ${media.date || ""}</p>
        <p><strong>장소:</strong> ${media.location || ""}</p>
      `
    );
    */
    photo.setAttribute("data-index", i);

    const rotate = rotateAngles[i % rotateAngles.length];

    let order = j;
    if (row % 2 === 1) order = imagesPerRow - 1 - j;

    const spacing = 190;
    const totalRowWidth = spacing * imagesPerRow;
    const x = `calc(50% - ${totalRowWidth / 2}px + ${spacing * order}px)`;
    const y =
      row % 2 === 0
        ? 50 * Math.sin((Math.PI * j) / (imagesPerRow - 1)) + 80
        : 40 + 50 * j;

    photo.style.left = x;
    photo.style.top = `${y}px`;
    photo.style.setProperty("--rotate", `${rotate}deg`);

    const shadowX = 6 + rotate * 0.4;
    const shadowY = 8 + rotate * 0.2;
    photo.style.boxShadow = `${shadowX}px ${shadowY}px 18px rgba(0,0,0,0.45)`;

    // 미디어 컨텐츠를 감싸는 일관된 래퍼를 생성합니다.
    const photoVideoWrapper = document.createElement("div");
    photoVideoWrapper.className = "photo-video-wrapper";

    if (media.type === "video") {
      const thumbnail = document.createElement("img");
      thumbnail.className = "photo-img";

      // 기본 비디오 플레이스홀더 이미지 설정
      thumbnail.src =
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='150' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23f0f0f0'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-family='Arial' font-size='14'>비디오 로딩중...</text></svg>";
      thumbnail.setAttribute("data-video-src", media.mainSrc);
      thumbnail.setAttribute("data-video-thumbnail", "pending");

      const playIcon = document.createElement("div");
      playIcon.className = "play-icon";
      playIcon.innerHTML = "▶";

      photoVideoWrapper.appendChild(thumbnail);
      photoVideoWrapper.appendChild(playIcon);
    } else {
      const img = document.createElement("img");
      img.className = "photo-img";
      img.loading = "lazy";

      // 🔥 이미지 로딩 에러 핸들링 추가
      img.addEventListener("error", () => {
        console.error("❌ 메인 이미지 로딩 실패:", media.mainSrc);
        img.src =
          "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='150' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23ffebee'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23c62828' font-family='Arial' font-size='11'>이미지 로딩실패</text></svg>";
      });

      img.addEventListener("load", () => {
        console.log("✅ 메인 이미지 로딩 완료:", media.mainSrc);
      });

      img.src = media.mainSrc;
      photoVideoWrapper.appendChild(img);
    }

    // 사진 위에 날짜 표시
    if (media.date) {
      const dateElement = document.createElement("div");
      dateElement.className = "photo-date";
      dateElement.textContent = media.date;
      photoVideoWrapper.appendChild(dateElement);
    }

    const caption = document.createElement("figcaption");
    caption.innerText = media.thumbnail_title || `추억 ${i + 1}`;

    // 테이프 배치 로직

    if (!prevDoubleTape && Math.random() < 0.4) {
      // 40% 확률 - 대각선 테이프 2개
      prevDoubleTape = true;

      // 우측 상단
      const tape1 = document.createElement("div");
      tape1.className = "tape diagonal";
      tape1.style.top = "0px";
      tape1.style.left = "130px";
      tape1.style.transform = "rotate(45deg)";
      tape1.style.width = "70px";
      tape1.style.height = "20px";
      photo.appendChild(tape1);

      // 좌측 하단
      const tape2 = document.createElement("div");
      tape2.className = "tape diagonal";
      tape2.style.top = "190px";
      tape2.style.left = "-20px";
      tape2.style.transform = "rotate(45deg)";
      tape2.style.width = "60px";
      tape2.style.height = "16px";
      photo.appendChild(tape2);
    } else {
      // 60% 확률 - 상단 중앙 테이프 1개
      prevDoubleTape = false;

      const tape = document.createElement("div");
      tape.className = "tape";
      photo.appendChild(tape);
    }

    photo.appendChild(photoVideoWrapper);
    photo.appendChild(caption);

    photo.addEventListener("click", () => {
      // 메인 화면에서는 현재 미디어와 전체 미디어 리스트를 넘김
      console.log(
        "🔍 메인에서 팝업 열기 - media.id:",
        mediaList[i].id,
        "index:",
        i,
        "total:",
        mediaList.length
      );
      openDetailPopup(mediaList[i], mediaList);
    });

    // 폴라로이드 위치 저장 (발자취 경로용)
    photoPositions.push({
      element: photo,
      index: i,
      row: row,
    });

    rowWrapper.appendChild(photo);
    observer.observe(photo);
  });

  wrapper.appendChild(rowWrapper);
  pointer += imagesPerRow;
  row++;

  // 각 행이 생성될 때 경로 업데이트 (저장하지 않음)
  // 모든 행이 로드되기 전까지만 경로 업데이트
  if (!savedPathElement && !isAllRowsLoaded) {
    // 저장된 경로가 없고, 아직 모든 행이 로드되지 않았을 때만
    if (pathUpdateTimer) clearTimeout(pathUpdateTimer);
    pathUpdateTimer = setTimeout(() => {
      createFootprintPath(false); // false = 저장하지 않음
    }, 100); // 레이아웃 완료 후 실행
  } else if (savedPathElement) {
    console.log("🛤️ 저장된 경로가 있음 - 행 추가 시 경로 업데이트 스킵");
  }
}

function setupLazyRender() {
  const sentinel = document.createElement("div");
  sentinel.id = "scroll-sentinel";
  document.body.appendChild(sentinel);

  const scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      generateRow();
    }
  });

  scrollObserver.observe(sentinel);

  // 최초 2줄만 먼저 렌더
  generateRow();
  generateRow();

  // 첫 번째와 두 번째 줄 사이에 로맨틱 멘트 추가
  addRomanticMessage();
}

// 벽 낙서 스타일 로맨틱 멘트 추가 함수
function addRomanticMessage() {
  // 이미 추가되었으면 중복 방지
  if (document.querySelector(".wall-graffiti")) return;

  const message = document.createElement("div");
  message.className = "wall-graffiti";
  message.innerHTML =
    "<span class='graffiti-heart-left'>♥</span> 우리가 함께 했던 이 타임라인들 처럼, <br> 나의 오늘 그리고 모든 내일을 함께 하고 싶어 <span class='graffiti-heart-right'>♥</span>";

  // 첫 번째 줄과 두 번째 줄 사이에 삽입
  const rows = wrapper.querySelectorAll(".garland-row");
  if (rows.length >= 2) {
    // 두 번째 줄 앞에 삽입
    wrapper.insertBefore(message, rows[1]);
  } else {
    // 줄이 충분하지 않으면 wrapper 끝에 추가
    wrapper.appendChild(message);
  }
}

// 모바일 카테고리 생성 함수
function generateMobileCategories() {
  // 모바일에서 로맨틱 메시지를 맨 위에 추가
  const mobileMessage = document.createElement("div");
  mobileMessage.className = "mobile-romantic-message";
  mobileMessage.innerHTML =
    '<span class="mobile-heart-left">♥</span> 우리가 함께 했던 이 타임라인들 처럼, <br> 나의 오늘 그리고 모든 내일을 함께 하고 싶어 <span class="mobile-heart-right">♥</span>';
  mobileMessage.style.fontSize = "13px";
  mobileMessage.style.lineHeight = "1.6";
  mobileMessage.style.padding = "40px 15px";
  mobileMessage.style.textAlign = "center";
  mobileMessage.style.color = "#666";
  mobileMessage.style.fontFamily = "'Noto Sans KR', sans-serif";
  mobileMessage.style.borderBottom = "1px solid #eee";
  mobileMessage.style.marginBottom = "10px";
  wrapper.appendChild(mobileMessage);

  // 날짜별로 그룹화
  const groupedByMonth = {};

  mediaList.forEach((media) => {
    if (media.date) {
      const date = new Date(media.date);
      const yearMonth = `${date.getFullYear()}.${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!groupedByMonth[yearMonth]) {
        groupedByMonth[yearMonth] = [];
      }
      groupedByMonth[yearMonth].push(media);
    }
  });

  // 월별로 정렬 (오래된 순)
  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) =>
    a.localeCompare(b)
  );

  // 각 월별로 카드 생성
  sortedMonths.forEach((month) => {
    // 월 카테고리 헤더 생성
    const monthHeader = document.createElement("div");
    monthHeader.className = "month-category-header";
    monthHeader.innerHTML = `<h3>${month}</h3>`;
    //monthHeader.style.padding = "20px 15px 10px";
    monthHeader.style.fontSize = "18px";
    monthHeader.style.fontWeight = "600";
    monthHeader.style.color = "#444";
    monthHeader.style.fontFamily = "'Noto Sans KR', sans-serif";
    wrapper.appendChild(monthHeader);

    // 해당 월의 카드들을 담을 컨테이너
    const monthContainer = document.createElement("div");
    monthContainer.className = "month-container";
    monthContainer.style.display = "flex";
    monthContainer.style.flexDirection = "column";
    monthContainer.style.gap = "15px";
    monthContainer.style.padding = "0 0 20px";
    monthContainer.style.alignItems = "stretch";
    monthContainer.style.width = "100%";

    // 해당 월의 미디어들로 카드 생성
    groupedByMonth[month].forEach((media) => {
      const card = document.createElement("div");
      card.className = "photo";
      card.style.width = "100%";

      // mainSrc 사용 (loadMediaFromSupabase에서 설정한 속성)
      const mediaSrc = media.mainSrc || media.media_url || media.thumbnail_url;
      const isVideo = media.type === "video" || media.is_video;

      // 비디오인 경우
      if (isVideo) {
        const videoWrapper = document.createElement("div");
        videoWrapper.className = "photo-video-wrapper";

        // 비디오는 썸네일 생성을 위해 video 태그 사용
        const video = document.createElement("video");
        video.src = mediaSrc;
        video.className = "photo-img";
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        videoWrapper.appendChild(video);

        // 비디오 썸네일 생성
        if (mediaSrc) {
          generateVideoThumbnail(mediaSrc, video);
        }

        card.appendChild(videoWrapper);
      } else {
        // 이미지인 경우
        const img = document.createElement("img");
        img.src = mediaSrc;
        img.alt = media.title || "";
        img.className = "photo-img";
        img.loading = "lazy";
        card.appendChild(img);
      }

      // 텍스트 정보를 담을 컨테이너
      const textContainer = document.createElement("div");
      textContainer.style.flex = "1";
      textContainer.style.display = "flex";
      textContainer.style.flexDirection = "column";
      textContainer.style.gap = "4px";

      // 타이틀
      const title = document.createElement("div");
      title.className = "photo-title";
      title.textContent = media.thumbnail_title || media.title || "";
      title.style.marginBottom = "0";
      textContainer.appendChild(title);

      // 날짜
      if (media.date) {
        const dateElement = document.createElement("div");
        dateElement.className = "date-element";
        dateElement.style.fontSize = "11px";
        dateElement.style.color = "#888";
        dateElement.style.fontFamily = "'Noto Sans KR', sans-serif";
        const formattedDate = media.date.replace(/-/g, ".");
        dateElement.textContent = formattedDate;
        textContainer.appendChild(dateElement);
      }

      // 태그
      if (media.tags) {
        const tagsElement = document.createElement("div");
        tagsElement.style.fontSize = "10px";
        tagsElement.style.color = "#999";
        tagsElement.style.fontFamily = "'Noto Sans KR', sans-serif";
        tagsElement.style.marginTop = "2px";

        // 태그를 쉼표로 구분하고 # 붙이기
        const tagList = media.tags
          .split(",")
          .map((tag) => `#${tag.trim()}`)
          .join(" ");
        tagsElement.textContent = tagList;
        textContainer.appendChild(tagsElement);
      }

      card.appendChild(textContainer);

      // 클릭 이벤트
      card.addEventListener("click", () => {
        openDetailPopup(media, mediaList);
      });

      monthContainer.appendChild(card);
      observer.observe(card);
    });

    wrapper.appendChild(monthContainer);
  });

  isAllRowsLoaded = true;
}

//setupLazyRender();
loadMediaFromSupabase();

// Fancybox 연결
/*
Fancybox.bind("[data-fancybox='gallery']", {
  animated: true,
  showClass: "f-fadeIn",
  hideClass: "f-fadeOut",
  groupAll: true,
  dragToClose: false,
  Image: {
    zoom: true,
    fit: "contain",
    maxWidth: "100%",
    maxHeight: "100%",
  },
  Thumbs: {
    autoStart: true,
  },
});
*/

// 벚꽃 애니메이션
$(document).ready(function () {
  const sakuraContainer = document.getElementById("sakura-container");

  function createSakuraPetal() {
    const petal = document.createElement("div");
    petal.className = "sakura-petal";
    // 랜덤 크기
    const size = Math.random() * 15 + 10;
    petal.style.width = size + "px";
    petal.style.height = size + "px";
    // 랜덤 시작 위치 (화면 전체 상단에서 시작)
    petal.style.left = Math.random() * 100 + "%";
    // 랜덤 애니메이션 지속 시간
    petal.style.animationDuration = Math.random() * 10 + 10 + "s";
    // 랜덤 애니메이션 지연
    petal.style.animationDelay = Math.random() * 5 + "s";
    // 투명도 설정
    petal.style.opacity = Math.random() * 0.5 + 0.3;
    sakuraContainer.appendChild(petal);
    // 애니메이션 종료 후 제거
    setTimeout(() => {
      petal.remove();
    }, 20000);
  }

  // 초기 꽃잎 생성
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      createSakuraPetal();
    }, i * 300);
  }

  // 지속적으로 꽃잎 생성
  setInterval(createSakuraPetal, 2000);
});
