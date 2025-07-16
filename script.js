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

    const totalWidth = row % 2 === 0 ? 1400 : 1300;
    const spacing = totalWidth / (imagesPerRow + 1);

    const x = spacing * (order + 1) + (row % 2 === 0 ? 0 : -30);
    const y =
      row % 2 === 0
        ? 50 * Math.sin((Math.PI * j) / (imagesPerRow - 1)) + 80
        : 40 + 50 * j;

    photo.style.left = `${x}px`;
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

      // 동영상에서 썸네일 자동 추출
      const videoForThumb = document.createElement("video");
      videoForThumb.src = media.src;
      videoForThumb.muted = true;
      videoForThumb.playsInline = true;
      videoForThumb.currentTime = 1;

      videoForThumb.addEventListener("loadeddata", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160; // 사진 사이즈에 맞춰서
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

    const tape = document.createElement("div");
    tape.className = "tape";

    photo.appendChild(tape);
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
