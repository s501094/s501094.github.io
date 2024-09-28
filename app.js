//const apiKey = 'AIzaSyByBbKXWZZgt03HqHWApMGzb3F8DOSckGQ';

let player;
const playlist = ['J2i0cZWCdq4', 'eOu74uBG7qc', 'ijpdruHDJHY', '28KRPhVzCus', '4xDzrJKXOOY', '5yx6BWlEVcY', '7NOSDKb0HlU']; // Add more video IDs
let currentVideoIndex = 0;

function onYouTubeIframeAPIReady() {
	player = new YT.Player('player', {
		videoId: playlist[currentVideoIndex],
		events: {
			'onReady': onPlayerReady,
			'onStateChange': onPlayerStateChange,
		},
		playerVars: {
			autoplay: 1,
			controls: 0,
			mute: 0, // Start muted to comply with autoplay policies
			loop: 1,
			playlist: playlist.join(','), // Loop the playlist
		},
	});
}

function onPlayerReady(event) {
	event.target.playVideo();
	fetchVideoDetails(playlist[currentVideoIndex]);
	// Set initial volume
	event.target.setVolume(50);
}

function onPlayerStateChange(event) {
	// Auto-update title when video changes
	if (event.data === YT.PlayerState.PLAYING) {
		fetchVideoDetails(player.getVideoData().video_id);
	}
}

// Play button event listener
document.getElementById('play').addEventListener('click', () => {
	player.unMute();
	player.playVideo();
});

// Pause button event listener
document.getElementById('pause').addEventListener('click', () => {
	player.pauseVideo();
});

// Next button event listener
document.getElementById('next').addEventListener('click', () => {
	currentVideoIndex = (currentVideoIndex + 1) % playlist.length;
	loadVideo(currentVideoIndex);
});

document.getElementById('stop').addEventListener('click', () => {
	player.stopVideo();
});

// Previous button event listener
document.getElementById('prev').addEventListener('click', () => {
	currentVideoIndex = (currentVideoIndex - 1 + playlist.length) % playlist.length;
	loadVideo(currentVideoIndex);
});

// Mute button event listener
document.getElementById('mute').addEventListener('click', () => {
	player.mute();
});

// Unmute button event listener
document.getElementById('unmute').addEventListener('click', () => {
	player.unMute();
});

// Volume control event listener
document.getElementById('volume').addEventListener('input', (e) => {
	const volume = e.target.value;
	player.setVolume(volume);
});

// Load a new video by index
function loadVideo(index) {
	const videoId = playlist[index];
	player.loadVideoById(videoId);
	fetchVideoDetails(videoId);
}

async function fetchVideoDetails(videoId) {
	try {
		//const response = await fetch(
		//	`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`
		//);
		const response = await fetch(`http://75.181.32.107:3535/api/videos/${videoId}`)
		const data = await response.json();
		if (data.items.length > 0) {
			const title = data.items[0].snippet.title;

			// Update both spans with the title text
			const scrollingTexts = document.querySelectorAll('.scrolling-text');
			scrollingTexts.forEach(span => {
				span.innerText = title;
			});

			// Update scrolling title animation duration
			updateScrollingTitle();
		} else {
			document.querySelectorAll('.scrolling-text').forEach(span => {
				span.innerText = 'Unknown Title';
			});
		}
	} catch (error) {
		console.error('Error fetching video details:', error);
	}
}

function updateScrollingTitle() {
	setTimeout(() => {
		const titleElement = document.getElementById('video-title');
		const containerWidth = document.getElementById('video-titleContainer').offsetWidth;
		const textWidth = titleElement.querySelector('.scrolling-text').scrollWidth;

		const totalTextWidth = textWidth * 2; // Duplicate the text to create a scrolling effect
		const scrollSpeed = 50; // Adjust this value to change the speed (pixels per second)
		const duration = totalTextWidth / scrollSpeed;

		// Apply the animation duration
		titleElement.style.animationDuration = `${duration}s`;

		// Restart the animation
		titleElement.style.animation = 'none';
		titleElement.offsetHeight; // Trigger reflow
		titleElement.style.animation = `marquee ${duration}s linear infinite`;
	}, 100);
}


