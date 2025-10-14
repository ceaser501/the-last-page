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
          <input type="text" id="admin-id" value="taesu" required />
        </div>

        <div class="form-group">
          <label for="admin-pw">비밀번호</label>
          <input type="password" id="admin-pw" value="0928" required />
        </div>

        <div class="form-actions">
          <button type="button" id="login-btn" class="login-submit">로그인</button>
          <button type="button" id="cancel-btn" class="login-cancel">닫기</button>
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
        thumb.style.border = index === 0 ? "3px solid #f99" : "2px solid #eee"; // 대표 선택 표시

        // 선택 시 border 색 바뀌기
        thumb.addEventListener("click", () => {
          // 전체 초기화
          previewContainer.querySelectorAll("img").forEach((img) => {
            img.style.border = "2px solid #eee";
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

  // 팝업 상태 저장용 변수
  let savedPopupState = null;

  // 로그인 버튼 클릭 이벤트
  loginBtn.addEventListener("click", () => {
    // 현재 열려있는 팝업이 있으면 저장
    const detailPopup = document.querySelector(".detail-popup");
    if (detailPopup && detailPopup.style.display === "flex") {
      // 현재 열린 미디어 정보와 전체 리스트 저장
      savedPopupState = {
        media: window.currentPopupMedia,
        mediaList: window.currentPopupMediaList
      };
    }

    loginModal.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");
  });

  // 글 등록 버튼 클릭 이벤트
  writePostBtn.addEventListener("click", async () => {
    formModal.style.display = "block";
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");

    // [수정] BGM을 제외한 일반 게시물의 마지막 순서를 조회하여 다음 순서 자동 설정
    const orderInput = document.getElementById("order");
    orderInput.value = 1; // 기본값 설정

    try {
      const { data, error } = await sb
        .from("memories")
        .select("order")
        .neq("tags", "#MAIN_BGM_ONLY") // BGM 태그를 가진 메모리 제외
        .order("order", { ascending: false })
        .limit(1)
        .single();

      // 테이블이 비어있을 때 발생하는 오류(PGRST116)는 정상적인 상황이므로 무시합니다.
      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        // 데이터가 있으면 (BGM을 제외한 가장 큰 order 값을 가진 게시물)
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

      // BGM 업로드 버튼 숨기기
      document.getElementById("bgm-upload-btn").style.display = "none";

      // 모든 모달 닫기
      if (formModal.style.display === "block") {
        formModal.style.display = "none";
        document.body.style.overflow = "auto";
        document.body.classList.remove("modal-open");
      }

      // BGM 모달도 닫기
      const bgmModal = document.getElementById("bgm-upload-modal");
      if (bgmModal && bgmModal.style.display === "flex") {
        bgmModal.style.display = "none";
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

    if (id === "taesu" && pw === "0928") {
      alert("✅ 로그인 성공!");
      closeLoginModal();

      // UI 업데이트: 로그인 전 버튼들 숨기고 로그인 후 버튼들 표시
      beforeLogin.style.display = "none";
      afterLogin.style.display = "flex";

      // teaesu 계정일 때만 BGM 업로드 버튼 표시
      if (id === "taesu") {
        document.getElementById("bgm-upload-btn").style.display =
          "inline-block";
      }

      // 저장된 팝업이 있으면 다시 열기
      if (savedPopupState && savedPopupState.media && savedPopupState.mediaList) {
        if (typeof openDetailPopup === "function") {
          setTimeout(() => {
            openDetailPopup(savedPopupState.media, savedPopupState.mediaList);
            savedPopupState = null; // 복원 후 초기화
          }, 100); // 로그인 모달이 완전히 닫힌 후 팝업 열기
        }
      }

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
        
        // 🔥 UI 상태 완전 복원 (스크롤 활성화, 모달 상태 해제)
        document.body.style.overflow = "auto";
        document.body.classList.remove("modal-open");

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

// BGM 업로드 관련 함수들
async function uploadBGMToDB({
  musicFile,
  artist,
  title,
  duration,
  albumPath,
}) {
  // 메인 BGM을 위한 특별한 태그
  const MAIN_BGM_TAG = "#MAIN_BGM_ONLY";

  // 확장자 추출
  const ext = musicFile.name.split(".").pop();
  const fileName = `main_bgm_${Date.now()}.${ext}`;
  const filePath = `music/${fileName}`;

  try {
    // 새로운 BGM용 memory 생성 (누적 방식)
    const { data: newMemory, error: createError } = await sb
      .from("memories")
      .insert({
        title: title || "메인 BGM",
        thumbnail_title: title || "BGM",
        description: `메인 페이지 배경음악 - ${artist || "Unknown Artist"}`,
        date: new Date().toISOString().split("T")[0],
        location: "",
        tags: MAIN_BGM_TAG,
        order: 9999, // 표시되지 않도록 큰 숫자
        is_public: false, // 갤러리에 표시하지 않음
      })
      .select("id")
      .single();

    if (createError || !newMemory) {
      throw new Error(
        "메인 BGM memory 생성 실패: " +
          (createError?.message || "알 수 없는 오류")
      );
    }

    const MAIN_MUSIC_ID = newMemory.id;

    // 새 음악 파일 업로드
    const { data: musicData, error: musicError } = await retrySupabaseOperation(
      () =>
        sb.storage.from("media").upload(filePath, musicFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: "audio/mpeg",
        })
    );

    if (musicError || !musicData?.path) {
      throw new Error(
        "음악 파일 업로드 실패: " + (musicError?.message || "알 수 없는 오류")
      );
    }

    // 새로운 BGM 데이터 삽입 (누적 방식)
    const { error: insertError } = await retrySupabaseOperation(() =>
      sb.from("memory_music").insert({
        memory_id: MAIN_MUSIC_ID,
        artist_name: artist || "알 수 없음",
        music_title: title || "제목 없음",
        duration_seconds: duration,
        music_path: musicData.path,
        album_path: albumPath,
      })
    );

    if (insertError) {
      throw new Error("BGM 등록 실패: " + insertError.message);
    }

    console.log("🎵 BGM 설정 성공");
    return true;
  } catch (error) {
    console.error("🛑 BGM 업로드 오류:", error);
    throw error;
  }
}

// 현재 BGM 리스트 조회 (여러개)
async function getCurrentBGMList() {
  try {
    // 메인 BGM용 memories 찾기 (여러개) - created_at 기준으로 정렬
    const { data: mainMemories, error: memoriesError } = await sb
      .from("memories")
      .select("id, created_at")
      .eq("tags", "#MAIN_BGM_ONLY")
      .order("created_at", { ascending: false });

    if (memoriesError) {
      console.error("BGM memories 조회 오류:", memoriesError);
      return [];
    }

    if (!mainMemories || mainMemories.length === 0) {
      return [];
    }

    // 모든 BGM 데이터 로드
    const bgmList = [];
    for (const memory of mainMemories) {
      const { data: musicData, error } = await sb
        .from("memory_music")
        .select("*")
        .eq("memory_id", memory.id);

      if (musicData && musicData.length > 0) {
        bgmList.push(...musicData);
      }
    }

    return bgmList;
  } catch (error) {
    console.error("현재 BGM 리스트 조회 실패:", error);
    return [];
  }
}

// BGM 삭제 함수
async function deleteBGM(musicId) {
  if (!confirm("정말 이 BGM을 삭제하시겠습니까?")) {
    return;
  }

  try {
    // 음악 데이터 조회 (파일 경로 확인용)
    const { data: musicData } = await sb
      .from("memory_music")
      .select("*")
      .eq("id", musicId)
      .single();

    if (musicData) {
      // 파일 삭제
      const filesToDelete = [];
      if (musicData.music_path) filesToDelete.push(musicData.music_path);
      if (musicData.album_path && !musicData.album_path.includes("default")) {
        filesToDelete.push(musicData.album_path);
      }

      if (filesToDelete.length > 0) {
        await sb.storage.from("media").remove(filesToDelete);
      }

      // DB에서 음악 삭제
      await sb.from("memory_music").delete().eq("id", musicId);

      // 관련 memory도 삭제 (다른 음악이 없다면)
      const { data: remainingMusic } = await sb
        .from("memory_music")
        .select("id")
        .eq("memory_id", musicData.memory_id);

      if (!remainingMusic || remainingMusic.length === 0) {
        await sb.from("memories").delete().eq("id", musicData.memory_id);
      }
    }

    alert("BGM이 삭제되었습니다.");

    // 메인 음악 플레이어 새로고침
    if (typeof loadMainMusic === "function") {
      await loadMainMusic();
    }

    // 모달 새로고침
    document.getElementById("bgm-upload-btn").click();
  } catch (error) {
    console.error("BGM 삭제 실패:", error);
    alert("BGM 삭제 실패: " + error.message);
  }
}

// BGM 순서 변경 기능 (간단한 위/아래 이동)
let draggedBGM = null;

function startDrag(event, bgmId) {
  event.preventDefault();
  draggedBGM = bgmId;

  // 드래그 시작 시각적 피드백
  const item = event.target.closest(".bgm-list-item");
  item.style.opacity = "0.5";

  document.addEventListener("mouseup", endDrag);
  document.addEventListener("mousemove", onDragMove);
}

function onDragMove(event) {
  if (!draggedBGM) return;

  const listContainer = document.getElementById("bgm-list-container");
  const items = listContainer.querySelectorAll(".bgm-list-item");
  const mouseY = event.clientY;

  let targetItem = null;
  let minDistance = Infinity;

  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const itemCenter = rect.top + rect.height / 2;
    const distance = Math.abs(mouseY - itemCenter);

    if (distance < minDistance) {
      minDistance = distance;
      targetItem = item;
    }
  });

  if (targetItem && targetItem.dataset.bgmId !== draggedBGM) {
    const draggedItem = document.querySelector(`[data-bgm-id="${draggedBGM}"]`);
    const targetRect = targetItem.getBoundingClientRect();

    if (mouseY < targetRect.top + targetRect.height / 2) {
      targetItem.parentNode.insertBefore(draggedItem, targetItem);
    } else {
      targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
    }
  }
}

async function endDrag() {
  if (!draggedBGM) return;

  const draggedItem = document.querySelector(`[data-bgm-id="${draggedBGM}"]`);
  draggedItem.style.opacity = "1";

  // 새로운 순서 저장
  try {
    // 저장 중 표시
    const saveIndicator = document.createElement("div");
    saveIndicator.innerHTML = "순서 저장 중...";
    saveIndicator.style.cssText = `
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      background: rgba(0,0,0,0.8); 
      color: white; 
      padding: 10px 20px; 
      border-radius: 4px; 
      z-index: 10001;
    `;
    document.body.appendChild(saveIndicator);

    await saveBGMOrder();

    // 저장 완료 표시
    saveIndicator.innerHTML = "✅ 순서 저장 완료!";
    saveIndicator.style.background = "rgba(0,128,0,0.8)";

    // 표시 제거 후 모달 새로고침
    setTimeout(() => {
      document.body.removeChild(saveIndicator);
      document.getElementById("bgm-upload-btn").click();
    }, 1000);
  } catch (error) {
    console.error("순서 저장 실패:", error);
    alert("순서 저장에 실패했습니다.");
  }

  draggedBGM = null;
  document.removeEventListener("mouseup", endDrag);
  document.removeEventListener("mousemove", onDragMove);
}

async function saveBGMOrder() {
  try {
    const items = document.querySelectorAll(".bgm-list-item");
    const updates = [];

    items.forEach((item, index) => {
      const bgmId = item.dataset.bgmId;
      updates.push({
        id: bgmId,
        order: index,
      });
    });

    console.log("BGM 순서 변경:", updates);

    // 각 BGM의 memory에 순서 정보를 created_at 시간으로 업데이트
    // (더 최근 시간 = 더 앞순서)
    const now = new Date();
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

      // 순서에 따라 시간을 조정 (첫 번째가 가장 최근)
      const orderTime = new Date(now.getTime() + (updates.length - i) * 1000);

      try {
        // BGM ID로 memory_id 찾기
        const { data: musicData } = await sb
          .from("memory_music")
          .select("memory_id")
          .eq("id", update.id)
          .single();

        if (musicData) {
          // 해당 memory의 created_at 업데이트 (순서 조정)
          await sb
            .from("memories")
            .update({
              created_at: orderTime.toISOString(),
            })
            .eq("id", musicData.memory_id);
        }
      } catch (updateError) {
        console.error(`BGM ${update.id} 순서 업데이트 실패:`, updateError);
      }
    }

    // 메인 음악 플레이어 새로고침
    if (typeof loadMainMusic === "function") {
      setTimeout(() => {
        loadMainMusic();
      }, 500); // 약간의 지연으로 DB 업데이트 완료 대기
    }

    console.log("✅ BGM 순서 저장 완료");
  } catch (error) {
    console.error("BGM 순서 저장 실패:", error);
    alert("BGM 순서 저장 실패: " + error.message);
  }
}

// BGM 업로드 모달 이벤트 처리
document.addEventListener("DOMContentLoaded", () => {
  // BGM 업로드 버튼 클릭
  document
    .getElementById("bgm-upload-btn")
    ?.addEventListener("click", async () => {
      const modal = document.getElementById("bgm-upload-modal");
      modal.style.display = "flex";
      
      // 🔥 모달 열 때 UI 상태 설정 (스크롤 비활성화, 모달 상태 활성화)
      document.body.style.overflow = "hidden";
      document.body.classList.add("modal-open");

      // 현재 BGM 리스트 표시
      const currentBGMList = await getCurrentBGMList();
      const displayDiv = document.getElementById("bgm-current-display");

      if (currentBGMList.length > 0) {
        const bgmListHTML = currentBGMList
          .map((bgm, index) => {
            const duration =
              Math.floor(bgm.duration_seconds / 60) +
              ":" +
              String(bgm.duration_seconds % 60).padStart(2, "0");
            return `
          <div class="bgm-list-item" data-bgm-id="${bgm.id}" data-order="${index}">
            <div class="bgm-item-info">
              <div class="bgm-item-title">${bgm.music_title}</div>
              <div class="bgm-item-details">${bgm.artist_name} • ${duration}</div>
            </div>
            <div class="bgm-item-controls">
              <button class="bgm-control-btn move" onmousedown="startDrag(event, '${bgm.id}')" title="순서 변경">
                <i class="fas fa-grip-vertical"></i>
              </button>
              <button class="bgm-control-btn delete" onclick="deleteBGM('${bgm.id}')" title="삭제">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
          })
          .join("");

        displayDiv.innerHTML = `
        <div id="bgm-list-container" style="max-height: 300px; overflow-y: auto;">
          ${bgmListHTML}
        </div>
        <div class="bgm-list-summary">총 ${currentBGMList.length}곡이 등록되어 있습니다</div>
      `;
      } else {
        displayDiv.innerHTML = `<div class="bgm-list-summary">설정된 BGM이 없습니다</div>`;
      }
    });

  // BGM 업로드 폼 제출
  document
    .getElementById("bgm-upload-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById("bgm-file");
      const titleInput = document.getElementById("bgm-title");
      const artistInput = document.getElementById("bgm-artist");

      const musicFile = fileInput.files[0];
      if (!musicFile) {
        alert("음악 파일을 선택해주세요.");
        return;
      }

      try {
        // 업로드 오버레이 표시
        uploadOverlay.style.display = "flex";

        // 메타데이터 추출
        let artist = artistInput.value.trim();
        let title = titleInput.value.trim();
        let duration = 0;

        // 파일명에서 자동 추출
        if (!artist || !title) {
          const baseName = musicFile.name.replace(/\.mp3$/i, "");
          const parts = baseName.split(" - ");
          if (parts.length >= 2) {
            if (!artist) artist = parts[0].trim();
            if (!title) title = parts[1].trim();
          } else {
            if (!title) title = baseName;
          }
        }

        // 재생시간 추출
        duration = await getAudioDuration(musicFile);

        // 앨범 커버 추출 (기본값 사용)
        let albumPath = "album/default.jpg";

        // musicmetadata로 메타데이터 추출 시도
        musicmetadata(musicFile, async function (err, metadata) {
          try {
            if (metadata) {
              if (metadata.artist && !artistInput.value.trim()) {
                artist = metadata.artist;
              }
              if (metadata.title && !titleInput.value.trim()) {
                title = metadata.title;
              }
              if (metadata.duration) {
                duration = Math.floor(metadata.duration);
              }

              // 앨범 아트 추출
              if (metadata.picture && metadata.picture.length > 0) {
                const picture = metadata.picture[0];
                const blob = new Blob([picture.data], { type: picture.format });

                try {
                  const albumFileName = `album_main_${Date.now()}.jpg`;
                  const albumFilePath = `album/${albumFileName}`;

                  const { data: albumData } = await sb.storage
                    .from("media")
                    .upload(albumFilePath, blob, {
                      cacheControl: "3600",
                      upsert: true,
                      contentType: "image/jpeg",
                    });

                  if (albumData?.path) {
                    albumPath = albumData.path;
                  }
                } catch (albumError) {
                  console.warn("앨범 커버 업로드 실패:", albumError);
                }
              }
            }

            // BGM 업로드 실행
            await uploadBGMToDB({
              musicFile,
              artist,
              title,
              duration,
              albumPath,
            });

            // 성공 처리
            alert("BGM이 성공적으로 설정되었습니다!");
            document.getElementById("bgm-upload-modal").style.display = "none";
            
            // 🔥 UI 상태 완전 복원 (스크롤 활성화, 모달 상태 해제)
            document.body.style.overflow = "auto";
            document.body.classList.remove("modal-open");

            // 메인 음악 플레이어 새로고침
            if (typeof loadMainMusic === "function") {
              await loadMainMusic();
            }
          } catch (error) {
            console.error("BGM 업로드 실패:", error);
            alert("BGM 업로드 실패: " + error.message);
          } finally {
            uploadOverlay.style.display = "none";
          }
        });
      } catch (error) {
        console.error("BGM 업로드 처리 실패:", error);
        alert("BGM 업로드 실패: " + error.message);
        uploadOverlay.style.display = "none";
      }
    });

  // BGM 업로드 모달 취소
  document.getElementById("bgm-cancel")?.addEventListener("click", () => {
    document.getElementById("bgm-upload-modal").style.display = "none";
    
    // 🔥 UI 상태 완전 복원 (스크롤 활성화, 모달 상태 해제)
    document.body.style.overflow = "auto";
    document.body.classList.remove("modal-open");
  });

  // 파일 선택 시 자동으로 제목/아티스트 추출
  document.getElementById("bgm-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    const titleInput = document.getElementById("bgm-title");
    const artistInput = document.getElementById("bgm-artist");

    if (file) {
      const baseName = file.name.replace(/\.mp3$/i, "");
      const parts = baseName.split(" - ");

      // 일시적으로 disabled 해제
      titleInput.disabled = false;
      artistInput.disabled = false;

      if (parts.length >= 2) {
        artistInput.value = parts[0].trim();
        titleInput.value = parts[1].trim();
      } else {
        titleInput.value = baseName;
        artistInput.value = "알 수 없는 아티스트";
      }

      // 다시 disabled 처리
      titleInput.disabled = true;
      artistInput.disabled = true;
    } else {
      // 파일이 선택되지 않은 경우 초기화
      titleInput.disabled = false;
      artistInput.disabled = false;
      titleInput.value = "";
      artistInput.value = "";
      titleInput.disabled = true;
      artistInput.disabled = true;
    }
  });
});
