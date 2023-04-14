const puppeteer = require("puppeteer");
require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const contextMenu = require('electron-context-menu');




const { sb9k_prompt } = require("./src/prompt.js");
const {
  truncateMaxTokens,
  sleep,
  formatLinksForChat,
  chatGPT,
  salvageJSON,
} = require("./src/gpt-utils.js");

const {
  aiSearch,
  aiNavigate,
} = require("./src/ai-methods.js");

let pauseAI = false;

ipcMain.on('pause', (event, value) => {
  pauseAI = !pauseAI;
  console.log('pauseAI', pauseAI);
});

//Hacky.  If the dev makes this package work with require, then we can remove this.
let gptEncoder;
async function loadEncoderModule() {
  const { encode: importedEncode, decode: importedDecode } = await import('gpt-token-utils');
  gptEncoder = importedEncode;
}

// for puppeteer
let browser, page;

// for electron
let mainWindow;
let initialQuestion;

// These should be commented out in .env if you don't want to use them.
if (process.env.DBUG || process.env.OFFLINE)
  console.log("process.env.DBUG", process.env.DBUG,
    "process.env.OFFLINE", process.env.OFFLINE);

// TODO - Move to /src/electron.js file
function loadWebPageImage(base64Image) {
  mainWindow.webContents.send("update-webpage-image", base64Image);
}


// TODO - Move to /src/electron.js file or 
// TODO - strip some logic out of this function, into utils or other files.
async function createWindow() {

  contextMenu({
    showSaveImageAs: true
  });
  
  browser = await puppeteer.launch({ headless: true });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 3000 });
  // can this be done elsewhere?
  await loadEncoderModule();

  const urlHistory = [];
  const memories = [];
  let fullMessageLog = [];

  initialQuestion = process.argv[2];

  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: `${__dirname}/assets/preload.js`,
      },
    });


    await mainWindow.loadFile("index.html");
    mainWindow.setTitle(`SearchBot9k - ${initialQuestion}`);

    if (process.env.DBUG || process.env.OFFLINE || process.env.DEVTOOLS)
      mainWindow.webContents.openDevTools();
    mainWindow.webContents.on("context-menu", (e) => e.preventDefault());


    memories.push("Initial Question: " + initialQuestion);

    let messages = [
      {
        role: "system",
        content: sb9k_prompt + `The user wants to know: '${initialQuestion}'. `,
      },
    ];
    // store same messages in fullMessageLog
    fullMessageLog.push(...messages);

    mainWindow.webContents.send("update-messages", fullMessageLog);
    let answered = false;
    while (true) {

      ipcMain.on('ask-ai', (event, value) => {
        console.log("ask-ai event received");
        console.log(value);
        let new_question = value;

        switch (value) {
          case "CONTINUE":
            new_question = "Please continue.  If you could elaborate or be more specific, that would be great.";
            answered = false;
            pauseAi = false;
            break;
        }


        messages.push({
          role: "system",
          content:
            " Remember:\n\n- " +
            // implode memories concatenating with newline \n
            memories.join("\n- ") +
            "\n\n",
        },
          {
            role: "system",
            content: "Url History:\n\n" + JSON.stringify(urlHistory),
          },
          { role: "user", content: new_question });

        fullMessageLog.push(...messages);
      });

      let pause_timer = 0;
      while (pauseAI) {
        let timestamp = new Date().toLocaleTimeString();
        if(pause_timer == 0) console.log(`${timestamp}: Loop paused`);
        if(++pause_timer < 4) console.log('Sleeping' + ".".repeat(pause_timer));
        await sleep(1000);
        // Needs synced ui state if OFFLINE mode.
        // mainWindow.webContents.send("update-set-text", {
        //   id: "pause-ai",
        //   text: "Unpause AI",
        // });
      }
      if (!answered) {

        let gptResponse = "";
        if (process.env.OFFLINE) {
          gptResponse = await Promise.resolve(
            '{"navigate": "https://github.com/pale2hall/searchbot9k"}'
          );

          mainWindow.webContents.send("update-set-val", {
            id: "address-bar",
            val: "https://github.com/pale2hall/searchbot9k",
          });

          mainWindow.webContents.send("update-set-text", {
            id: "token-usage",
            text: "OFFLINE MODE",
          });

          pauseAI = true;
        } else {
          // Call the AI
          gptResponse = await chatGPT(messages, mainWindow);
        }

        let jsonResponse;

        try {
          jsonResponse = JSON.parse(gptResponse);
        } catch (error) {

          fullMessageLog.push({ role: "error", content:  
          "ChatBot returned malformed JSON\n\n==========" 
          + gptResponse
          + "==========" });

          console.error('Error parsing JSON:', error);
          // Handle the error, e.g., set jsonResponse to an empty object or perform other actions
          jsonResponse = salvageJSON(gptResponse);

          if(!jsonResponse)
            jsonResponse = { "error": "ChatBot returned malformed JSON", "response_text": gptResponse };

        }

        messages.push({ role: "assistant", content: gptResponse });
        fullMessageLog.push({ role: "assistant", content: gptResponse });

        let next_message = "";

        if (jsonResponse.remember) {
          if (typeof jsonResponse.remember === "string") {
            memories.push(jsonResponse.remember);
          } else if (typeof jsonResponse.remember === "object") {
            memories.push(...jsonResponse.remember);
          }
        }
        // jsonResponse = {"error": "ChatBot returned malformed JSON", "response_text": gptResponse};

        if (jsonResponse.error) {
          fullMessageLog.push({
            role: "error",
            content: "Malformed JSON Returned from ChatBot\n " + jsonResponse.response_text
          });
          pauseAI = true;

          messages.push({
            role: "system",
            content: "ERROR: sb9k has returned malformed JSON. Please only return JSON.",
          });


        }

        if (jsonResponse.answer) {
          // answer question and end script
          console.log(`Answer: ${jsonResponse.answer}`);
          next_message =
            next_message + `Here is the answer: ${jsonResponse.answer}`;
          answered = true;
          pauseAI = true;

          mainWindow.webContents.send("update-answer", jsonResponse.answer);
          // TODO, tell Electron about the answer being found and spawn an alert message.
        } else if (jsonResponse.search) {
          // search a new query
          let url = `https://google.com/search?q=${jsonResponse.search}`;
          urlHistory.push(url);
          mainWindow.webContents.send("update-set-val", {
            id: "address-bar",
            val: url,
          });
          console.log(`New search phrase: ${jsonResponse.search}`);
          // TODO loading animation
          const serp = await aiSearch(jsonResponse.search, page, loadWebPageImage);
          next_message =
            next_message +
            `Here's the content of the page:\n
              ${serp.content}
          \n\n
              Here are the search results:\n${formatLinksForChat(serp.links)}`;
        } else if (jsonResponse.navigate) {
          // we really should validate the urls...
          mainWindow.webContents.send("update-set-val", {
            id: "address-bar",
            val: jsonResponse.navigate,
          });

          urlHistory.push(jsonResponse.navigate);
          console.log(`Link: ${jsonResponse.navigate}`);
          const pageData = await aiNavigate(jsonResponse.navigate, page, loadWebPageImage);
          let pageContent = pageData.content;
          pageContent = truncateMaxTokens(gptEncoder, pageContent, 750);
          next_message =
            next_message +
            `Here is the first 500 tokens chars text on the page:\n${pageContent}`
            + `\n\nHere are the first 500 tokens of links on the page:\n${truncateMaxTokens(gptEncoder, formatLinksForChat(
              pageData.links
            ), 750)}`;
        } else {
          console.log("Unknown response", jsonResponse);
        }

        // Remove old user and assistant messages.  Keep init message.
        messages = messages.filter((message, index, arr) => {
          if (message.role === "system") {
            return index === 0;
          }
          return false;
        });

        let newMessages = [
          {
            role: "system",
            content: ` Remember:\n\n- ${memories.join("\n- ")} \n\n`,
          },
          {
            role: "system",
            content: " Url History:\n\n" + JSON.stringify(urlHistory),
          },
          { role: "user", content: next_message },
        ];

        messages.push(...newMessages);
        fullMessageLog.push(...newMessages);

        mainWindow.webContents.send("update-messages", fullMessageLog);
      }
    }

    await browser.close();

  } catch (error) {
    console.error("Error:", error);
  }

}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
