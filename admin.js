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

  // 로그인 모달
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

  // 입력 폼 모달
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
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: white; padding: 20px; border-radius: 10px; width: 340px;
                text-align: center; box-shadow: 0 5px 20px rgba(0,0,0,0.2);">
      <h3>추억 추가</h3>
      <p style="font-size: 12px; margin-bottom: 6px; color: #888;">* 필수 항목입니다</p>
      <input type="file" id="media-file" accept="image/*,video/*" style="width: 90%; margin: 6px 0;" required /><br/>
      <input placeholder="제목 (선택)" id="media-title" style="width: 90%; padding: 6px; margin: 6px 0;" /><br/>
      <textarea placeholder="메모 (선택)" id="media-description" style="width: 90%; height: 60px; padding: 6px; margin: 6px 0;"></textarea><br/>
      <input placeholder="장소 (선택)" id="media-location" style="width: 90%; padding: 6px; margin: 6px 0;" /><br/>
      <input type="date" id="media-date" style="width: 90%; padding: 6px; margin: 6px 0;" required /><br/>
      <input type="number" placeholder="순서 (예: 1)" id="media-order" style="width: 90%; padding: 6px; margin: 6px 0;" required /><br/>
      <button id="submit-entry" style="padding: 6px 12px; margin-right: 10px;">등록</button>
      <button id="cancel-entry" style="padding: 6px 12px;">닫기</button>
    </div>
  `;
  document.body.appendChild(formModal);

  icon.addEventListener("click", () => {
    loginModal.style.display = "block";
  });

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

  loginModal.querySelector("#cancel-btn").addEventListener("click", () => {
    loginModal.style.display = "none";
  });

  formModal.querySelector("#cancel-entry").addEventListener("click", () => {
    formModal.style.display = "none";
  });

  formModal.querySelector("#submit-entry").addEventListener("click", () => {
    const file = formModal.querySelector("#media-file").files[0];
    const title = formModal.querySelector("#media-title").value.trim();
    const description = formModal
      .querySelector("#media-description")
      .value.trim();
    const location = formModal.querySelector("#media-location").value.trim();
    const date = formModal.querySelector("#media-date").value.trim();
    const order = parseInt(
      formModal.querySelector("#media-order").value.trim(),
      10
    );

    console.log("입력값:", { file, title, description, location, date, order });
    alert("입력 완료 (console에 출력됨)");
    formModal.style.display = "none";
  });
});
