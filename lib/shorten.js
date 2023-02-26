import fetch from "node-fetch";

export async function shorten(link) {
    let shortened_link = await fetch(`https://api.shrtco.de/v2/shorten?url=${link}`).then(res => res.json());
    return shortened_link.result.full_short_link;
}