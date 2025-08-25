const supabase = window.supabaseClient;
const wrapper = document.getElementById("garland-wrapper");

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
let rawMemories = [];

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
  if (pointer >= mediaList.length) return;

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
      heartSticker.className = "heart-sticker-row3"; // 클래스 추가로 중복 방지
      heartSticker.style.position = "absolute";
      heartSticker.style.top = "1000px";
      heartSticker.style.left = "calc(71% - 60px)";
      heartSticker.style.width = "130px";
      heartSticker.style.transform = "rotate(0deg) translateY(-20px)";
      heartSticker.style.zIndex = "6";
      heartSticker.style.pointerEvents = "none";

      const heartSticker2 = document.createElement("img");
      heartSticker2.src = "./data/heart.png";
      heartSticker2.alt = "heart Sticker";
      heartSticker2.className = "heart-sticker2-row3"; // 클래스 추가로 중복 방지
      heartSticker2.style.position = "absolute";
      heartSticker2.style.top = "1000px";
      heartSticker2.style.left = "calc(78% - 70px)";
      heartSticker2.style.width = "130px";
      heartSticker2.style.transform = "rotate(-12deg) translateY(-20px)";
      heartSticker2.style.zIndex = "6";
      heartSticker2.style.pointerEvents = "none";

      document.body.appendChild(heartSticker);
      document.body.appendChild(heartSticker2);
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

  const imagesPerRow = row % 2 === 0 ? 7 : 5;
  const rowWrapper = document.createElement("div");
  rowWrapper.className = "garland-row";

  if (row % 2 === 1) {
    rowWrapper.style.marginBottom = "100px";
    rowWrapper.style.marginLeft = "60px";
    rowWrapper.style.marginTop = "50px";
  }

  if (row == 1) {
    rowWrapper.style.marginTop = "-50px";
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

    rowWrapper.appendChild(photo);
    observer.observe(photo);
  });

  wrapper.appendChild(rowWrapper);
  pointer += imagesPerRow;
  row++;
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
