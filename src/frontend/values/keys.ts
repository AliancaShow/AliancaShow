// due to this being open source, there is no easy way to hide the API keys (that I know of),
// so this is a basic encryption to hide it from scrapers
// you could easily find the keys, but please don't do that, thanks! :)
// you are not allowed to used these keys outside of the FreeShow software!
// (they are all free, so you can just get your own keys if you want)

export function getKey(type: string) {
    if (type === "bibleapi") return decrypt("030647000115404f5d5e51034e52571211475d0d510d4f5a024611135b09510d")
    return "5a4104165513101501415e5b030a5d19121f03485f4603035a03"
}

const k = "04wb4wuvn8"
const decrypt = (v) => Array.from({ length: v.length / 2 }, (_, i) => String.fromCharCode(parseInt(v.substring(i * 2, i * 2 + 2), 16) ^ k.charCodeAt(i % k.length))).join("")
// const encrypt = (text) => Array.from(text, (char, i) => ('0' + (char.charCodeAt(0) ^ k.charCodeAt(i % k.length)).toString(16)).slice(-2)).join('');
