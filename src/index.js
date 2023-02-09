import Bot from "meowerbot";
import * as dotenv from "dotenv";
import JSONdb from "simple-json-db";
import { extract } from "@extractus/feed-extractor";
import { exec } from "child_process";
import fetch from "node-fetch";
import { toRelative } from "./../lib/relative.js";

dotenv.config();

const username = process.env["FB_USERNAME"], password = process.env["FB_PASSWORD"];
const help = [`@${username} help`, `@${username} subscribe`, `@${username} unsubscribe`, `@${username} feeds`, `@${username} read`];
const db = new JSONdb("db.json");

const bot = new Bot(username, password);

if (!(db.has("feeds"))) {
    db.set("feeds", []);
}

async function update() {
    console.log("Updating feeds...");
    try {
        let feeds = db.get("feeds");
        for (let i in feeds) {
            console.log(`Updating feed for ${feeds[i].name}...`);
            let extractedFeed = await extract(feeds[i].url);
            
            if (feeds[i].latest.id != extractedFeed.entries[0].id) {
                let link = await fetch(`https://api.shrtco.de/v2/shorten?url=${extractedFeed.entries[0].link}`).then(res => res.json());
                console.log(`New entry found for ${feeds[i].name}`);
                
                bot.post(`A new entry in ${feeds[i].name} has been published!        
${extractedFeed.entries[0].title}:
    ${link.result.full_short_link}`, feeds[i].id);
                feeds[i].latest = extractedFeed.entries[0];
                db.set("feeds", feeds);
            } else {
                console.log(`No new entries found for ${feeds[i].name}`);
                continue;
            }
        }
        console.log("Finished updating feeds");
    } catch(e) {
        console.error(e);
    }
}

bot.onPost(async (user, content, origin) => {
    if (content.startsWith(`@${username} help`)) {
        bot.post(`Commands: ${help.join(", ")}`, origin);
    }

    if (content.startsWith(`@${username} subscribe`)) {
        if (!(origin)) {
            bot.post("You can't subscribe to feeds in Home!", origin);
            return;
        }

        try {
            console.log("Subscribing to feed...");
            let feed = await extract(content.split(" ")[2].replace(/https:\/\//i, "http://"));
            let subscriptions = db.get("feeds");

            for (let i in subscriptions) {
                if (subscriptions[i].user == user && subscriptions[i].name == feed.title) {
                    console.log("Feed already exists under this user");
                    bot.post(`You already subscribed to ${feed.title}!`, origin);
                    return;
                }
            }

            subscriptions.push({"name": feed.title, "url": content.split(" ")[2], "latest": feed.entries[0], "user": user, "id": (origin ? origin : null)});
            console.log(`Subscribed to ${feed.title}`);
            bot.post(`Successfully subscribed to ${feed.title}!`, origin);
            db.set(subscriptions);
        } catch(e) {
            console.error(e);
            bot.post(`There was a error subscribing to the feed!
    ${e}`, origin);
            return;
        }
    }

    if (content.startsWith(`@${username} unsubscribe`)) {
        try {
            let feed = await extract(content.split(" ")[2].replace(/https:\/\//i, "http://"));
            let subscriptions = db.get("feeds");
            let i;
            for (i in subscriptions) {
                if (subscriptions[i].name == feed.title) {
                    delete subscriptions[i];
                    db.set(subscriptions);
                    bot.post(`Successfully unsubscribed from ${feed.title}!`, origin);
                    break;
                }
            }

            if (i == subscriptions.length) {
                bot.post(`You haven't subscribed to ${feed.title}!`, origin);
            }
        } catch(e) {
            console.error(e);
            bot.post(`There was a error while unsubscribing from the feed!
    ${e}`, origin);
            return;
        }
    }

    if (content.startsWith(`@${username} feeds`)) {
        let subscriptions = db.get("feeds");
        let feeds = [];
        for (let i in subscriptions) {
            if (user == subscriptions[i].user) {
                feeds.push(`${subscriptions[i].name}: Last entry posted ${toRelative(new Date(subscriptions[i].latest.published).getTime())}`);
                continue;
            }
        }

        if (feeds.length == 0) {
            bot.post(`You haven't subscribed to any feeds!`, origin);
        } else {
            bot.post(`The feeds you have subscribed to:
    ${feeds.join("\n    ")}`, origin);
        }
    }

    if (content.startsWith(`@${username} read`)) {
        try {
            let feed = await extract(content.split(" ")[2].replace(/https:\/\//i, "http://"));

            if (content.split(" ")[3] == undefined) {
                bot.post(`${feed.entries[0].title}:
    ${feed.entries[0].description}`, origin);
            } else {
                if ((parseInt(content.split(" ")[3]) + 1) > feed.entries.length) {
                    bot.post("Number is over the entry count!", origin);
                } else {
                    bot.post(`${feed.entries[parseInt(content.split(" ")[3]) + 1].title}:
    ${feed.entries[parseInt(content.split(" ")[3]) + 1].description}`, origin);
                }
            }
        } catch(e) {
            bot.post(`There was an error fetching the feed!
    ${e}`, origin);
        }
    }
});

bot.onMessage((data) => {
    console.log(`New message: ${data}`);
});

bot.onClose(() => {
    console.error("Disconnected");
    let command = exec("npm run start");
    command.stdout.on("data", (output) => {
        console.log(output.toString());
    });
});

bot.onLogin(() => {
    bot.post(`${username} is now online! Use @${username} help to see a list of commands.`);
});

setInterval(() => {
    update();
}, 60000);
