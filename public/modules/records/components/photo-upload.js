/* ================================================================
   Records Module — components/photo-upload.js
   사진 업로드/캐러셀 컴포넌트
   ================================================================ */

// 카드 내 사진 캐러셀 스와이프 핸들러
let _carouselInitialized = false;

export function initCarousel() {
  if (_carouselInitialized) return;
  _carouselInitialized = true;

  let startX = 0, startY = 0, isDragging = false, currentCarousel = null;

  document.addEventListener('touchstart', function (e) {
    const carousel = e.target.closest('.rc-carousel');
    if (!carousel) return;
    e.stopPropagation();
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
    currentCarousel = carousel;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!isDragging || !currentCarousel) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - startX;
    const diffY = endY - startY;
    isDragging = false;

    if (Math.abs(diffX) < 30 || Math.abs(diffY) > Math.abs(diffX)) { currentCarousel = null; return; }

    const total = parseInt(currentCarousel.dataset.total) || 1;
    let idx = parseInt(currentCarousel.dataset.idx) || 0;

    if (diffX < -30 && idx < total - 1) idx++;
    else if (diffX > 30 && idx > 0) idx--;
    else { currentCarousel = null; return; }

    currentCarousel.dataset.idx = idx;
    const track = currentCarousel.querySelector('.rc-carousel-track');
    if (track) track.style.transform = 'translateX(-' + (idx * (100 / total)) + '%)';

    const dots = currentCarousel.querySelectorAll('.rc-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));

    const badge = currentCarousel.querySelector('.record-gallery-badge');
    if (badge) badge.textContent = (idx + 1) + '/' + total;

    currentCarousel = null;
  }, { passive: true });

  // 마우스 드래그 지원 (데스크탑)
  document.addEventListener('mousedown', function (e) {
    const carousel = e.target.closest('.rc-carousel');
    if (!carousel) return;
    e.preventDefault();
    startX = e.clientX;
    isDragging = true;
    currentCarousel = carousel;
  });

  document.addEventListener('mouseup', function (e) {
    if (!isDragging || !currentCarousel) return;
    const diffX = e.clientX - startX;
    isDragging = false;

    if (Math.abs(diffX) < 30) { currentCarousel = null; return; }

    const total = parseInt(currentCarousel.dataset.total) || 1;
    let idx = parseInt(currentCarousel.dataset.idx) || 0;

    if (diffX < -30 && idx < total - 1) idx++;
    else if (diffX > 30 && idx > 0) idx--;
    else { currentCarousel = null; return; }

    currentCarousel.dataset.idx = idx;
    const track = currentCarousel.querySelector('.rc-carousel-track');
    if (track) track.style.transform = 'translateX(-' + (idx * (100 / total)) + '%)';

    const dots = currentCarousel.querySelectorAll('.rc-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));

    const badge = currentCarousel.querySelector('.record-gallery-badge');
    if (badge) badge.textContent = (idx + 1) + '/' + total;

    currentCarousel = null;
  });
}

// 상세 갤러리 스크롤 인디케이터 업데이트
export function initDetailGalleryScroll() {
  document.addEventListener('scroll', function (e) {
    const scroll = e.target;
    if (!scroll || !scroll.classList || !scroll.classList.contains('detail-gallery-scroll')) return;
    const items = scroll.querySelectorAll('.detail-gallery-item');
    if (items.length === 0) return;
    const scrollLeft = scroll.scrollLeft;
    const itemWidth = items[0].offsetWidth;
    const gap = 12;
    const idx = Math.round(scrollLeft / (itemWidth + gap));
    const indicator = scroll.closest('.detail-gallery-wrap')?.querySelector('.detail-gallery-current');
    if (indicator) indicator.textContent = Math.min(idx + 1, items.length);
  }, true);
}
