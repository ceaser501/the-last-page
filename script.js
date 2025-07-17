const wrapper = document.getElementById("garland-wrapper");

// 확장자 체크용 헬퍼
function isVideo(src) {
  return /\.(mp4|webm|ogg)$/i.test(src);
}

const mediaList = Array.from({ length: 30 }).map((_, i) => {
  const index = i + 1;
  const padded = String(index).padStart(2, "0");

  if (index === 3) {
    return {
      src: `./data/video${padded}.mp4`, // 실제 재생될 영상
      thumbnail: `./data/video${padded}.jpg`, // 썸네일 이미지
      type: "video",
      index: i,
    };
  }

  return {
    src: `./data/img${padded}.jpg`,
    type: "image",
    index: i,
  };
});

const rotateAngles = [-10, 15, -25, 5, 5, -8, 2, -13, -7, 2, -3];

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("show");
    });
  },
  { threshold: 0.1 }
);

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

  if (row === 2) {
    const flowerSticker = document.createElement("img");
    flowerSticker.src = "./data/flower2.png";
    flowerSticker.alt = "flower Sticker";
    flowerSticker.style.position = "absolute";
    flowerSticker.style.top = "740px";
    flowerSticker.style.left = "calc(22% - 10px)";
    flowerSticker.style.width = "130px";
    flowerSticker.style.transform = "rotate(-10deg) translateY(-20px)";
    flowerSticker.style.zIndex = "6";
    flowerSticker.style.pointerEvents = "none";

    document.body.appendChild(flowerSticker);
  }

  if (row === 3) {
    const heartSticker = document.createElement("img");
    heartSticker.src = "./data/heart.png";
    heartSticker.alt = "heart Sticker";
    heartSticker.style.position = "absolute";
    heartSticker.style.top = "890px";
    heartSticker.style.left = "calc(71% - 60px)";
    heartSticker.style.width = "130px";
    heartSticker.style.transform = "rotate(0deg) translateY(-20px)";
    heartSticker.style.zIndex = "6";
    heartSticker.style.pointerEvents = "none";

    const heartSticker2 = document.createElement("img");
    heartSticker2.src = "./data/heart.png";
    heartSticker2.alt = "heart Sticker";
    heartSticker2.style.position = "absolute";
    heartSticker2.style.top = "870px";
    heartSticker2.style.left = "calc(78% - 70px)";
    heartSticker2.style.width = "130px";
    heartSticker2.style.transform = "rotate(-12deg) translateY(-20px)";
    heartSticker2.style.zIndex = "6";
    heartSticker2.style.pointerEvents = "none";

    document.body.appendChild(heartSticker);
    document.body.appendChild(heartSticker2);
  }

  if (row === 4) {
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
    wrapper.appendChild(dateTape);
  }

  const imagesPerRow = row % 2 === 0 ? 7 : 5;
  const rowWrapper = document.createElement("div");
  rowWrapper.className = "garland-row";

  if (row % 2 === 1) {
    rowWrapper.style.marginBottom = "100px";
    rowWrapper.style.marginLeft = "60px";
  }

  const rope = document.createElement("div");
  rope.className = "garland-line";
  rowWrapper.appendChild(rope);

  const currentMedia = mediaList.slice(pointer, pointer + imagesPerRow);
  let prevDoubleTape = false; // 이전 테이프가 2개로 붙었다면, 다음엔 2개짜리가 못나옴

  currentMedia.forEach((media, j) => {
    const i = pointer + j;
    const photo = document.createElement("a");
    photo.className = "photo";
    photo.href = media.src;
    photo.setAttribute("data-fancybox", "gallery");
    photo.setAttribute("data-caption", `추억 ${i + 1}`);
    photo.setAttribute("data-index", i);

    const rotate = rotateAngles[i % rotateAngles.length];

    let order = j;
    if (row % 2 === 1) order = imagesPerRow - 1 - j;

    const spacing = 180;
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

    // 미디어 노드 생성
    let mediaNode;
    if (media.type === "video") {
      mediaNode = document.createElement("div");
      mediaNode.className = "photo-video-wrapper";

      const thumbnail = document.createElement("img");
      thumbnail.className = "photo-img";

      const videoForThumb = document.createElement("video");
      videoForThumb.src = media.src;
      videoForThumb.muted = true;
      videoForThumb.playsInline = true;
      videoForThumb.currentTime = 1;

      videoForThumb.addEventListener("loadeddata", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 150;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(videoForThumb, 0, 0, canvas.width, canvas.height);
        const dataURL = canvas.toDataURL("image/jpeg");
        thumbnail.src = dataURL;
      });

      const playIcon = document.createElement("div");
      playIcon.className = "play-icon";
      playIcon.innerHTML = "▶";

      mediaNode.appendChild(thumbnail);
      mediaNode.appendChild(playIcon);
    } else {
      mediaNode = document.createElement("img");
      mediaNode.src = media.src;
      mediaNode.className = "photo-img";
      mediaNode.loading = "lazy";
    }

    const caption = document.createElement("figcaption");
    caption.innerText = `추억 ${i + 1}`;

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

    photo.appendChild(mediaNode);
    photo.appendChild(caption);
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
}

setupLazyRender();

// Fancybox 연결
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
