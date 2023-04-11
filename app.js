const axios = require("axios");
const puppeteer = require("puppeteer");
require("dotenv").config();
const { app, BrowserWindow } = require("electron");

// These should be commented out in .env if you don't want to use them.
if (process.env.DBUG || process.env.OFFLINE)
  console.log(
    "process.env.DBUG",
    process.env.DBUG,
    "process.env.OFFLINE",
    process.env.OFFLINE
  );

const sb9k_prompt = `
== KEEP IN MIND ==
- sb9k, or SearchBot9k is an advanced tool to search the internet.  
- sb9k uses ChatGPT as a backend to provide logic to a script that handles the actual search.  
- sb9k has the following commands avialble:
- \`answer\`, \`navigate\` and \`search\`. 
- sb9k always responds in JSON format with {"answer": "ANSWER", "remember": "New thought to remember"}, - {"navigate": "URL", "remember": "New info to remember"}, or {"search": "NEW SEARCH PHRASE", "remember": "New - goal to remember"}. 
- sb9k knows finding obscure information is possible, but requires clicking more links.
- sb9k knows to click the 'search only for' link when google 'corrects' its search phrase.
- sb9k uses memories to keep track of its train of thought.
- sb9k knows to ALWAYS provide fully qualified URLs for links.
- sb9k knows how to use boolean to search more effectively.
- sb9k knows not to search the same thing twice in a row on the same search engine, because the results will be the same.
- sb9k makes detailed step-by-step plans to find the answer.
- sb9k always adds one {"remember": "New thought to remember" } object to the JSON response so it can keep its - train of thought.
- sb9k knows that previous memories will be recanted so it only tells us new memories.
- sb9k can load arbitrary webpages and extract text from them, for example: if sb9k needs to lookup info about - something on wikipedia it can load en.wikipedia.org/wiki/Page_Name and extract the text from the page.

== Sample Memories Format ==
{ "remember": "New idea to remember" }

== Sample workflow ==
- sb9k is asked to look up something obscure
- sb9k comes up with a search phrase
- sb9k is provided the results
- sb9k notices that google 'corrected' its search phrase
- sb9k loads the ' search only for ' link url.
- sb9k notices it is being blocked by a captcha, so it comes up with a boomer search phrase, or asks to visit - duckduckgo.com/search?q=<phrase>, for example.
- sb9k loads a page.
- sb9k doesn't find the answer. [sb9k remembers this event]
- sb9k loads another page.
- sb9k finds the answer.
- sb9k summarizes the results, and delivers the answer.

sb9k's first command is almost always search.
Ocasionally sb9k will start at a different site if it's sure it can find the answer there.
Please act only as sb9k and find the answer for the user.
ONLY answer in properly fomatted JSON, because anything else will get caught as an error.
DO NOT send plesantries or anything in markdown.  Only send JSON.  If you need to tell me something other than an answer, put it a memory.

== END OF KEEP IN MIND ==

`;

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

  const mainWindow = BrowserWindow.getAllWindows()[0];
  // mainWindow.webContents.send('update-messages', messages);

  return response.data.choices[0].message.content;
}

async function googleSearch(query) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  let url = `https://google.com/search?q=${query}`;
  await page.goto(url);

  const links = await page.evaluate(() => {
    const linkNodes = document.querySelectorAll(".tF2Cxc h3, .card-section");
    return Array.from(linkNodes)
      .map((link) => {
        const anchor = link.parentElement.parentElement.querySelector("a");
        if (anchor) {
          const url = anchor.href;
          // TODO remove domain, it's not necessary as the AI can figure it out from URL.
          let domain;
          try {
            domain = new URL(url).hostname;
          } catch (error) {
            console.error("Invalid URL:", url);
            domain = null;
          }
          return { title: link.innerText, url, domain };
        } else {
          return null;
        }
      })
      .filter((link) => link !== null && link.domain !== null);
  });

  const content = await page.evaluate(() => {
    return document.documentElement.innerText;
  });

  const screenshot = await page.screenshot({ encoding: "base64" });
  loadWebPageImage(screenshot);
  await browser.close();
  return { links, content };
}

async function getPageContent(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });
  await page.goto(url, { waitUntil: "networkidle2" });

  let screenshot = await page.screenshot({ encoding: "base64" });

  loadWebPageImage(screenshot);

  const content = await page.evaluate(() => {
    return document.documentElement.innerText;
  });

  const links = await page.evaluate(() => {
    const linkNodes = document.querySelectorAll("a");
    return Array.from(linkNodes)
      .map((link) => {
        const url = link.href;
        let domain;
        try {
          domain = new URL(url).hostname;
        } catch (error) {
          console.error("Invalid URL:", url);
          domain = null;
        }
        return { title: link.innerText, url, domain };
      })
      .filter(
        (link) => link !== null && link.url !== "" && link.domain !== null
      );
  });

  screenshot = await page.screenshot({ encoding: "base64" });
  await browser.close();
  loadWebPageImage(screenshot);

  return { content, links };
}

function loadWebPageImage(base64Image) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  mainWindow.webContents.send("update-webpage-image", base64Image);
}

async function createWindow() {
  const urlHistory = [];
  const memories = [];
  let fullMessageLog = [];

  try {
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: `${__dirname}/assets/preload.js`,
      },
    });

    mainWindow.loadFile("index.html");
    if (process.env.DBUG || process.env.OFFLINE || process.env.DEVTOOLS)
      mainWindow.webContents.openDevTools();
    mainWindow.webContents.on("context-menu", (e) => e.preventDefault());

    const initialQuestion = process.argv[2];
    memories.push("Initial Qusetion: " + initialQuestion);

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
          '{"search": "how to make a chatbot"}'
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
        mainWindow.webContents.send("update-URL", url);
        console.log(`New search phrase: ${jsonResponse.search}`);
        // TODO loading animation
        const serp = await googleSearch(jsonResponse.search);
        next_message =
          next_message +
          `Here's the content of the page:\n
              ${serp.content}
          \n\n
              Here are the search results:\n${JSON.stringify(serp.links)}`;
      } else if (jsonResponse.navigate) {
        mainWindow.webContents.send("update-URL", jsonResponse.navigate);
        urlHistory.push(jsonResponse.navigate); // Add the visited URL to the history
        console.log(`Link: ${jsonResponse.navigate}`);
        const pageData = await getPageContent(jsonResponse.navigate);
        next_message =
          next_message +
          `Here is the first 2000 chars text on the page:\n${truncate(
            pageData.content,
            2000
          )}\n\nHere are the first 1000 chars of links on the page:\n${truncate(JSON.stringify(
            // TODO, actually parse the links and remove duplicates
            // Then remove any links that are in the urlHistory
            // Then remove empty titles and text.
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
async function retryAxiosRequest(requestFn, maxRetries = 3) {
  let retries = 0;
  let result;
  let success = false;

  while (!success && retries < maxRetries) {
    try {
      result = await requestFn();
      success = true;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        retries++;
        await sleep(Math.pow(2, retries) * 1000); // Exponential backoff
      } else {
        throw error;
      }
    }
  }

  if (!success) {
    throw new Error("Request failed after maximum retries");
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
