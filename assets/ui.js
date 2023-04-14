
let pauseAI = false;
let foreground_window_z_index = 1;
let autoScrollOn = false;

function togglePauseAI() {
  pauseAI = !pauseAI;
  window.electron.togglePauseAI();
  document.getElementById('pause-ai').innerHTML = pauseAI ? 'Unpause AI' : 'Pause AI';
}

function askAI(request) {
  window.electron.askAI(request);
}

function scrollToBottom() {
    const messages = document.getElementById("messages");
    messages.scrollTop = messages.scrollHeight;
    // explain what we did to console
    console.log("scrolling to bottom");
    //show values
    console.log("messages.scrollHeight: " + messages.scrollHeight);
    console.log("messages.scrollTop: " + messages.scrollTop);

}

function toggleAutoScroll() {
  autoScrollOn = !autoScrollOn;
  document.getElementById("autoscroll-status").innerHTML = (autoScrollOn ? "ON" : "OFF");
}

window.electron.onUpdateMessages((_, messages) => {
  document.getElementById("messages").innerHTML = messages
    .map(
      (message) =>
        `<div class="message role-${message.role}"><div class="badgebadge-${message.role}">${message.role}</div>${message.content}</div>`
    )
    .join("");
 if(autoScrollOn) scrollToBottom();
});

window.electron.onUpdateWebPageImage((_, base64Image) => {
  document.getElementById(
    "webpage-image"
  ).src = `data:image/png;base64,${base64Image}`;
});

window.electron.onUpdateAnswer((_, answer) => {
  document.getElementById("answer-text").innerHTML = answer;
  document.getElementById("answer").style.zIndex = 9001;
});


window.electron.onUpdateSetText((_, update) => {
  const element = document.getElementById(update.id);
  if (element) {
    element.innerHTML = update.text;
  } else {
    console.log(
      `Element with id '${update.id}' not found in the DOM.` +
      `Unable to update text to: '${update.text}'`
      );
    
  }
});


window.electron.onUpdateSetVal((_, update) => {
  const element = document.getElementById(update.id);
  if (element) {
    element.value = update.val;
  } else {
    console.log(
      `Element with id '${update.id}' not found in the DOM.` +
      `Unable to update value to: '${update.val}'`
      );
    
  }
});

//document ready
document.addEventListener("DOMContentLoaded", () => {
  
  document.querySelectorAll('.window > .window-title').forEach(titleBar => {
    titleBar.classList.add('no-select');
    let offsetX, offsetY, isMouseDown = false;

    titleBar.addEventListener('mousedown', (e) => {

      console.log("mousedown on titlebar");
      e.preventDefault();
      offsetX = e.clientX - titleBar.parentElement.offsetLeft;
      offsetY = e.clientY - titleBar.parentElement.offsetTop;
      isMouseDown = true;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      titleBar.parentElement.style.left = `${e.clientX - offsetX}px`;
      titleBar.parentElement.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
      isMouseDown = false;
      if ( titleBar.parentElement.offsetLeft < 0 ) {
        titleBar.parentElement.style.left = 0;
      }
      if ( titleBar.parentElement.offsetTop < 0 ) {
        titleBar.parentElement.style.top = 0;
      } 
    });
  });

  
  document.querySelectorAll('.window ').forEach(window => {
    window.addEventListener('mousedown', (e) => {
      foreground_window_z_index++;
      window.style.zIndex = foreground_window_z_index;
      e.preventDefault();
    });
  });

});


document.addEventListener('DOMContentLoaded', function() {

  
// set text in element.
toggleAutoScroll();

  var windows = document.querySelectorAll('.window');
  var currentWindow = null;
  var startX, startY, startWidth, startHeight;

  for (var i = 0; i < windows.length; i++) {
    var resizeHandle = windows[i].querySelector('.resize-handle');
    resizeHandle.addEventListener('mousedown', initResize, false);
  }

  function initResize(e) {
    startX = e.clientX;
    startY = e.clientY;
    currentWindow = e.target.parentElement;
    startWidth = parseInt(document.defaultView.getComputedStyle(currentWindow).width, 10);
    startHeight = parseInt(document.defaultView.getComputedStyle(currentWindow).height, 10);
    document.documentElement.addEventListener('mousemove', doResize, false);
    document.documentElement.addEventListener('mouseup', stopResize, false);
  }

  function doResize(e) {
    var newWidth = startWidth + e.clientX - startX;
    var newHeight = startHeight + e.clientY - startY;

    if (newWidth > 0 && newHeight > 0) {
      currentWindow.style.width = newWidth + 'px';
      currentWindow.style.height = newHeight + 'px';
    }
  }

  function stopResize() {
    document.documentElement.removeEventListener('mousemove', doResize, false);
    document.documentElement.removeEventListener('mouseup', stopResize, false);
  }
});