import fs = require('fs');
import https = require('https');
import path = require('path');
import { PRNG } from './prng';
import { IParam } from './workers/parameters';

const ALPHA_NUMERIC_REGEX = /[^a-zA-Z0-9 ]/g;
const ID_REGEX = /[^a-z0-9]/g;
const INTEGER_REGEX = /^[0-9]*$/g;
const FLOAT_REGEX = /^[.0-9]*$/g;
const SPACE_REGEX = /[ ]*/g;
const HTML_CHARACTER_REGEX = /[<>/'"]/g;

const maxMessageLength = 300;
const maxUsernameLength = 18;
const rootFolder = path.resolve(__dirname, '..');
const fetchUrlTimeoutTimers = {
	'challonge': 5 * 1000,
};

type FetchUrlTimeoutKey = keyof typeof fetchUrlTimeoutTimers;

export class Tools {
	// exported constants
	readonly maxMessageLength: typeof maxMessageLength = maxMessageLength;
	readonly maxUsernameLength: typeof maxUsernameLength = maxUsernameLength;
	readonly roomLogsFolder: string = path.join(rootFolder, 'roomlogs');
	readonly rootFolder: typeof rootFolder = rootFolder;

	fetchUrlTimeouts: Dict<NodeJS.Timer> = {};
	fetchUrlQueues: Dict<(() => any)[]> = {};

	onReload(previous: Partial<Tools>) {
		if (previous.fetchUrlTimeouts) this.fetchUrlTimeouts = previous.fetchUrlTimeouts;
		if (previous.fetchUrlQueues) this.fetchUrlQueues = previous.fetchUrlQueues;
	}

	random(limit?: number, prng?: PRNG): number {
		if (!limit) limit = 2;
		if (prng) return prng.next(limit);
		return Math.floor(Math.random() * limit);
	}

	sampleMany<T>(array: readonly T[], amount: string | number, prng?: PRNG): T[] {
		const len = array.length;
		if (!len) throw new Error("Tools.sampleMany() does not accept empty arrays");
		if (len === 1) return array.slice();
		if (typeof amount === 'string') amount = parseInt(amount);
		if (!amount || isNaN(amount)) throw new Error("Invalid amount in Tools.sampleMany()");
		if (amount > len) amount = len;
		return this.shuffle(array, prng).splice(0, amount);
	}

	sampleOne<T>(array: readonly T[], prng?: PRNG): T {
		const len = array.length;
		if (!len) throw new Error("Tools.sampleOne() does not accept empty arrays");
		if (len === 1) return array.slice()[0];
		return this.shuffle(array, prng)[0];
	}

	shuffle<T>(array: readonly T[], prng?: PRNG): T[] {
		const shuffled = array.slice();

		// Fisher-Yates shuffle algorithm
		let currentIndex = shuffled.length;
		let randomIndex = 0;
		let temporaryValue;

		// While there remain elements to shuffle...
		while (currentIndex !== 0) {
			// Pick a remaining element...
			randomIndex = this.random(currentIndex, prng);
			currentIndex -= 1;

			// And swap it with the current element.
			temporaryValue = shuffled[currentIndex];
			shuffled[currentIndex] = shuffled[randomIndex];
			shuffled[randomIndex] = temporaryValue;
		}
		return shuffled;
	}

	intersectArrays<T>(arrayA: readonly T[], arrayB: readonly T[]): T[] {
		const temp: T[] = [];
		const arrayALen = arrayA.length;
		const arrayBLen = arrayB.length;
		if (arrayALen < arrayBLen) {
			for (let i = 0; i < arrayALen; i++) {
				if (arrayB.includes(arrayA[i])) temp.push(arrayA[i]);
			}
		} else {
			for (let i = 0; i < arrayBLen; i++) {
				if (arrayA.includes(arrayB[i])) temp.push(arrayB[i]);
			}
		}

		return temp;
	}

	intersectParams(params: IParam[], dexes: Dict<Dict<readonly string[]>>): string[] {
		let intersection: string[] = dexes[params[0].type][params[0].param].slice();
		for (let i = 1; i < params.length; i++) {
			intersection = this.intersectArrays(intersection, dexes[params[i].type][params[i].param]);
			if (!intersection.length) break;
		}
		return intersection;
	}

	toId(input: string | number | {id: string} | undefined): string {
		if (input === undefined) return '';
		if (typeof input !== 'string') {
			if (typeof input === 'number') {
				input = '' + input;
			} else {
				input = input.id;
			}
		}
		return input.toLowerCase().replace(ID_REGEX, '');
	}

	toRoomId(name: string): string {
		const id = name.trim().toLowerCase();
		if (id.startsWith('battle-') || id.startsWith('groupchat-')) return id.replace(SPACE_REGEX, '');
		return this.toId(name);
	}

	toAlphaNumeric(input: string | number | undefined): string {
		if (input === undefined) return '';
		if (typeof input === 'number') input = '' + input;
		return input.replace(ALPHA_NUMERIC_REGEX, '').trim();
	}

	toString(input: string | number | boolean | undefined | null | {activityType?: string, effectType?: string, name?: string, toString?(): string}): string {
		if (input === undefined) return 'undefined';
		if (input === null) return 'null';
		if (typeof input === 'string') return input;
		if (typeof input === 'number' || typeof input === 'boolean') return '' + input;
		if (Array.isArray(input)) return '[' + input.map(x => this.toString(x)).join(', ') + ']';
		for (const i in global) {
			// @ts-ignore
			if (input === global[i]) return '[global ' + i + ']';
		}
		if (input.effectType && typeof input.effectType === 'string') {
			return '[' + input.effectType.toLowerCase() + ' ' + input.name + ']';
		} else if (input.activityType && typeof input.activityType === 'string') {
			return '[' + input.activityType + ' ' + input.name + ']';
		} else {
			if (input.toString) {
				return JSON.stringify(input);
			} else {
				return '[object UnknownType]';
			}
		}
	}

	stripHtmlCharacters(input: string): string {
		return input.replace(HTML_CHARACTER_REGEX, '');
	}

	parseUsernameText(usernameText: string): {away: boolean, status: string, username: string} {
		let away = false;
		let status = '';
		let username = '';
		const atIndex = usernameText.indexOf('@');
		if (atIndex !== -1) {
			username = usernameText.substr(0, atIndex);
			status = usernameText.substr(atIndex + 1);
			away = status.charAt(0) === '!';
		} else {
			username = usernameText;
		}

		return {away, status, username};
	}

	joinList(list: string[], preFormatting?: string | null, postFormatting?: string | null, conjunction?: string): string {
		let len = list.length;
		if (!len) return "";
		if (!preFormatting) preFormatting = "";
		if (!postFormatting) postFormatting = preFormatting;
		if (!conjunction) conjunction = "and";
		if (len === 1) {
			return preFormatting + list[0] + postFormatting;
		} else if (len === 2) {
			return preFormatting + list[0] + postFormatting + " " + conjunction + " " + preFormatting + list[1] + postFormatting;
		} else {
			len--;
			return preFormatting + list.slice(0, len).join(postFormatting + ", " + preFormatting) + postFormatting + ", " + conjunction + " " + preFormatting + list[len] + postFormatting;
		}
	}

	prepareMessage(message: string): string {
		message = this.toString(message);
		if (message.length > maxMessageLength) message = message.substr(0, maxMessageLength - 3) + "...";
		return message;
	}

	/**
	 * Returns a timestamp in the form {yyyy}-{MM}-{dd} {hh}:{mm}:{ss}.
	 *
	 * options.human = true will reports hours human-readable
	 */
	toTimestampString(date: Date, options?: Dict<any>): string {
		const human = options && options.human;
		let parts: any[] = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
		if (human) {
			parts.push(parts[3] >= 12 ? 'pm' : 'am');
			parts[3] = parts[3] % 12 || 12;
		}
		parts = parts.map(val => val < 10 ? '0' + val : '' + val);
		return parts.slice(0, 3).join("-") + " " + parts.slice(3, human ? 5 : 6).join(":") + (human ? "" + parts[6] : "");
	}

	toDurationString(input: number, options?: {precision?: number, hhmmss?: boolean}): string {
		const date = new Date(input);
		const parts = [date.getUTCFullYear() - 1970, date.getUTCMonth(), date.getUTCDate() - 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
		const roundingBoundaries = [6, 15, 12, 30, 30];
		const unitNames = ["year", "month", "day", "hour", "minute", "second"];
		const positiveIndex = parts.findIndex(elem => elem > 0);
		const precision = (options && options.precision ? options.precision : parts.length);
		if (options && options.hhmmss) {
			const joined = parts.slice(positiveIndex).map(value => value < 10 ? "0" + value : "" + value).join(":");
			return joined.length === 2 ? "00:" + joined : joined;
		}
		// round least significant displayed unit
		if (positiveIndex + precision < parts.length && precision > 0 && positiveIndex >= 0) {
			if (parts[positiveIndex + precision] >= roundingBoundaries[positiveIndex + precision - 1]) {
				parts[positiveIndex + precision - 1]++;
			}
		}

		const durationString: string[] = [];
		for (let i = positiveIndex; i < parts.length; i++) {
			if (parts[i]) durationString.push(parts[i] + " " + unitNames[i] + (parts[i] > 1 ? "s" : ""));
		}
		return this.joinList(durationString);
	}

	getLastDayOfMonth(date: Date): number {
		const month = date.getMonth() + 1;
		if (month === 2) {
			if (date.getFullYear() % 4 === 0) return 29;
			return 28;
		}
		if ([4, 6, 9, 11].includes(month)) return 30;
		return 31;
	}

	/**
	 * Returns 2 numbers for month/day or 3 for year/month/day
	 */
	toDateArray(input: string, pastDate?: boolean): number[] | null {
		const parts = input.split('/');
		const extracted: number[] = [];
		let hasYear = false;
		for (let i = 0; i < parts.length; i++) {
			const partNumber = parseInt(parts[i]);
			if (isNaN(partNumber)) return null;
			if (partNumber > 31) {
				if (hasYear) return null;
				hasYear = true;
				extracted.unshift(partNumber);
			} else {
				extracted.push(partNumber);
			}
		}
		if (hasYear && extracted.length === 2) extracted.push(pastDate ? 1 : new Date().getDate());
		return extracted;
	}

	isInteger(text: string): boolean {
		text = text.trim();
		if (text.charAt(0) === '-') text = text.substr(1);
		if (text === '') return false;
		return !!text.match(INTEGER_REGEX);
	}

	isFloat(text: string): boolean {
		text = text.trim();
		if (text.charAt(0) === '-') text = text.substr(1);
		if (text === '') return false;
		return !!text.match(FLOAT_REGEX);
	}

	isUsernameLength(name: string): boolean {
		const id = this.toId(name);
		return id && id.length <= maxUsernameLength ? true : false;
	}

	deepClone<T>(obj: T): T {
		if (obj === null || typeof obj !== 'object') return obj;
		if (Array.isArray(obj)) {
			const clone = obj.slice() as T & any[];
			for (let i = 0; i < obj.length; i++) {
				clone[i] = this.deepClone(obj[i]);
			}
			return clone;
		}
		const clone: T = Object.create(Object.getPrototypeOf(obj));
		const keys = Object.keys(obj) as (keyof T)[];
		for (let i = 0; i < keys.length; i++) {
			clone[keys[i]] = this.deepClone(obj[keys[i]]);
		}
		return clone;
	}

	uncacheTree(root: string) {
		let uncache = [require.resolve(root)];
		do {
			const newuncache: string[] = [];
			for (const target of uncache) {
				if (require.cache[target]) {
					// @ts-ignore
					newuncache.push.apply(newuncache, require.cache[target].children.filter(cachedModule => !cachedModule.id.endsWith('.node')).map(cachedModule => cachedModule.id));
					delete require.cache[target];
				}
			}
			uncache = newuncache;
		} while (uncache.length > 0);
	}

	async fetchUrl(url: string, timeoutKey?: FetchUrlTimeoutKey): Promise<string | Error> {
		return new Promise(resolve => {
			let data = '';
			const request = https.get(url, res => {
				res.setEncoding('utf8');
				res.on('data', chunk => data += chunk);
				res.on('end', () => {
					if (timeoutKey) this.prepareNextFetchUrl(timeoutKey);
					resolve(data);
				});
			});

			request.on('error', error => {
				if (timeoutKey) this.prepareNextFetchUrl(timeoutKey);
				resolve(error);
			});
		});
	}

	prepareNextFetchUrl(type: FetchUrlTimeoutKey) {
		this.fetchUrlTimeouts[type] = setTimeout(() => {
			delete this.fetchUrlTimeouts[type];
			if (!(type in this.fetchUrlQueues)) return;
			const queued = this.fetchUrlQueues[type].shift();
			if (!queued) return;
			queued();
		}, fetchUrlTimeoutTimers[type]);
	}

	getChallongeUrl(input: string): string | undefined {
		if (!input) return;
		const index = input.indexOf('challonge.com/');
		if (index === -1) return;
		let challongeLink = input.substr(index).trim();
		const spaceIndex = challongeLink.indexOf(' ');
		if (spaceIndex !== -1) challongeLink = challongeLink.substr(0, spaceIndex);
		if (challongeLink.length < 15) return;
		const httpIndex = challongeLink.indexOf('http://');
		if (httpIndex !== -1) {
			challongeLink = 'https://' + challongeLink.substr(httpIndex + 1);
		} else {
			const httpsIndex = challongeLink.indexOf('https://');
			if (httpsIndex === -1) challongeLink = 'https://' + challongeLink;
		}
		const boldIndex = challongeLink.lastIndexOf("**");
		if (boldIndex !== -1) challongeLink = challongeLink.substr(0, boldIndex);
		while (challongeLink.endsWith('.') || challongeLink.endsWith("'") || challongeLink.endsWith('"') || challongeLink.endsWith("\\")) {
			challongeLink = challongeLink.substr(0, challongeLink.length - 1);
		}
		return challongeLink;
	}

	safeWriteFile(filepath: string, data: string): Promise<void> {
		const tempFilepath = filepath + '.temp';
		return new Promise(resolve => {
			fs.writeFile(tempFilepath, data, () => {
				fs.rename(tempFilepath, filepath, () => {
					resolve();
				});
			});
		});
	}

	safeWriteFileSync(filepath: string, data: string) {
		const tempFilepath = filepath + '.temp';
		fs.writeFileSync(tempFilepath, data);
		fs.renameSync(tempFilepath, filepath);
	}
}
