// ===== 1. 스크롤 Fade-in 애니메이션 =====
const sections = document.querySelectorAll('h2, table, form, blockquote, pre, details, .demo-box, .counter-badge, #color-box');
sections.forEach(el => el.classList.add('fade-in'));

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ===== 2. 타이핑 효과 =====
const typingEl = document.getElementById('typing-text');
const phrases = [
    'HTML, CSS, JS를 배워봅시다!',
    '웹 개발의 기초입니다.',
    '직접 코드를 수정해보세요!',
    '재미있는 웹의 세계에 오신 걸 환영합니다!'
];
let phraseIdx = 0;
let charIdx = 0;
let isDeleting = false;

function typeLoop() {
    const current = phrases[phraseIdx];
    if (!isDeleting) {
        typingEl.textContent = current.substring(0, charIdx + 1);
        charIdx++;
        if (charIdx === current.length) {
            isDeleting = true;
            setTimeout(typeLoop, 1500);
            return;
        }
        setTimeout(typeLoop, 80);
    } else {
        typingEl.textContent = current.substring(0, charIdx - 1);
        charIdx--;
        if (charIdx === 0) {
            isDeleting = false;
            phraseIdx = (phraseIdx + 1) % phrases.length;
            setTimeout(typeLoop, 400);
            return;
        }
        setTimeout(typeLoop, 40);
    }
}
typeLoop();

// ===== 3. 진행 바 애니메이션 =====
const progressBar = document.getElementById('my-progress');
let progressValue = 0;

function animateProgress() {
    if (progressValue < 70) {
        progressValue++;
        progressBar.value = progressValue;
        requestAnimationFrame(animateProgress);
    }
}

const progressObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            progressValue = 0;
            animateProgress();
        }
    });
}, { threshold: 0.5 });
progressObserver.observe(progressBar);

// ===== 4. 카운터 =====
const counterNum = document.getElementById('counter-num');
let count = 0;

document.getElementById('plus-btn').addEventListener('click', () => {
    count++;
    counterNum.textContent = count;
    counterNum.classList.add('pop');
    setTimeout(() => counterNum.classList.remove('pop'), 200);
});

document.getElementById('minus-btn').addEventListener('click', () => {
    count--;
    counterNum.textContent = count;
    counterNum.classList.add('pop');
    setTimeout(() => counterNum.classList.remove('pop'), 200);
});

// ===== 5. 색상 변경 박스 =====
const colorBox = document.getElementById('color-box');
const colors = ['#1a73e8', '#d93025', '#0d904f', '#f9a825', '#9c27b0', '#00acc1'];
let colorIdx = 0;
colorBox.style.backgroundColor = colors[0];

colorBox.addEventListener('click', () => {
    colorIdx = (colorIdx + 1) % colors.length;
    colorBox.style.backgroundColor = colors[colorIdx];
    colorBox.style.transform = 'scale(0.95)';
    setTimeout(() => { colorBox.style.transform = 'scale(1)'; }, 150);
    colorBox.textContent = colors[colorIdx];
});

// ===== 6. 맨 위로 스크롤 버튼 =====
const scrollBtn = document.getElementById('scroll-top-btn');

window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
        scrollBtn.classList.add('show');
    } else {
        scrollBtn.classList.remove('show');
    }
});

scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== 7. 다크 모드 토글 =====
const darkBtn = document.getElementById('dark-mode-btn');

darkBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    darkBtn.textContent = document.body.classList.contains('dark') ? '라이트 모드' : '다크 모드';
});

// ===== 8. 리스트 아이템 클릭 시 완료 표시 =====
document.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
        if (li.style.textDecoration === 'line-through') {
            li.style.textDecoration = 'none';
            li.style.opacity = '1';
        } else {
            li.style.textDecoration = 'line-through';
            li.style.opacity = '0.5';
        }
    });
});

// ===== 9. 폼 제출 시 알림 =====
document.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value || '익명';
    alert(name + '님, 제출되었습니다!');
});
