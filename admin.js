/* sb 연동 */
const sb = window.sbClient;

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

// 업로드 중 오버레이
const uploadOverlay = document.createElement("div");
uploadOverlay.id = "upload-overlay";
uploadOverlay.style.display = "none";
uploadOverlay.style.position = "fixed";
uploadOverlay.style.top = 0;
uploadOverlay.style.left = 0;
uploadOverlay.style.width = "100%";
uploadOverlay.style.height = "100%";
uploadOverlay.style.background = "rgba(0,0,0,0.4)";
uploadOverlay.style.zIndex = 1001;
uploadOverlay.style.display = "flex";
uploadOverlay.style.alignItems = "center";
uploadOverlay.style.justifyContent = "center";
uploadOverlay.innerHTML = `
  <div class="modal-content" style="
    padding: 20px 30px;
    font-size: 15px;
    text-align: center;
    max-width: 300px;
  ">
    업로드 중입니다...
  </div>
`;
document.body.appendChild(uploadOverlay);

document.addEventListener("DOMContentLoaded", () => {
  uploadOverlay.style.display = "none";

  // 로그인 모달 생성
  const loginModal = document.createElement("div");
  loginModal.className = "modal";
  loginModal.style.display = "none";
  loginModal.innerHTML = `
    <div class="modal-content login-modal-content">
      <h2>🔐 관리자 로그인</h2>
      
      <form id="login-form">
        <div class="form-group">
          <label for="admin-id">아이디</label>
          <input type="text" id="admin-id" value="ceaser501" required />
        </div>

        <div class="form-group">
          <label for="admin-pw">비밀번호</label>
          <input type="password" id="admin-pw" value="0928" required />
        </div>

        <div class="form-actions">
          <button type="button" id="cancel-btn" class="login-cancel">취소</button>
          <button type="button" id="login-btn" class="login-submit">로그인</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(loginModal);

  // 폼 모달 생성
  const formModal = document.createElement("div");
  formModal.style.display = "none";
  formModal.style.position = "fixed";
  formModal.style.top = 0;
  formModal.style.left = 0;
  formModal.style.width = "100%";
  formModal.style.height = "100%";
  formModal.style.background = "rgba(0, 0, 0, 0.4)";
  formModal.style.zIndex = 999;
  formModal.innerHTML = `
    <div id="form-modal" class="modal">
      <div class="modal-content" style="
        width: 700px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 20px;
        box-sizing: border-box;
      ">
        <form id="memory-form">
          <h2>💕 함께한 순간을 업로드 해 주세요</h2>

          <div class="form-group">
            <label for="thumbnail-title">썸네일 제목(필수)</label>
            <input type="text" id="thumbnail-title" required />
          </div>

          <div class="form-group">
            <label for="title">제목(필수)</label>
            <input type="text" id="title" required />
          </div>

          <div class="form-group">
            <label for="description">내용(필수)</label>
            <textarea id="description" rows="4" required></textarea>
          </div>

          <div class="form-group">
            <label for="date">날짜(필수)</label>
            <input type="date" id="date" required />
          </div>

          <div class="form-group">
            <label for="location">장소(필수)</label>
            <div class="address-group">
              <div class="address-group" style="display: flex; gap: 10px; width: 100%; align-items: center;">
              <input type="text" id="location" readonly required placeholder="주소 검색 클릭" />
              <button type="button" onclick="execDaumPostcode()" style="
                background-color: #f88;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
              ">주소 검색</button>
            </div>
            </div>
          </div>

          <div class="form-group">
            <label for="order">노출순서(필수)</label>
            <input type="number" id="order" required />
          </div>

          <div class="form-group">
            <label for="media_files">이미지 또는 영상 업로드(필수)</label>
            <input type="file" name="media_files" id="media_files" multiple accept="image/*,video/*" required />
          </div>

          <div id="thumbnail-preview" class="thumbnail-preview-container"></div>
          <input type="hidden" id="main-thumbnail-index" />

          <div class="form-group">
            <label for="music-upload">배경 음악 업로드(선택)</label>
            <input type="file" id="music-upload" accept=".mp3" />
          </div>

          <div class="tag-wrapper">
            <div class="form-group" style="margin-bottom:0">
              <label for="order">태그입력(선택)</label>
            </div>
            <div class="tag-input-container">
              <input type="text" id="tags-input" placeholder="# 태그 입력 (최대 5개)" />
            </div>
            <div id="tags-preview" class="tag-preview-container"></div>
          </div>

          <input type="checkbox" id="is-public" checked hidden />

          <div class="form-actions" style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="submit" style="
              background-color: #f88;
              color: #fff;
              border: none;
              padding: 8px 16px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
            ">등록</button>

            <button type="button" id="cancel-entry" style="
              background-color: #eee;
              color: #333;
              border: none;
              padding: 8px 16px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
            ">닫기</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(formModal);

  /* 해시태그 기능 */
  const tagsInput = document.getElementById("tags-input");
  const tagsPreview = document.getElementById("tags-preview");
  let tags = [];

  tagsInput.addEventListener("input", () => {
    const raw = tagsInput.value;

    // 스페이스가 포함되면 분리 처리
    if (raw.includes(" ")) {
      const words = raw.trim().split(/\s+/);

      words.forEach((word) => {
        if (word && tags.length < 5 && !tags.includes(word)) {
          tags.push(word);
        }
      });

      renderTags();
      tagsInput.value = "";
    }
  });

  tagsInput.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && tagsInput.value === "") {
      tags.pop();
      renderTags();
    }
  });

  function renderTags() {
    tagsPreview.innerHTML = "";
    tags.forEach((tag, index) => {
      const badge = document.createElement("div");
      badge.className = "tag-badge";
      badge.textContent = `#${tag}`;

      const closeBtn = document.createElement("span");
      closeBtn.className = "remove-btn";
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", () => {
        tags.splice(index, 1);
        renderTags();
      });

      badge.appendChild(closeBtn);
      tagsPreview.appendChild(badge);
    });
  }

  const fileInput = document.getElementById("media_files");

  //  1. 안내문 텍스트 만들기
  const guideText = document.createElement("p");
  guideText.textContent = "썸네일에 표시될 대표 이미지를 선택 해 주세요";
  guideText.style.fontSize = "14px";
  guideText.style.color = "#666";
  guideText.style.marginTop = "10px";

  // 2. 썸네일 container 만들기
  const previewContainer = document.createElement("div");
  previewContainer.id = "thumbnail-preview";
  previewContainer.className = "thumbnail-preview-container";
  previewContainer.style.display = "flex";
  previewContainer.style.flexWrap = "wrap";
  previewContainer.style.marginTop = "6px";
  previewContainer.style.gap = "10px";

  // 3. wrapper 만들어서 input 밑에 삽입
  const fileInputGroup = fileInput.parentElement; // div.form-group
  const previewWrapper = document.createElement("div");
  previewWrapper.appendChild(guideText); // 안내문
  previewWrapper.appendChild(previewContainer); // 썸네일들
  fileInputGroup.appendChild(previewWrapper);

  // 대표 index 저장용 hidden input
  const mainThumbInput = document.createElement("input");
  mainThumbInput.type = "hidden";
  mainThumbInput.id = "main-thumbnail-index";

  fileInput.addEventListener("change", function (e) {
    // 001, 002, 003 파일이름 순서대로 순서저장
    const files = Array.from(e.target.files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    previewContainer.innerHTML = ""; // 초기화
    selectedIndex = 0; // 첫번째 기본 선택
    document.getElementById("main-thumbnail-index").value = 0; // 초기 설정

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = function (event) {
        const thumb = document.createElement("img");
        thumb.src = event.target.result;
        thumb.style.width = "80px";
        thumb.style.height = "80px";
        thumb.style.objectFit = "cover";
        thumb.style.cursor = "pointer";
        thumb.style.borderRadius = "8px";
        thumb.style.border = index === 0 ? "3px solid #f99" : "2px solid #ccc"; // 대표 선택 표시

        // 선택 시 border 색 바뀌기
        thumb.addEventListener("click", () => {
          // 전체 초기화
          previewContainer.querySelectorAll("img").forEach((img) => {
            img.style.border = "2px solid #ccc";
          });
          thumb.style.border = "3px solid #f99";
          selectedIndex = index; // 대표 인덱스 기억
          document.getElementById("main-thumbnail-index").value = selectedIndex;
        });

        previewContainer.appendChild(thumb);
      };
      reader.readAsDataURL(file);
    });
  });

  // UI 요소들
  const loginBtn = document.getElementById("login-btn");
  const signupBtn = document.getElementById("signup-btn");
  const writePostBtn = document.getElementById("write-post-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const beforeLogin = document.getElementById("before-login");
  const afterLogin = document.getElementById("after-login");

  // 로그인 버튼 클릭 이벤트
  loginBtn.addEventListener("click", () => {
    loginModal.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");
  });

  // 글 등록 버튼 클릭 이벤트
  writePostBtn.addEventListener("click", async () => {
    formModal.style.display = "block";
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");

    // [수정] DB에서 직접 마지막 순서를 실시간으로 조회하여 다음 순서 자동 설정
    const orderInput = document.getElementById("order");
    orderInput.value = 1; // 기본값 설정

    try {
      const { data, error } = await sb
        .from("memories")
        .select("order")
        .order("order", { ascending: false })
        .limit(1)
        .single();

      // 테이블이 비어있을 때 발생하는 오류(PGRST116)는 정상적인 상황이므로 무시합니다.
      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        // 데이터가 있으면 (가장 큰 order 값을 가진 게시물)
        orderInput.value = (data.order || 0) + 1;
      }
    } catch (err) {
      console.error(
        "최대 노출 순서 조회에 실패했습니다. 기본값 1로 설정됩니다.",
        err
      );
    }
  });

  // 로그아웃 버튼 클릭 이벤트
  logoutBtn.addEventListener("click", () => {
    // 로그아웃 확인
    if (confirm("로그아웃 하시겠습니까?")) {
      // UI를 초기 상태로 되돌리기
      beforeLogin.style.display = "flex";
      afterLogin.style.display = "none";

      // 모든 모달 닫기
      if (formModal.style.display === "block") {
        formModal.style.display = "none";
        document.body.style.overflow = "auto";
        document.body.classList.remove("modal-open");
      }

      alert("로그아웃되었습니다.");
    }
  });

  // 로그인 모달 닫기
  function closeLoginModal() {
    loginModal.style.display = "none";
    document.body.style.overflow = "auto";
    document.body.classList.remove("modal-open");
  }

  // 취소 버튼
  loginModal
    .querySelector("#cancel-btn")
    .addEventListener("click", closeLoginModal);

  // 폼 모달 취소 버튼
  formModal.querySelector("#cancel-entry").addEventListener("click", () => {
    formModal.style.display = "none";
    document.body.style.overflow = "auto";
    document.body.classList.remove("modal-open");
  });

  // 배경 클릭으로 닫기
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) closeLoginModal();
  });

  formModal.addEventListener("click", (e) => {
    if (e.target === formModal) {
      formModal.style.display = "none";
      document.body.style.overflow = "auto";
      document.body.classList.remove("modal-open");
    }
  });

  // ESC 키로 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (loginModal.style.display === "flex") closeLoginModal();
      if (formModal.style.display === "block") {
        formModal.style.display = "none";
        document.body.style.overflow = "auto";
        document.body.classList.remove("modal-open");
      }
    }
  });

  loginModal.querySelector("#login-btn").addEventListener("click", () => {
    const id = loginModal.querySelector("#admin-id").value.trim();
    const pw = loginModal.querySelector("#admin-pw").value.trim();

    if (!id || !pw) {
      alert("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    if (id === "ceaser501" && pw === "0928") {
      alert("✅ 로그인 성공!");
      closeLoginModal();

      // UI 업데이트: 로그인 전 버튼들 숨기고 로그인 후 버튼들 표시
      beforeLogin.style.display = "none";
      afterLogin.style.display = "flex";

      // 글 등록 폼은 자동으로 열지 않음
    } else {
      alert("❌ 아이디 또는 비밀번호가 틀렸습니다.");
      loginModal.querySelector("#admin-pw").value = "";
      loginModal.querySelector("#admin-pw").focus();
    }
  });

  // 등록 처리
  formModal
    .querySelector("form")
    ?.addEventListener("submit", async function (e) {
      e.preventDefault();

      // ✅ 오버레이 표시
      uploadOverlay.style.display = "flex";

      try {
        const files = document.getElementById("media_files").files;
        const mainIndex = parseInt(
          document.getElementById("main-thumbnail-index").value || "0",
          10
        );

        if (!files || files.length === 0) {
          alert("파일을 1개 이상 선택해주세요");
          return;
        }

        // 1. memories insert
        const metadata = {
          thumbnail_title: document.getElementById("thumbnail-title").value,
          title: document.getElementById("title").value,
          description: document.getElementById("description").value,
          date: document.getElementById("date").value,
          location: document.getElementById("location").value,
          order: parseInt(document.getElementById("order").value, 10),
          is_public: document.getElementById("is-public").checked,
          created_at: new Date().toISOString(),
          tags: tags.map((t) => "#" + t).join(" "),
        };

        const { data: memoryInsert, error: memoryError } = await sb
          .from("memories")
          .insert([metadata])
          .select("id")
          .single();

        if (memoryError || !memoryInsert) {
          alert("메모리 저장 실패");
          return;
        }

        const memory_id = memoryInsert.id;

        // 현재 총 메모리 개수를 구해서 순서 번호 생성 (1, 2, 3, 4...)
        const { count: memoryCount } = await sb
          .from("memories")
          .select("*", { count: "exact", head: true });

        const sequentialId = memoryCount || 1; // 1, 2, 3, 4... 순서

        // 2. 파일 업로드 후 URL 리스트 만들기
        const uploadedList = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const originalName = file.name;
          // 순차적 ID와 파일 순서를 사용한 파일명 생성
          const fileNumber = String(i + 1).padStart(3, "0"); // 001, 002, 003...
          const fileExtension = originalName.split(".").pop();
          const fileName = `${sequentialId}_${fileNumber}.${fileExtension}`;
          const filePath = `uploads/${fileName}`;

          const { error: uploadError } = await retrySupabaseOperation(() =>
            sb.storage.from("media").upload(filePath, file, {
              contentType: file.type,
              upsert: false,
            })
          );

          if (uploadError) {
            alert(`파일 ${file.name} 업로드 실패`);
            continue;
          }

          const { data: publicData } = sb.storage
            .from("media")
            .getPublicUrl(filePath);
          uploadedList.push({
            media_url: publicData.publicUrl,
            media_type: file.type.startsWith("video") ? "video" : "image",
            is_main: i === mainIndex,
            memory_id,
            created_at: new Date().toISOString(),
            file_order: i, // 이미지 노출 순서 저장
          });
        }

        if (uploadedList.length === 0) {
          alert("파일 업로드에 실패했습니다.");
          return;
        }

        // 3. media_files 일괄 insert
        console.log("📦 uploadedList:", uploadedList);
        const { error: insertError } = await retrySupabaseOperation(() =>
          sb.from("media_files").insert(uploadedList)
        );
        if (insertError) {
          console.error("📛 media_files insert error:", insertError);
          alert("media_files 저장 실패");
          return;
        }

        alert("등록 완료!");
        formModal.style.display = "none";

        // 메모리 새로 불러오기
        if (typeof loadMediaFromSupabase === "function") {
          document.getElementById("garland-wrapper").innerHTML = "";
          pointer = 0;
          row = 0;
          mediaList = [];
          loadMediaFromSupabase();
        }

        // 배경 음악 파일 있으면 등록
        const musicFile = document.getElementById("music-upload").files?.[0];
        if (musicFile && musicFile.name.endsWith(".mp3")) {
          const [artist = "", title = ""] = musicFile.name
            .replace(".mp3", "")
            .split(" - ");

          musicmetadata(musicFile, async function (err, rawMetadata) {
            let metadata = rawMetadata || {};
            let duration = 0;

            console.log("🎧 [DEBUG] metadata:", metadata);
            console.log(
              "🎧 [DEBUG] typeof metadata.artist:",
              typeof metadata?.artist
            );
            console.log("🎧 [DEBUG] metadata.artist:", metadata?.artist);

            if (Number.isFinite(metadata?.duration) && metadata.duration > 0) {
              duration = Math.floor(metadata.duration);
            } else {
              duration = await getAudioDuration(musicFile); // 브라우저 audio 기반 추출
            }

            let albumPath = "album/default.jpg";

            try {
              // 🎵 파일명에서 추출
              const baseName = musicFile.name.replace(/\.mp3$/i, "");
              let [rawTitle = "", rawArtist = ""] = baseName.split(" - ");

              // " (1)", " (2)" 제거
              rawTitle = rawTitle
                ?.replace(/\s*\(\d+\)\s*$/, "")
                .replace(/\(\d+\)/g, "")
                .trim();
              rawArtist = rawArtist?.replace(/\s*\(\d+\)\s*$/, "").trim();

              let artist = "알 수 없음";
              if (typeof metadata.artist === "string") {
                artist = metadata.artist.trim();
              } else if (
                metadata.artist?.text &&
                typeof metadata.artist.text === "string"
              ) {
                artist = metadata.artist.text.trim();
              } else if (Array.isArray(metadata.artist)) {
                // 가끔 배열로 들어오는 경우 첫 항목 사용
                artist = metadata.artist[0]?.trim?.() || rawArtist;
              } else {
                artist = rawArtist;
              }

              let title = "제목 없음";
              if (typeof metadata.title === "string") {
                title = metadata.title.replace(/\s*\(\d+\)\s*$/, "").trim();
              } else if (
                metadata.title?.text &&
                typeof metadata.title.text === "string"
              ) {
                title = metadata.title.text
                  .replace(/\s*\(\d+\)\s*$/, "")
                  .trim();
              } else {
                title = rawTitle;
              }

              const picture = metadata?.picture?.[0];
              if (picture?.data && picture?.format) {
                const blob = new Blob([picture.data], { type: picture.format });
                const jacketFilename = `jacket-${Date.now()}.jpg`;

                const { data, error } = await retrySupabaseOperation(() =>
                  sb.storage
                    .from("media")
                    .upload(`album/${jacketFilename}`, blob, {
                      contentType: picture.format,
                      upsert: true,
                    })
                );

                if (!error && data?.path) {
                  albumPath = data.path;
                } else {
                  console.warn("🟡 자켓 업로드 오류:", error);
                }
              }

              await uploadMusicToDB({
                musicFile,
                memory_id,
                artist,
                title,
                duration,
                albumPath,
              });
            } catch (e) {
              console.warn("🛑 앨범 업로드 중 오류:", e);
              await uploadMusicToDB({
                musicFile,
                memory_id,
                artist: "알 수 없음",
                title: "제목 없음",
                duration,
                albumPath,
              });
            }
          });
        }
      } catch (err) {
        console.error("❌ 업로드 중 오류:", err);
        alert("업로드 중 오류가 발생했습니다.");
      } finally {
        // ✅ 오버레이 숨김
        uploadOverlay.style.display = "none";
      }
    });
});

async function uploadMusicToDB({
  musicFile,
  memory_id,
  artist,
  title,
  duration,
  albumPath,
}) {
  // 확장자 추출
  const ext = musicFile.name.split(".").pop();
  const fileName = `music_${Date.now()}.${ext}`;
  const filePath = `music/${fileName}`; // 버킷 내부 경로

  const { data: musicData, error: musicError } = await retrySupabaseOperation(
    () =>
      sb.storage.from("media").upload(filePath, musicFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: "audio/mpeg",
      })
  );

  const musicPath = musicData?.path;
  if (!musicPath) {
    alert("🎵 음악 업로드 실패");
    console.error("업로드 실패 상세:", musicError);
    return;
  }

  const { error: musicInsertError } = await retrySupabaseOperation(() =>
    sb.from("memory_music").insert({
      memory_id,
      artist_name:
        typeof artist === "string"
          ? artist.trim()
          : typeof artist?.text === "string"
          ? artist.text.trim()
          : "알 수 없음",

      music_title:
        typeof title === "string"
          ? title.replace(/\s*\(\d+\)\s*$/, "").trim()
          : "제목 없음",

      duration_seconds: duration,
      music_path: musicPath,
      album_path: albumPath,
    })
  );

  if (musicInsertError) {
    console.error("📛 음악 등록 오류:", musicInsertError.message);
  } else {
    console.log("🎵 음악 등록 성공");
  }
}

/* Daum API 연동 */
function execDaumPostcode() {
  new daum.Postcode({
    oncomplete: function (data) {
      document.getElementById("location").value = data.address;
    },
  }).open();
}

/* 배경음악 재생시간 */
function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = URL.createObjectURL(file);

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Math.floor(audio.duration)); // 초 단위
    };

    audio.onerror = () => {
      resolve(0); // 추출 실패 시 fallback
    };
  });
}
