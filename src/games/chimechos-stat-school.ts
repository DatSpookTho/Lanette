import { DefaultGameOptions } from "../room-game";
import { Room } from "../rooms";
import { IGameFile } from "../types/games";
import { commandDescriptions, commands as templateCommands, Guessing } from './templates/guessing';

const name = "Chimecho's Stat School";
const data: Dict<string[]> = {};
let dataKeys: string[] = [];
let loadedData = false;

class ChimechosStatSchool extends Guessing {
	static loadData(room: Room) {
		if (loadedData) return;
		room.say("Loading data for " + name + "...");

		const pokemon = Dex.getPokemonList();
		for (let i = 0; i < pokemon.length; i++) {
			const stats = Object.values(pokemon[i].baseStats).join(" / ");
			if (!(stats in data)) data[stats] = [];
			data[stats].push(pokemon[i].species);
		}
		dataKeys = Object.keys(data);

		loadedData = true;
	}

	defaultOptions: DefaultGameOptions[] = ['points'];

	onSignups() {
		if (this.options.freejoin) this.timeout = setTimeout(() => this.nextRound(), 5000);
	}

	setAnswers() {
		const stats = Tools.sampleOne(dataKeys);
		this.answers = data[stats];
		this.hint = "**Base stats**: " + stats;
	}
}

export const game: IGameFile<ChimechosStatSchool> = {
	aliases: ['chimechos', 'css', 'statschool'],
	battleFrontierCategory: 'Knowledge',
	class: ChimechosStatSchool,
	commandDescriptions,
	commands: Object.assign({}, templateCommands),
	description: "Players guess Pokémon with the given base stat distributions!",
	freejoin: true,
	name,
	mascot: "Chimecho",
	modes: ["survival"],
};
