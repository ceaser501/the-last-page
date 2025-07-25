// 회원가입 기능 스크립트
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const signupBtn = document.getElementById('signup-btn');
    const signupModal = document.getElementById('signup-modal');
    const signupForm = document.getElementById('signup-form');
    const signupCancel = document.getElementById('signup-cancel');
    
    // 회원가입 버튼 클릭 시 모달 열기
    signupBtn.addEventListener('click', function() {
      signupModal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
      document.body.classList.add('modal-open');
    });
    
    // 취소 버튼 클릭 시 모달 닫기
    signupCancel.addEventListener('click', function() {
      closeSignupModal();
    });
    
    // 모달 배경 클릭 시 닫기
    signupModal.addEventListener('click', function(e) {
      if (e.target === signupModal) {
        closeSignupModal();
      }
    });
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && signupModal.style.display === 'flex') {
        closeSignupModal();
      }
    });
    
    // 모달 닫기 함수
    function closeSignupModal() {
      signupModal.style.display = 'none';
      document.body.style.overflow = 'auto';
      document.body.classList.remove('modal-open');
      signupForm.reset(); // 폼 초기화
    }
    
    // 폼 제출 처리
    signupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = {
        username: document.getElementById('signup-username').value,
        email: document.getElementById('signup-email').value,
        password: document.getElementById('signup-password').value,
        passwordConfirm: document.getElementById('signup-password-confirm').value,
        nickname: document.getElementById('signup-nickname').value,
        phone: document.getElementById('signup-phone').value,
        agree: document.getElementById('signup-agree').checked
      };
      
      // 폼 유효성 검사
      if (!validateSignupForm(formData)) {
        return;
      }
      
      // 회원가입 처리 (실제 구현 시 API 호출)
      handleSignup(formData);
    });
    
    // 폼 유효성 검사
    function validateSignupForm(data) {
      // 필수 필드 검사
      if (!data.username.trim()) {
        alert('사용자명을 입력해주세요.');
        return false;
      }
      
      if (!data.email.trim()) {
        alert('이메일을 입력해주세요.');
        return false;
      }
      
      // 이메일 형식 검사
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        alert('올바른 이메일 형식을 입력해주세요.');
        return false;
      }
      
      if (!data.password) {
        alert('비밀번호를 입력해주세요.');
        return false;
      }
      
      // 비밀번호 길이 검사
      if (data.password.length < 6) {
        alert('비밀번호는 6자 이상이어야 합니다.');
        return false;
      }
      
      // 비밀번호 확인 검사
      if (data.password !== data.passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return false;
      }
      
      // 동의 체크박스 검사
      if (!data.agree) {
        alert('개인정보 수집 및 이용에 동의해주세요.');
        return false;
      }
      
      return true;
    }
    
    // 회원가입 처리 (현재는 시뮬레이션)
    function handleSignup(data) {
      // 로딩 표시
      const submitBtn = document.getElementById('signup-submit');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '처리중...';
      submitBtn.disabled = true;
      
      // 실제로는 서버 API 호출
      setTimeout(() => {
        alert(`회원가입이 완료되었습니다!\\n환영합니다, ${data.nickname || data.username}님!`);
        closeSignupModal();
        
        // 버튼 상태 복원
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // 실제 구현 시에는 여기서 로그인 처리나 페이지 이동 등 수행
        console.log('회원가입 데이터:', {
          username: data.username,
          email: data.email,
          nickname: data.nickname,
          phone: data.phone
        });
      }, 1500);
    }
    
    // 전화번호 자동 포맷팅
    const phoneInput = document.getElementById('signup-phone');
    phoneInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/[^0-9]/g, '');
      if (value.length >= 3 && value.length <= 7) {
        value = value.replace(/(\d{3})(\d{1,4})/, '$1-$2');
      } else if (value.length > 7) {
        value = value.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
      }
      e.target.value = value;
    });
  });
})();