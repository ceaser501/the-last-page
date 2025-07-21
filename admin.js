/* sb 연동 */
const sb = window.sbClient;

document.addEventListener("DOMContentLoaded", () => {
  // 아이콘 만들기
  const icon = document.createElement("div");
  icon.id = "admin-icon";
  icon.innerHTML = '<i class="fas fa-user"></i>';
  icon.style.position = "fixed";
  icon.style.top = "15px";
  icon.style.right = "15px";
  icon.style.cursor = "pointer";
  icon.style.zIndex = 1000;
  icon.style.width = "40px";
  icon.style.height = "40px";
  icon.style.borderRadius = "50%";
  icon.style.backgroundColor = "#f0f0f0";
  icon.style.display = "flex";
  icon.style.alignItems = "center";
  icon.style.justifyContent = "center";
  icon.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
  icon.title = "관리자 로그인";
  icon.querySelector("i").style.color = "#333";
  icon.querySelector("i").style.fontSize = "18px";
  document.body.appendChild(icon);

  // 로그인 모달 생성
  const loginModal = document.createElement("div");
  loginModal.style.display = "none";
  loginModal.style.position = "fixed";
  loginModal.style.top = 0;
  loginModal.style.left = 0;
  loginModal.style.width = "100%";
  loginModal.style.height = "100%";
  loginModal.style.background = "rgba(0, 0, 0, 0.4)";
  loginModal.style.zIndex = 999;
  loginModal.innerHTML = `
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: white; padding: 20px; border-radius: 10px; width: 300px;
                text-align: center; box-shadow: 0 5px 20px rgba(0,0,0,0.2);">
      <h3>관리자 로그인</h3>
      <input id="admin-id" placeholder="아이디" style="width: 80%; padding: 6px; margin: 8px 0;" /><br/>
      <input id="admin-pw" type="password" placeholder="비밀번호" style="width: 80%; padding: 6px; margin-bottom: 10px;" /><br/>
      <button id="login-btn" style="padding: 6px 12px; margin-right: 10px;">로그인</button>
      <button id="cancel-btn" style="padding: 6px 12px;">취소</button>
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
          <h2>📌 추억 업로드</h2>

          <div class="form-group">
            <label for="thumbnail-title">썸네일 제목 *</label>
            <input type="text" id="thumbnail-title" required />
          </div>

          <div class="form-group">
            <label for="media_files">파일 업로드 *</label>
            <input type="file" name="media_files" id="media_files" multiple accept="image/*,video/*" required />
          </div>

          <div id="thumbnail-preview" class="thumbnail-preview-container"></div>
          <input type="hidden" id="main-thumbnail-index" />

          <div class="form-group">
            <label for="title">제목 *</label>
            <input type="text" id="title" required />
          </div>

          <div class="form-group">
            <label for="description">내용 *</label>
            <textarea id="description" rows="4" required></textarea>
          </div>

          <div class="form-group">
            <label for="date">날짜 *</label>
            <input type="date" id="date" required />
          </div>

          <div class="form-group">
            <label for="location">장소 *</label>
            <div class="address-group">
              <input type="text" id="location" readonly required placeholder="주소 검색 클릭" />
              <button type="button" onclick="execDaumPostcode()">주소 검색</button>
            </div>
          </div>

          <div class="form-group">
            <label for="order">노출순서 *</label>
            <input type="number" id="order" required />
          </div>

          <div class="tag-wrapper">
            <div class="form-group" style="margin-bottom:0">
              <label for="order">태그입력 *</label>
            </div>
            <div class="tag-input-container">
              <input type="text" id="tags-input" placeholder="# 태그 입력 (최대 5개)" />
            </div>
            <div id="tags-preview" class="tag-preview-container"></div>
          </div>

          <input type="checkbox" id="is-public" checked hidden />

          <div class="form-actions">
            <button type="submit">등록</button>
            <button type="button" id="cancel-entry">닫기</button>
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
  guideText.textContent = "대표 이미지를 선택하세요";
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
    const files = Array.from(e.target.files);

    previewContainer.innerHTML = ""; // 초기화

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
        });

        previewContainer.appendChild(thumb);
      };
      reader.readAsDataURL(file);
    });

    selectedIndex = 0; // 첫번째 기본 선택
  });

  icon.addEventListener("click", () => (loginModal.style.display = "block"));
  loginModal
    .querySelector("#cancel-btn")
    .addEventListener("click", () => (loginModal.style.display = "none"));
  formModal
    .querySelector("#cancel-entry")
    .addEventListener("click", () => (formModal.style.display = "none"));

  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) loginModal.style.display = "none";
  });
  formModal.addEventListener("click", (e) => {
    if (e.target === formModal) formModal.style.display = "none";
  });

  loginModal.querySelector("#login-btn").addEventListener("click", () => {
    const id = loginModal.querySelector("#admin-id").value.trim();
    const pw = loginModal.querySelector("#admin-pw").value.trim();
    if (id === "ceaser501" && pw === "0928") {
      alert("로그인 성공");
      loginModal.style.display = "none";
      formModal.style.display = "block";
    } else {
      alert("아이디 또는 비밀번호가 틀렸습니다.");
    }
  });

  // 등록 처리
  formModal
    .querySelector("form")
    ?.addEventListener("submit", async function (e) {
      e.preventDefault();

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

      // 2. 파일 업로드 후 URL 리스트 만들기
      const uploadedList = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const fileName = `memory_${Date.now()}_${i}.${ext}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await sb.storage
          .from("media")
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

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
        });
      }

      if (uploadedList.length === 0) {
        alert("파일 업로드에 실패했습니다.");
        return;
      }

      // 3. media_files 일괄 insert
      console.log("📦 uploadedList:", uploadedList);
      const { error: insertError } = await sb
        .from("media_files")
        .insert(uploadedList);
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
    });
});

function execDaumPostcode() {
  new daum.Postcode({
    oncomplete: function (data) {
      document.getElementById("location").value = data.address;
    },
  }).open();
}
