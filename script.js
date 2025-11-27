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
  {
    threshold: 0.01,
    rootMargin: "200px", // 뷰포트 200px 전에 미리 로드
  }
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

      // 맨 마지막에 날짜 테이프 추가 (마지막 row 왼쪽 빈 공간)
      if (!wrapper.querySelector(".date-tape")) {
        // 마지막 row 찾기
        const allRows = wrapper.querySelectorAll(".garland-row");
        const lastRow = allRows[allRows.length - 1];

        if (lastRow) {
          const dateTape = document.createElement("div");
          dateTape.className = "date-tape";
          dateTape.innerHTML = `<strong style="font-size: 19px;">2024.09.28 ~ 2025.11.28</strong><br><br>연애의 시작부터 연애의 끝, 그리고 '결혼'이라는 이름의 시작까지<br><br>우리가 함께 한 <strong>426일</strong>은 매 순간이 행복이었고 반짝이는 순간들로 가득했어<br><br>나와 평생을 함께 해주길 바래, 사랑해❤️`;
          dateTape.style.background = "#f2d9c6dc";
          dateTape.style.opacity = "0.8";
          dateTape.style.position = "absolute";
          dateTape.style.zIndex = "5";
          dateTape.style.fontFamily =
            "'Poor Story', 'Gaegu', 'Patrick Hand', cursive";
          dateTape.style.fontSize = "17px";
          dateTape.style.fontWeight = "normal";
          dateTape.style.color = "#222";
          dateTape.style.transform = "rotate(-2deg)";
          dateTape.style.padding = "10px 40px";
          dateTape.style.textAlign = "center";
          dateTape.style.width = "fit-content";
          dateTape.style.lineHeight = "1.4";

          // 마지막 row의 위치 기준으로 왼쪽 빈 공간에 배치
          dateTape.style.top = `${lastRow.offsetTop + 40}px`;
          dateTape.style.left = "350px";

          wrapper.appendChild(dateTape);
        }
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
    // 중복 방지: 기존 로맨틱 멘트가 있는지 확인
    if (!wrapper.querySelector(".romantic-message-row4")) {
      // 첫 번째 멘트
      const message1 = document.createElement("div");
      message1.className = "romantic-message-row4 wall-graffiti";
      message1.innerHTML =
        "<span class='graffiti-heart-left'>♥</span> 우리가 함께 했던 이 시간들처럼, 나의 오늘 그리고 모든 내일을 함께 하고 싶어 <span class='graffiti-heart-right'>♥</span>";
      message1.style.position = "absolute";
      message1.style.right = "350px";
      message1.style.margin = "60px auto -60px auto";
      message1.style.textAlign = "left";
      wrapper.appendChild(message1);
    }
  }

  if (row === 6) {
    // 중복 방지: 기존 멘트가 있는지 확인
    if (!wrapper.querySelector(".romantic-message-row6")) {
      const message2 = document.createElement("div");
      message2.className = "romantic-message-row6 wall-graffiti";
      message2.innerHTML =
        "< 떠든 사람 > <br><br> 젤이쁘고 말안듣는 <span class='chalk-circle'>김보연</span>";
      message2.style.position = "absolute";
      message2.style.right = "380px";
      message2.style.margin = "20px auto -60px auto";
      message2.style.textAlign = "left";
      message2.style.transform = "rotate(-1deg)";
      message2.style.fontSize = "19px";
      wrapper.appendChild(message2);

      // 날짜 낙서 추가
      const dateGraffiti = document.createElement("div");
      dateGraffiti.className = "date-graffiti-row6";
      dateGraffiti.innerHTML =
        "2025.11.26<br>태수♥보연 왔다감<br>100년 후에 꼭 같이 오기<br>우리 사랑 뽀레버♥";
      dateGraffiti.style.position = "absolute";
      dateGraffiti.style.right = "180px";
      dateGraffiti.style.margin = "-40px auto -60px auto";
      dateGraffiti.style.textAlign = "left";
      dateGraffiti.style.transform = "rotate(3deg)";
      dateGraffiti.style.fontSize = "19px";
      dateGraffiti.style.fontFamily =
        "'Poor Story', 'Gaegu', 'Patrick Hand', cursive";
      dateGraffiti.style.color = "#222";
      dateGraffiti.style.opacity = "0.6";
      wrapper.appendChild(dateGraffiti);
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
      // 초기 화면 이미지는 즉시 로드, 나머지는 lazy (첫 50장은 eager)
      img.loading = i < 50 ? "eager" : "lazy";

      // 이미지 로딩 재시도 로직
      let retryCount = 0;
      const maxRetries = 2;

      const loadImage = () => {
        img.src = media.mainSrc;
      };

      // 🔥 이미지 로딩 에러 핸들링 + 빠른 재시도
      img.addEventListener("error", () => {
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(
            `⚠️ 이미지 로딩 재시도 ${retryCount}/${maxRetries}:`,
            media.mainSrc
          );
          // 500ms 후 빠른 재시도
          setTimeout(loadImage, 500);
        } else {
          console.error("❌ 메인 이미지 로딩 최종 실패:", media.mainSrc);
          img.src =
            "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='150' fill='%23ddd'><rect width='100%25' height='100%25' fill='%23ffebee'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23c62828' font-family='Arial' font-size='11'>이미지 로딩실패</text></svg>";
        }
      });

      loadImage();
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
    // 하트 스티커가 붙는 폴라로이드(13번째, 26번째)는 상단 중앙 테이프만
    if (i === 12 || i === 25) {
      // 상단 중앙 테이프 1개
      prevDoubleTape = false;

      const tape = document.createElement("div");
      tape.className = "tape";
      photo.appendChild(tape);
    } else if (!prevDoubleTape && Math.random() < 0.4) {
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

    // 하트 스티커 추가 (13번, 26번, 35번, 42번, 48번)
    if (i === 12 || i === 25 || i === 34 || i === 41 || i === 47) {
      const heartSticker = document.createElement("img");
      heartSticker.src = "./data/heart.png";
      heartSticker.alt = "heart Sticker";
      heartSticker.className = `heart-sticker-photo${i}`;
      heartSticker.style.position = "absolute";
      heartSticker.style.top = "-20px";
      heartSticker.style.left = "-20px";
      heartSticker.style.width = "80px";
      heartSticker.style.transform = "rotate(-15deg)";
      heartSticker.style.zIndex = "6";
      heartSticker.style.pointerEvents = "none";
      photo.appendChild(heartSticker);
    }

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

  const scrollObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // 한 번에 2줄씩 렌더링 (더 빠른 로딩)
        generateRow();
        if (currentIndex < mediaList.length) {
          generateRow();
        }
      }
    },
    {
      rootMargin: "400px", // 화면 하단 400px 전에 미리 로드
    }
  );

  scrollObserver.observe(sentinel);

  // 초기에 6줄 즉시 렌더링 (빠른 초기 로딩)
  for (let i = 0; i < 6; i++) {
    if (currentIndex < mediaList.length) {
      generateRow();
    }
  }

  // 첫 번째와 두 번째 줄 사이에 로맨틱 멘트 추가
  addRomanticMessage();

  // 추가 줄 빠르게 렌더링
  let preloadCount = 0;
  const preloadInterval = setInterval(() => {
    if (preloadCount < 4 && currentIndex < mediaList.length) {
      generateRow();
      preloadCount++;
    } else {
      clearInterval(preloadInterval);
      // 모든 줄 로드 후 스크롤
      setTimeout(() => {
        initializeScrollTo2024September();
      }, 300);
    }
  }, 100); // 100ms 간격으로 빠른 순차 로딩

  // 월별 타임라인 빠르게 생성
  setTimeout(() => {
    createMonthlyTimeline();
    // 타임라인 생성 후 다시 업데이트
    setTimeout(() => {
      updateTimelineOnScroll();
    }, 50);
  }, 200);
}

// 벽 낙서 스타일 로맨틱 멘트 추가 함수
function addRomanticMessage() {
  // 이미 추가되었으면 중복 방지
  if (document.querySelector(".main-romantic-message")) return;

  const message = document.createElement("div");
  message.className = "main-romantic-message wall-graffiti";
  message.innerHTML =
    "<span class='graffiti-heart-left'>♥</span> 처음 본 그날부터 지금까지, 이 모든 순간이 우리의 이야기야 <br> 매 순간 자기와 함께여서, 평범한 나의 오늘도 특별한 추억이 되어가 <span class='graffiti-heart-right'>♥</span>";

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

// 전체 월별 타임라인 생성
function createMonthlyTimeline() {
  const timelineMarkers = document.getElementById("timeline-markers");
  if (!timelineMarkers) {
    console.error("❌ 타임라인 마커 컨테이너를 찾을 수 없음");
    return;
  }

  // 모든 미디어의 날짜 수집
  const dates = mediaList
    .map((m) => m.date)
    .filter(Boolean)
    .map((d) => new Date(d));

  console.log("📅 미디어 리스트:", mediaList.length, "개");
  console.log("📅 날짜가 있는 미디어:", dates.length, "개");

  if (dates.length === 0) {
    console.error("❌ 날짜가 있는 미디어가 없음");
    return;
  }

  // 최소/최대 날짜 찾기
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  console.log("📅 최소 날짜:", minDate.toLocaleDateString());
  console.log("📅 최대 날짜:", maxDate.toLocaleDateString());

  // 시작 월과 끝 월 설정
  const startYear = minDate.getFullYear();
  const startMonth = minDate.getMonth();
  const endYear = maxDate.getFullYear();
  const endMonth = maxDate.getMonth();

  // 전체 월 리스트 생성
  const months = [];
  let currentYear = startYear;
  let currentMonth = startMonth;

  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    months.push({
      year: currentYear,
      month: currentMonth + 1, // 1-based
      label: `${currentYear}.${String(currentMonth + 1).padStart(2, "0")}`,
    });

    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }

  console.log(
    `📅 타임라인 생성: ${months.length}개월 (${months[0].label} ~ ${
      months[months.length - 1].label
    })`
  );

  // 타임라인 높이 계산
  const containerHeight = window.innerHeight - 200; // top: 120px, bottom: 80px
  const markerSpacing =
    months.length > 1 ? containerHeight / (months.length - 1) : 0;

  console.log(
    `📐 타임라인 높이: ${containerHeight}px, 마커 간격: ${markerSpacing}px`
  );

  // 각 월마다 마커 생성
  months.forEach((monthData, index) => {
    const marker = document.createElement("div");
    marker.className = "timeline-marker";
    marker.style.top = `${index * markerSpacing}px`;
    marker.setAttribute("data-year", monthData.year);
    marker.setAttribute("data-month", monthData.month);
    marker.setAttribute("data-label", monthData.label);

    // 점 생성
    const dot = document.createElement("div");
    dot.className = "timeline-dot";

    // 날짜 레이블 생성
    const dateLabel = document.createElement("div");
    dateLabel.className = "timeline-date";
    dateLabel.textContent = monthData.label;

    // 클릭 시 해당 월의 첫 사진으로 스크롤
    marker.addEventListener("click", () => {
      scrollToMonth(monthData.year, monthData.month);
    });

    marker.appendChild(dot);
    marker.appendChild(dateLabel);
    timelineMarkers.appendChild(marker);
  });

  console.log(`✅ 타임라인 마커 ${months.length}개 생성 완료`);
}

// 초기 스크롤을 2024.09로 설정하는 함수
function initializeScrollTo2024September() {
  const photos = document.querySelectorAll(".photo");

  for (let photo of photos) {
    const index = parseInt(photo.getAttribute("data-index"));
    const media = mediaList[index];

    if (media && media.date) {
      const photoDate = new Date(media.date);
      if (photoDate.getFullYear() === 2024 && photoDate.getMonth() + 1 === 9) {
        // 즉시 스크롤 (부드러운 애니메이션 없이)
        window.scrollTo({
          top: photo.offsetTop - 200,
          behavior: "auto",
        });
        console.log("✅ 초기 스크롤: 2024.09로 이동 완료");

        // 스크롤 후 타임라인 업데이트 및 초기 로드 플래그 해제
        setTimeout(() => {
          updateTimelineOnScroll();
          isInitialLoad = false; // 초기 로드 완료
          console.log("✅ 초기 로드 완료, 스크롤 이벤트 활성화");
        }, 200);
        return;
      }
    }
  }
}

// 특정 월의 첫 사진으로 스크롤
function scrollToMonth(year, month) {
  // 해당 월의 사진 찾기
  const photos = document.querySelectorAll(".photo");

  for (let photo of photos) {
    const index = parseInt(photo.getAttribute("data-index"));
    const media = mediaList[index];

    if (media && media.date) {
      const photoDate = new Date(media.date);
      if (
        photoDate.getFullYear() === year &&
        photoDate.getMonth() + 1 === month
      ) {
        photo.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
  }
}

// 스크롤에 따라 타임라인 업데이트
function updateTimelineOnScroll() {
  const markers = document.querySelectorAll(".timeline-marker");
  const photos = document.querySelectorAll(".photo");
  const timelineContainer = document.getElementById("timeline-container");
  const proposalSection = document.getElementById("proposal-section");

  if (!markers.length || !photos.length) return;

  // 프로포즈 섹션이 화면에 보이면 타임라인 숨기기
  if (proposalSection && timelineContainer) {
    const proposalRect = proposalSection.getBoundingClientRect();
    if (proposalRect.top < window.innerHeight) {
      timelineContainer.style.opacity = "0";
      timelineContainer.style.pointerEvents = "none";
    } else {
      timelineContainer.style.opacity = "1";
      timelineContainer.style.pointerEvents = "auto";
    }
  }

  // 현재 viewport에 보이는 사진들의 날짜 수집
  const viewportTop = window.scrollY;
  const viewportBottom = viewportTop + window.innerHeight;
  // viewport 상단 1/3 지점을 기준으로 (중앙보다 위쪽)
  const viewportReference = viewportTop + window.innerHeight / 3;

  let visibleMonths = new Set();
  let centerMonth = null;
  let minDistance = Infinity;
  let latestMonth = null;
  let latestDate = null;
  let earliestMonth = null;
  let earliestDate = null;

  // 페이지 상단/하단 근처 확인
  const documentHeight = document.documentElement.scrollHeight;
  const isNearTop = viewportTop <= 100;
  const isNearBottom = viewportBottom >= documentHeight - 100;

  photos.forEach((photo) => {
    const rect = photo.getBoundingClientRect();
    const photoTop = rect.top + window.scrollY;
    const photoBottom = photoTop + rect.height;
    const photoCenter = photoTop + rect.height / 2;

    // viewport에 보이는지 확인
    if (photoBottom >= viewportTop && photoTop <= viewportBottom) {
      const index = parseInt(photo.getAttribute("data-index"));
      const media = mediaList[index];

      if (media && media.date) {
        const photoDate = new Date(media.date);
        const year = photoDate.getFullYear();
        const month = photoDate.getMonth() + 1;
        const monthKey = `${year}-${month}`;

        visibleMonths.add(monthKey);

        // 가장 오래된 월 추적
        if (!earliestDate || photoDate < earliestDate) {
          earliestDate = photoDate;
          earliestMonth = monthKey;
        }

        // 가장 최신 월 추적
        if (!latestDate || photoDate > latestDate) {
          latestDate = photoDate;
          latestMonth = monthKey;
        }

        // viewport 상단 1/3 지점에 가장 가까운 사진의 월 찾기
        const distance = Math.abs(photoCenter - viewportReference);
        if (distance < minDistance) {
          minDistance = distance;
          centerMonth = monthKey;
        }
      }
    }
  });

  // 페이지 상단 근처면 가장 오래된 월을 active로 설정
  if (isNearTop && earliestMonth) {
    centerMonth = earliestMonth;
  }
  // 페이지 하단 근처면 가장 최신 월을 active로 설정
  else if (isNearBottom && latestMonth) {
    centerMonth = latestMonth;
  }

  // 디버깅: 보이는 월 출력
  if (visibleMonths.size > 0) {
    console.log(
      "📍 현재 화면에 보이는 월:",
      Array.from(visibleMonths).sort().join(", ")
    );
    console.log("📍 중앙 월 (active):", centerMonth);
  }

  // 모든 마커 업데이트
  let visibleCount = 0;
  let activeCount = 0;

  markers.forEach((marker) => {
    const year = parseInt(marker.getAttribute("data-year"));
    const month = parseInt(marker.getAttribute("data-month"));
    const monthKey = `${year}-${month}`;

    // 클래스 초기화
    marker.classList.remove("active", "passed", "visible");

    // 화면에 보이는 월만 표시
    if (visibleMonths.has(monthKey)) {
      marker.classList.add("visible");
      visibleCount++;

      if (monthKey === centerMonth) {
        // 현재 중앙에 있는 월
        marker.classList.add("active");
        activeCount++;
      } else {
        // viewport에 보이는 월이지만 중앙은 아님
        marker.classList.add("passed");
      }
    }
  });

  if (visibleCount > 0) {
    console.log(
      `📍 타임라인 업데이트: visible ${visibleCount}개, active ${activeCount}개`
    );
  }
}

// 스크롤 이벤트 리스너 등록 (throttle 적용)
let scrollTimeout;
let isInitialLoad = true; // 초기 로드 플래그

window.addEventListener("scroll", () => {
  // 초기 로드 중에는 스크롤 이벤트 무시
  if (isInitialLoad) {
    return;
  }

  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  scrollTimeout = setTimeout(() => {
    updateTimelineOnScroll();
  }, 50); // 50ms throttle
});

// 모바일 카테고리 생성 함수
function generateMobileCategories() {
  // 모바일에서 로맨틱 메시지를 맨 위에 추가
  const mobileMessage = document.createElement("div");
  mobileMessage.className = "mobile-romantic-message";
  mobileMessage.innerHTML =
    '<span class="mobile-heart-left">♥</span> 우리가 함께 했던 이 시간들처럼, <br> 나의 오늘 그리고 모든 내일을 함께 하고 싶어 <span class="mobile-heart-right">♥</span>';
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

  // 화면 크기에 따라 꽃잎 개수 조정
  const isMobile = window.innerWidth <= 768;
  const initialCount = isMobile ? 60 : 40; // 모바일에서 더 많이
  const interval = isMobile ? 700 : 1000; // 모바일에서 더 자주

  // 초기 꽃잎 생성
  for (let i = 0; i < initialCount; i++) {
    setTimeout(() => {
      createSakuraPetal();
    }, i * 150); // 더 빠르게 생성
  }

  // 지속적으로 꽃잎 생성
  setInterval(createSakuraPetal, interval);
});

// 프로포즈 영상 초기화
$(document).ready(function () {
  const videoWrapper = document.getElementById("proposal-video-wrapper");
  const thumbnail = document.getElementById("proposal-thumbnail");
  const playButton = document.getElementById("proposal-play-button");
  const video = document.getElementById("proposal-video");

  if (!videoWrapper || !thumbnail || !playButton || !video) return;

  const videoSrc = "https://lbjqzhqqxuqyvglslpne.supabase.co/storage/v1/object/public/media/video/propose.mp4";

  // 비디오에서 썸네일 생성
  const tempVideo = document.createElement("video");
  tempVideo.src = videoSrc;
  tempVideo.crossOrigin = "anonymous";
  tempVideo.muted = true;
  tempVideo.playsInline = true;
  tempVideo.preload = "metadata";

  tempVideo.addEventListener("loadedmetadata", function () {
    tempVideo.currentTime = 1; // 1초 지점 캡처
  });

  tempVideo.addEventListener("seeked", function () {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = tempVideo.videoWidth;
      canvas.height = tempVideo.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
      thumbnail.src = canvas.toDataURL("image/jpeg", 0.8);
      console.log("✅ 프로포즈 영상 썸네일 생성 완료");
    } catch (e) {
      console.error("❌ 썸네일 생성 실패:", e);
      // 실패 시 기본 배경 유지
    }
  });

  // 플레이 버튼 클릭 시 영상 재생
  playButton.addEventListener("click", function () {
    // 배경음악 일시정지
    if (typeof window.pauseMainMusicForDetailMusic === "function") {
      window.pauseMainMusicForDetailMusic();
    }

    videoWrapper.classList.add("playing");
    video.style.display = "block";
    video.play();
  });

  // 영상 끝나면 썸네일로 돌아가기 + 배경음악 재개
  video.addEventListener("ended", function () {
    videoWrapper.classList.remove("playing");
    video.style.display = "none";

    // 배경음악 재개
    if (typeof window.resumeMainMusic === "function") {
      window.resumeMainMusic();
    }
  });

  // 영상 일시정지 시에도 배경음악 재개
  video.addEventListener("pause", function () {
    if (video.ended) return; // ended 이벤트에서 처리하므로 무시
    // 사용자가 직접 일시정지한 경우 배경음악 재개
    if (typeof window.resumeMainMusic === "function") {
      window.resumeMainMusic();
    }
  });

  // 영상 다시 재생 시 배경음악 정지
  video.addEventListener("play", function () {
    if (typeof window.pauseMainMusicForDetailMusic === "function") {
      window.pauseMainMusicForDetailMusic();
    }
  });
});
