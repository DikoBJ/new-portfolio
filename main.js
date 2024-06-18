function updateDateTime() {
    const now = new Date();

    const optionsDate = { weekday: 'long' };
    const dayName = now.toLocaleDateString(undefined, optionsDate);
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const formattedWeek = `${dayName}`;
    const formattedDate = `${day}/${month}/${year}`


    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${hours}:${minutes} ${ampm}`;

    // Calculate the GMT offset
    const timezoneOffset = -now.getTimezoneOffset() / 60;
    const gmtOffset = `GMT${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;

    document.getElementById('currentWeek').textContent = formattedWeek;
    document.getElementById('currentDate').textContent = formattedDate;
    document.getElementById('currentTime').textContent = formattedTime;
    document.getElementById('currentGMT').textContent = gmtOffset;
}

updateDateTime();
setInterval(updateDateTime, 1000);



let currentIndex = 0;

const circle = document.getElementById('circle');
const contentDisplay = document.getElementById('contentDisplay');

const segments = document.querySelectorAll('.segment');
const contents = document.querySelectorAll('.content');

function copyRelevantStyles(source, target) {
    const styles = window.getComputedStyle(source);
    const styleProperties = [
        'color', 'font-size', 'font-weight', 'text-align',
        'line-height', 'background-color', 'padding', 'margin',
        'border', 'border-radius', 'font-family'
    ];
    styleProperties.forEach(property => {
        target.style[property] = styles.getPropertyValue(property);
    });
}

function updateContent() {

    currentIndex = (currentIndex + segments.length) % segments.length;
    let currentRotation = 360 - (currentIndex * (360 / segments.length))

    const segment = segments[currentIndex];
    const contentId = segment.getAttribute('data-content');
    const activeContent = document.getElementById(contentId);
    contentDisplay.innerHTML = '';

    Array.from(activeContent.children).forEach((child) => {
        const clone = child.cloneNode(true);
        copyRelevantStyles(child, clone);
        contentDisplay.appendChild(clone);
    });


    circle.style.transform = `rotate(${currentRotation}deg)`;
   

}

function handleKeyPress(event) {
    if (event.key === 'ArrowRight') {
        currentIndex += 1;
    } else if (event.key === 'ArrowLeft') {
        currentIndex -= 1;
    }
    updateContent();
}

document.addEventListener('keydown', handleKeyPress);

updateContent();

function replaceContent(event) {
    event.preventDefault();
    console.log("Diana");
    const currentContent = document.querySelector('.content-display .previous');
    const nextContent = document.querySelector('.content-display .next');
    console.log(currentContent, nextContent);
    if (currentContent && nextContent) {
        currentContent.style.display = 'none';
        nextContent.style.display = 'block';
        console.log('Content replaced: .previous hidden, .next shown.');
    } else {
        console.log('Elements not found');
    }
}



let isScrolling = false;
let startY = 0;
let endY = 0;

function handleScroll(event) {
    if (isScrolling) return;

    let delta = 0;
    if (event.type === 'wheel') {
        delta = event.deltaY;
    } else if (event.type === 'touchmove') {
        endY = event.touches[0].clientY;
        delta = endY - startY;
    }

    if (delta > 0) {
        currentIndex += 1;
    } else if (delta < 0) {
        currentIndex -= 1;
    }

    updateContent();

    isScrolling = true;
    setTimeout(() => {
        isScrolling = false;
    }, 1000);
}

document.addEventListener('wheel', handleScroll, { passive: false });

document.addEventListener('touchstart', function(event) {
    startY = event.touches[0].clientY;
});

document.addEventListener('touchmove', handleScroll, { passive: false });
