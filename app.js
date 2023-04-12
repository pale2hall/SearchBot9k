const axios = require("axios");
const puppeteer = require("puppeteer");
require("dotenv").config();
const { app, BrowserWindow } = require("electron");

// for puppeteer
let browser, page;

// for electron
let mainWindow;

let initialQuestion;

//Todo use a class or function?
// declate 3 global variables all set to 0
const tokensUsed = {
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
}

// These should be commented out in .env if you don't want to use them.
if (process.env.DBUG || process.env.OFFLINE)
  console.log(
    "process.env.DBUG",
    process.env.DBUG,
    "process.env.OFFLINE",
    process.env.OFFLINE
  );

const sb9k_prompt = require("./src/prompt.js");

async function chatGPT(messages) {
  const requestFn = () =>
    axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL,
        messages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );



  const response = await retryAxiosRequest(requestFn);
  // outputs to console and returns as string.
  let usage =  updateAndDisplayTokensUsed(response.data.usage);
  
  mainWindow.webContents.send("update-set-text", {
    id: "token-usage",
    text: usage,
  });


  return response.data.choices[0].message.content;
}

async function googleSearch(query) {
  let url = `https://google.com/search?q=${query}`;
  try {
    await page.goto(url);
  } catch (error) {
    console.error('Error navigating to page:', error);
  }

  const links = await page.evaluate(() => {
    const linkNodes = document.querySelectorAll(".tF2Cxc h3, .card-section");
    return Array.from(linkNodes)
      .map((link) => {
        const anchor = link.parentElement.parentElement.querySelector("a");
        if (anchor) {
          const url = anchor.href;
          if (link.innerText) return { title: link.innerText, url };
          return { url };

        } else {
          return null;
        }
      })
      .filter((link) => link !== null);
  });

  const content = await page.evaluate(() => {
    return document.documentElement.innerText;
  });

  const screenshot = await page.screenshot({ encoding: "base64" });
  loadWebPageImage(screenshot);
  return { links, content };
}

async function getPageContent(url) {
  
  try {
    await page.goto(url, { waitUntil: "networkidle2" });
  } catch (error) {
    console.error('Error navigating to page:', error);
  }

  let screenshot = await page.screenshot({ encoding: "base64" });

  loadWebPageImage(screenshot);

  const content = await page.evaluate(() => {
    // Super lazy way to get the text content of the page.  TODO FIX
    return document.documentElement.innerText;
  });

  const links = await page.evaluate(() => {
    const linkNodes = document.querySelectorAll("a");
    return Array.from(linkNodes)
      .map((link) => {
        const url = link.href;
        if (link.innerText) return { title: link.innerText, url };
        return { url };
      })
      .filter((link) => link !== null && link.url !== "");
  });

  screenshot = await page.screenshot({ encoding: "base64" });
  loadWebPageImage(screenshot);

  return { content, links };
}

function loadWebPageImage(base64Image) {
  mainWindow.webContents.send("update-webpage-image", base64Image);
}

function updateAndDisplayTokensUsed(usage) {


  tokensUsed.total_tokens += usage.total_tokens;
  tokensUsed.prompt_tokens += usage.prompt_tokens;
  tokensUsed.completion_tokens += usage.prompt_tokens;
  
  let status_bar = `Total Tokens Used: ${tokensUsed.total_tokens} `;
  let output = `==== TOKEN USAGE ==== \nTotal Tokens Used: ${tokensUsed.total_tokens} `
    + `(Prompt: ${tokensUsed.prompt_tokens}, Completion: ${tokensUsed.completion_tokens})`;


  if (process.env.MODEL_PRICE_PER_TOKEN_PROMPT) {

    let prompt_cost = tokensUsed.prompt_tokens * process.env.MODEL_PRICE_PER_TOKEN_PROMPT;
    let completion_cost = tokensUsed.completion_tokens * process.env.MODEL_PRICE_PER_TOKEN_COMPLETION;
    let total_cost = prompt_cost + completion_cost;

    prompt_cost = (prompt_cost / 1000).toFixed(2);
    completion_cost = (completion_cost / 1000).toFixed(2);
    total_cost = (total_cost / 1000).toFixed(2);

    output += `\nTotal Costs: \$${total_cost} `
      + `(Prompt: \$${prompt_cost}, Completion: \$${completion_cost})\n\n`;
      status_bar += ` ( \$${total_cost} )`;
  }
  console.log(output);
  //return less verbose version to use as status bar.
  return status_bar;

}

async function createWindow() {

  
  browser = await puppeteer.launch({ headless: true });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });


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
    while (!answered) {
      let gptResponse = "";
      if (process.env.OFFLINE) {
        gptResponse = await Promise.resolve(
          '{"navigate": "https://github.com/pale2hall/searchbot9k"}'
        );
        answered = true;
      } else {
        // Call the AI
        gptResponse = await chatGPT(messages);
      }
      const jsonResponse = JSON.parse(gptResponse);

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

      if (jsonResponse.answer) {
        // answer question and end script
        console.log(`Answer: ${jsonResponse.answer}`);
        next_message =
          next_message + `Here is the answer: ${jsonResponse.answer}`;
        answered = true;

        mainWindow.webContents.send("update-answer", jsonResponse.answer);
        // TODO, tell Electron about the answer being found and spawn an alert message.
      } else if (jsonResponse.search) {
        // search a new query
        let url = `https://google.com/search?q=${jsonResponse.search}`;
        urlHistory.push(url);
        mainWindow.webContents.send("update-set-text", {
          id: "address-bar",
          text: url,
        });
        console.log(`New search phrase: ${jsonResponse.search}`);
        // TODO loading animation
        const serp = await googleSearch(jsonResponse.search);
        next_message =
          next_message +
          `Here's the content of the page:\n
              ${serp.content}
          \n\n
              Here are the search results:\n${formatLinksForChat(serp.links)}`;
      } else if (jsonResponse.navigate) {

        mainWindow.webContents.send("update-set-text", {
          id: "address-bar",
          text: jsonResponse.navigate,
        });

        urlHistory.push(jsonResponse.navigate); // Add the visited URL to the history
        console.log(`Link: ${jsonResponse.navigate}`);
        const pageData = await getPageContent(jsonResponse.navigate);
        next_message =
          next_message +
          `Here is the first 2000 chars text on the page:\n${truncate(
            pageData.content,
            2000
          )}\n\nHere are the first 1000 chars of links on the page:\n${truncate(formatLinksForChat(
            // TODO 
            // Then remove any links that are in the urlHistory
            pageData.links
          ), 1000)}`;
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
        { role: "user", content: next_message },
      ];

      messages.push(...newMessages);
      fullMessageLog.push(...newMessages);

      mainWindow.webContents.send("update-messages", fullMessageLog);
    }
    
  await browser.close();

  } catch (error) {
    console.error("Error:", error);
  }
  
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substr(0, maxLength - 3) + "...";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatLinksForChat(links) {
  let formattedLinks = "";
  links.forEach((link) => {
    if (link.title === "") {
      formattedLinks += `\n- ${link.url}`;
    }
    formattedLinks += `\n- ${link.title} - ${link.url}`;
  });
  return formattedLinks + "\n\n";
}

async function retryAxiosRequest(requestFn, maxRetries = 4) {
  let retries = 0;
  let result;
  let success = false;

  while (!success && retries < maxRetries) {
    try {
      result = await requestFn();
      success = true;
    } catch (error) {
      console.log(`Retry ${retries + 1} failed: ${error.message}`);
      if (error.response && error.response.status === 429) {
        console.log(error.response.data.error);
        retries++;
        await sleep(Math.pow(2, retries) * 1000); // Exponential backoff
      } else {
        throw error;
      }
    }
  }

  if (!success) {
    throw new Error(`Request failed after ${retries} retries. `);
  }

  return result;
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
