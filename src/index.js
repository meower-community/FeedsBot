import Bot from "meowerbot";
import * as dotenv from "dotenv";
import JSONdb from "simple-json-db";
import { extract } from "@extractus/feed-extractor";
import { exec } from "child_process";
import fetch from "node-fetch";
import { toRelative } from "./../lib/relative.js";
import { shorten } from "./../lib/shorten.js";

dotenv.config();

const username = process.env["FB_USERNAME"];
const password = process.env["FB_PASSWORD"];
const help = [
    `@${username} help`,
    `@${username} subscribe`,
    `@${username} unsubscribe`,
    `@${username} feeds`,
    `@${username} read`
];
const db = new JSONdb("db.json");
const bot = new Bot();

if (!(db.has("feeds"))) {
    db.set("feeds", []);
}

async function update() {
    console.log("Updating feeds...");
    let feeds = db.get("feeds");
    try {
        for (let i in feeds) {
            console.log(`Updating feed for ${feeds[i].name}...`);
            let extractedFeed = await extract(feeds[i].url);
            
            if (feeds[i].latest.id != extractedFeed.entries[0].id) {
                let link = await shorten(extractedFeed.entries[0].link);
                console.log(`New entry found for ${feeds[i].name}`);
                
                bot.post(`A new entry in ${feeds[i].name} has been published!        
${extractedFeed.entries[0].title}:
    ${link}`, feeds[i].id);
                extractedFeed.entries[0].discovered = new Date().getTime();
                extractedFeed.entries[0].published = new Date(extractedFeed.entries[0].published).getTime();
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

bot.onCommand("help", (ctx) => {
    ctx.reply(`Commands:
    ${help.join("\n    ")}`);
});

bot.onCommand("subscribe", async (ctx) => {
    if (!ctx.origin) {
        ctx.post("You can't subscribe to feeds in Home!");
        return;
    }

    try {
        console.log("Subscribing to feed...");
        let feed = await extract(argv[0].replace(/https:\/\//i, "http://"));
        let subscriptions = db.get("feeds");

        for (let i in subscriptions) {
            if (subscriptions[i].user == ctx.user && subscriptions[i].name == feed.title && subscriptions[i].id == ctx.origin) {
                console.log("Feed already exists under this user");
                ctx.reply(`You already subscribed to ${feed.title}!`);
                return;
            }
        }

        subscriptions.push({
            "name": feed.title,
            "url": ctx.args[0],
            "latest": feed.entries[0],
            "user": ctx.user, 
            "id": ctx.origin
        });

        console.log(`Subscribed to ${feed.title}`);
        ctx.reply(`Successfully subscribed to ${feed.title}!`);
        db.set(subscriptions);
    } catch(e) {
        console.error(e);
        ctx.reply(`There was a error subscribing to the feed!\n${e}`);
        return;
    }
});

bot.onCommand("unsubscribe", async (ctx) => {
    if (!ctx.origin) {
        ctx.reply("You can't unsubscribe to feeds in Home!");
        return;
    }

    try {
        let feed = await extract(argv[0].replace(/https:\/\//i, "http://"));
        let subscriptions = db.get("feeds");
        for (let i in subscriptions) {
            if (subscriptions[i].name == feed.title) {
                subscriptions.splice(i, 1);
                db.set(subscriptions);
                ctx.reply(`Successfully unsubscribed from ${feed.title}!`);
                return;
            }
        }

        ctx.reply(`You haven't subscribed to ${feed.title}!`);
    } catch(e) {
        console.error(e);
        ctx.reply(`There was a error while unsubscribing from the feed!\n${e}`);
        return;
    }
});

bot.onCommand("feeds", (ctx) => {
    let subscriptions = db.get("feeds");
    let feeds = [];
    for (let i in subscriptions) {
        if (user == subscriptions[i].user) {
            feeds.push(`${subscriptions[i].name}: Last entry posted ${toRelative(new Date(subscriptions[i].latest.published).getTime())}`);
            continue;
        }

        if (feeds.length === 0) {
            ctx.reply("You haven't subscribed to any feeds!");
        } else {
            ctx.reply(`The feeds you have subscribed to:\n${feeds.join("\n")}`);
        }
    }
});

bot.onCommand("read", async (ctx) => {
    try {
        let feed = await extract(argv[2].replace(/https:\/\//i, "http://"));

        if (argv[2] == undefined) {
            ctx.reply(`${feed.entries[0].title}:\n${feed.entries[0].description}`);
        } else {
            if ((parseInt(ctx.args[2]) + 1) > feed.entries.length) {
                ctx.reply("This entry doesn't exist!");
            } else {
                ctx.reply(`${feed.entries[parseInt(ctx.args[2]) + 1].title}:\n${feed.entries[parseInt(ctx.args[2]) + 1].description}`);
            }
        }
    } catch(e) {
        ctx.reply(`There was an error fetching the feed!\n${e}`);
    }
});

bot.onMessage((data) => {
    console.log(`New message: ${data}`);
});

bot.onClose(() => {
    console.error("Disconnected");
    bot.login(username, password);
});

bot.onLogin(() => {
    bot.post(`${username} is now online! Use @${username} help to see a list of commands.`);
});

setInterval(() => {
    update();
}, 300000);

bot.login(username, password);
