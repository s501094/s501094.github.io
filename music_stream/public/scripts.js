// scripts.js
const audioPlayer = document.getElementById('audioPlayer');
const urlInput = document.getElementById('urlInput');
const thumbnailDiv = document.getElementById('thumbnail');

function logMessage(message) {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  console.log(logMessage);
  fetch('/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ logMessage })
  });
}

async function loadAndPlay() {
  const url = urlInput.value;
  if (!url) {
    logMessage('No URL provided.');
    return;
  }

  logMessage(`Loading URL: ${url}`);
  try {
    const response = await fetch(`https://noembed.com/embed?url=${url}`);
    const data = await response.json();

    if (data.error) {
      logMessage(`Error fetching video data: ${data.error}`);
      return;
    }

    const videoId = url.split('v=')[1] || url.split('/').pop();
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    thumbnailDiv.innerHTML = `<img src="${thumbnailUrl}" alt="Video Thumbnail">`;

    const audioUrl = `https://www.youtube.com/embed/${videoId}`;
    audioPlayer.src = audioUrl;
    audioPlayer.play();
    logMessage('Playing audio.');
  } catch (error) {
    logMessage(`Error: ${error.message}`);
  }
}

function play() {
  audioPlayer.play();
  logMessage('Audio playback started.');
}

function pause() {
  audioPlayer.pause();
  logMessage('Audio playback paused.');
}

