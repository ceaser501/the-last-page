// 💍 결혼식 D-Day 카운터 - 2026년 4월 12일
const WEDDING_DATE = new Date("2026-04-12T14:20:00").getTime();

// D-Day 카운터 업데이트
function updateDDayCounter() {
  const now = new Date().getTime();
  const distance = WEDDING_DATE - now;

  // 만약 결혼식 날짜가 지났다면
  if (distance < 0) {
    document.getElementById("wedding-dday").innerHTML = `
      <div class="dday-title">💍 We're Married!</div>
      <div class="dday-time">
        <span class="dday-number">❤️</span>
        <span class="dday-unit">Forever</span>
      </div>
    `;
    return;
  }

  // 시간 계산
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // 숫자를 패딩하여 표시 (예: 05, 09)
  const formatNumber = (num) => num.toString().padStart(2, "0");
  const formatDays = (num) => num.toString().padStart(3, "0");

  // DOM 업데이트
  document.getElementById("days").textContent = formatDays(days);
  document.getElementById("hours").textContent = formatNumber(hours);
  document.getElementById("minutes").textContent = formatNumber(minutes);
  document.getElementById("seconds").textContent = formatNumber(seconds);
}

// 페이지 로드 완료 후 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log("💍 Wedding D-Day 카운터 시작!");
  updateDDayCounter();
  setInterval(updateDDayCounter, 1000);
});
