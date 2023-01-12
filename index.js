import Bot from "meowerbot";
import * as dotenv from "dotenv";
import JSONdb from "simple-json-db";
import { extract } from "@extractus/feed-extractor";

dotenv.config();

const username = process.env["FB_USERNAME"], password = process.env["FB_PASSWORD"];
const help = [`@${username} help`, `@${username} subscribe`, `@${username} unsubscribe`];
const db = new JSONdb("db.json");
const bot = new Bot(username, password);

if (!(db.has("feeds"))) {
    db.set("feeds", []);
}

async function update() {
    try {
        let feeds = db.get("feeds");
        for (let i in feeds) {
            let extractedFeed = await extract(feeds[i].url);
            
            if (feeds[i].latest.id != extractedFeed.entries[0].id) {
                bot.post(`@${feeds[i].user} A new entry in "${feeds[i].name}" has been published!
    ${extractedFeed.entries[0].link}`);
                feeds[i].latest = extractedFeed.entries[0];
            } else {
                continue;
            }
        }
    } catch(e) {
        console.error(e);
    }
}

bot.onPost(async (user, content) => {
    if (content.startsWith(`@${username} help`)) {
        bot.post(`Commands: ${help.join(" ")}`);
    }

    if (content.startsWith(`@${username} subscribe`)) {
        try {
            let feed = await extract(content.split(" ")[2]);
            let subscriptions = db.get("feeds");
            subscriptions.push({"name": feed.title, "url": content.split(" ")[2], "latest": feed.entries[0],"user": user});
            bot.post(`Successfully subscribed to "${feed.title}"!`)
        db.set(subscriptions);
        } catch(e) {
            console.error(e);
            bot.post(`There was a error subscribing to the feed!
    ${e}`);
            return;
        }
    }

    if (content.startsWith(`@${username} unsubscribe`)) {
        try { 
            let feed = await extract(content.split(" ")[2]);
            let subscriptions = db.get("feeds");
            for (i in subscriptions) {
                if (subscriptions[i].name == feed.title) {
                    subscriptions.splice(i, 1);
                }
            }
            db.set(subscriptions);
            bot.post(`Successfully unsubscribed from ${feed.title}!`);
        } catch(e) {
            console.error(e);
            bot.post(`There was a error while unsubscribing from the feed!
    ${e}`);
            return;
        }
               

    }
});

bot.onMessage((data) => {
    console.log(`New message: ${data}`);
});

bot.onClose(() => {
    console.error("Disconnected");
});

bot.onLogin(() => {
    bot.post(`${username} is now online! Use @${username} help to see a list of commands.`);
});

setInterval(() => {
    update();
}, 60000);
