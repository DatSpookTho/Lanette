import { DefaultGameOption } from "../room-game";
import { Room } from "../rooms";
import { IGameFile } from "../types/games";
import { commandDescriptions, commands as templateCommands, Guessing } from './templates/guessing';

const name = "Mareanie's Marquees";
const data: {'Pokemon': string[], 'Pokemon Abilities': string[], 'Pokemon Items': string[], 'Pokemon Moves': string[]} = {
	"Pokemon": [],
	"Pokemon Abilities": [],
	"Pokemon Items": [],
	"Pokemon Moves": [],
};
type DataKey = keyof typeof data;
const categories = Object.keys(data) as DataKey[];
let loadedData = false;

class MareaniesMarquee extends Guessing {
	static loadData(room: Room) {
		if (loadedData) return;
		room.say("Loading data for " + name + "...");

		data["Pokemon"] = Dex.getPokemonList().map(x => x.species);
		data["Pokemon Abilities"] = Dex.getAbilitiesList().map(x => x.name);
		data["Pokemon Items"] = Dex.getItemsList().map(x => x.name);
		data["Pokemon Moves"] = Dex.getMovesList().map(x => x.name);

		loadedData = true;
	}

	defaultOptions: DefaultGameOption[] = ['points'];
	lastAnswer: string = '';
	letters: string[] = [];
	currentIndex: number = -1;
	hintUpdates: number = 0;
	hintLimit: number = 0;
	lettersToReveal: number = 4;
	currentCategory: string = '';

	async setAnswers() {
		const category = (this.roundCategory || this.variant || this.sampleOne(categories)) as DataKey;
		this.currentCategory = category;
		let answer = '';
		let letters: string[] = [];
		let willBeFiltered = false;
		while (!answer || answer === this.lastAnswer || willBeFiltered) {
			answer = this.sampleOne(data[category]);
			letters = answer.replace(" ", "").split("");
			for (let i = 0; i < letters.length; i++) {
				let part = letters.slice(i, i + this.lettersToReveal);
				if (part.length < this.lettersToReveal) part = part.concat(letters.slice(0, this.lettersToReveal - part.length));
				if (Client.willBeFiltered(part.join(''), !this.isPm(this.room) ? this.room : undefined)) {
					willBeFiltered = true;
					break;
				}
			}
		}
		this.answers = [answer];
		this.letters = letters;
		this.currentIndex = -1;
		this.hintUpdates = 0;
		this.hintLimit = letters.length * 2;
		this.updateHint();
	}

	updateHint() {
		this.hintUpdates++;
		if (this.hintUpdates >= this.hintLimit) {
			this.say("Time's up! " + this.getAnswers(''));
			this.answers = [];
			if (this.isMiniGame) {
				this.end();
				return;
			}
			this.nextRound();
			return;
		}

		if (this.currentIndex === -1) {
			let index = this.random(this.letters.length);
			while (index === 0) {
				index = this.random(this.letters.length);
			}
			this.currentIndex = index;
		}

		let index = this.currentIndex;
		this.hint = '';
		const lastIndex = this.letters.length - 1;
		for (let i = 0; i < this.lettersToReveal; i++) {
			this.hint += this.letters[index];
			index++;
			if (index > lastIndex) index = 0;
		}
		this.currentIndex++;
		if (this.currentIndex > lastIndex) this.currentIndex = 0;
	}

	sayHint() {
		const html = "<div class='infobox' style='text-align:center'>The category is <b>" + this.currentCategory + "</b>:<br /><br />" + this.hint + "<br />&nbsp;</div>";
		const uhtmlName = this.uhtmlBaseName + '-hint';
		this.onUhtml(uhtmlName, html, () => {
			if (!this.canGuess) this.canGuess = true;
			this.timeout = setTimeout(() => {
				this.updateHint();
				this.sayHint();
			}, 1500);
		});
		this.sayUhtml(uhtmlName, html);
	}

	async onNextRound() {
		this.canGuess = false;
		await this.setAnswers();
		this.sayHint();
	}
}

export const game: IGameFile<MareaniesMarquee> = {
	aliases: ['mareanies', 'marquees'],
	battleFrontierCategory: 'Identification',
	class: MareaniesMarquee,
	commandDescriptions,
	commands: Object.assign({}, templateCommands),
	description: "Players guess the answers as letters are cycled through 1 at a time!",
	freejoin: true,
	name,
	mascot: "Mareanie",
	variants: [
		{
			name: "Mareanie's Pokemon Marquees",
			variant: "Pokemon",
		},
		{
			name: "Mareanie's Ability Marquees",
			variant: "Pokemon Abilities",
			variantAliases: ['ability', 'abilities'],
		},
		{
			name: "Mareanie's Item Marquees",
			variant: "Pokemon Items",
			variantAliases: ['item', 'items'],
		},
		{
			name: "Mareanie's Move Marquees",
			variant: "Pokemon Moves",
			variantAliases: ['move', 'moves'],
		},
	],
};
