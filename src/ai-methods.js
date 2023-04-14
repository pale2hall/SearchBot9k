/*
 * This file contains various methods that are used by the AI.
 * The AI returns a JSON object, and
 * each key that we listen for is a function or method
 * defined in this file.
 */

async function aiSearch(query, page, loadWebPageImage) {
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

async function aiNavigate(url, page, loadWebPageImage) {

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


module.exports = {
    aiSearch,
    aiNavigate
};

